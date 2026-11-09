"""A call's channel to the browser that outlives a dropped WebSocket (mobile network switch, tab freeze).

The WebRTC audio does not travel over the WebSocket, so a short drop need not end the call: `ResumableTransport` keeps
the call going for a grace period, buffers the screen messages meanwhile and takes over a new socket that presents the
call's `callId`. The registry is per-process, so a resume must reach the worker that holds the call.
"""

import asyncio
import collections
import contextlib
import logging
import time
from typing import Any, Protocol

log = logging.getLogger(__name__)

#: Screen messages kept while detached; `step`/`phase` are re-sent from the call's state on resume, so only the small
#: one-off messages (signs, hand-over, warnings) matter and a short buffer is plenty.
BUFFER_LIMIT = 50
#: Chatty and useless once stale: dropped while detached.
DROPPED_WHILE_DETACHED = frozenset({"transcript", "turn_complete"})


class Socket(Protocol):
    async def send_json(self, data: dict[str, Any]) -> None: ...
    async def receive(self) -> dict[str, Any] | None: ...
    async def close(self, code: int = 1000, reason: str = "") -> None: ...


class ResumableTransport:
    """`Transport` for `run_call` over a swappable socket. `receive()` returns `None` only when the browser said
    `stop`, the socket dropped with resuming off, or the grace period ran out."""

    def __init__(self, socket: Socket, *, grace_seconds: float) -> None:
        self._grace = grace_seconds
        self._socket: Socket | None = socket
        self._generation = 0
        self._inbox: asyncio.Queue[tuple[int, dict[str, Any] | None]] = asyncio.Queue()
        self._buffer: collections.deque[dict[str, Any]] = collections.deque(maxlen=BUFFER_LIMIT)
        self._deadline = 0.0
        self._stopped = False
        self._armed = False  # resuming is possible once the browser holds a `callId`, i.e. after the answer
        self._finished = False
        self._resyncing = False  # between `resumed` and the call's reply: the buffer waits behind phase and step
        self._readers: dict[int, asyncio.Task[None]] = {}
        self._released: dict[int, asyncio.Event] = {}
        self._start_reader(socket)

    # ---- the socket side -----------------------------------------------------------------------

    @property
    def detached(self) -> bool:
        return self._socket is None and self._armed and not self._finished

    @property
    def finished(self) -> bool:
        return self._finished

    def _start_reader(self, socket: Socket) -> asyncio.Event:
        self._generation += 1
        generation, released = self._generation, asyncio.Event()
        self._released[generation] = released

        async def read() -> None:
            while (message := await socket.receive()) is not None:
                self._inbox.put_nowait((generation, message))
            self._inbox.put_nowait((generation, None))

        self._readers[generation] = asyncio.create_task(read())
        return released

    async def attach(self, socket: Socket) -> asyncio.Event | None:
        """Take over from the current socket (closing it). Returns an event set once `socket` is no longer the
        call's, or `None` if the call has already ended. The browser sees `resumed` first, then the call's state."""
        if self._finished:
            return None
        old, self._socket = self._socket, None  # sends go to the buffer until `resumed` is out
        if old is not None:
            await self._retire(old, self._generation)
        try:
            await socket.send_json({"type": "resumed"})
        except Exception:
            self._socket = None
            self._deadline = time.monotonic() + self._grace
            return None
        self._socket = socket
        self._resyncing = True
        released = self._start_reader(socket)
        self._inbox.put_nowait((self._generation, {"type": "resumed"}))  # the call re-sends phase and step
        return released

    async def _retire(self, socket: Socket, generation: int) -> None:
        if reader := self._readers.pop(generation, None):
            reader.cancel()
        if released := self._released.pop(generation, None):
            released.set()
        try:
            await asyncio.wait_for(socket.close(), 2)
        except Exception:  # a dead socket may not even take the close frame
            log.debug("closing a retired voice socket failed", exc_info=True)

    async def _detach(self, generation: int) -> None:
        socket, self._socket = self._socket, None
        self._deadline = time.monotonic() + self._grace
        if socket is not None:
            await self._retire(socket, generation)

    # ---- Transport -----------------------------------------------------------------------------

    async def send_json(self, data: dict[str, Any]) -> None:
        if data.get("type") == "answer":
            self._armed = self._grace > 0
        if self._socket is None:
            if data.get("type") not in DROPPED_WHILE_DETACHED:
                self._buffer.append(data)
            return
        try:
            if not self._resyncing:
                await self._flush()
            await self._socket.send_json(data)
        except Exception:
            # The send failed, the receive side will notice the same drop: keep the message for the resume.
            if data.get("type") not in DROPPED_WHILE_DETACHED:
                self._buffer.append(data)

    async def _flush(self) -> None:
        while self._buffer and self._socket is not None:
            await self._socket.send_json(self._buffer[0])
            self._buffer.popleft()

    async def receive(self) -> dict[str, Any] | None:
        while True:
            self._resyncing = False  # the consumer is back for more: it has answered `resumed`
            await self._flush_quietly()
            timeout = None if self._socket is not None else max(0.0, self._deadline - time.monotonic())
            try:
                generation, message = await asyncio.wait_for(self._inbox.get(), timeout)
            except TimeoutError:
                return None
            if generation != self._generation:
                continue  # from a socket that has been replaced
            if message is not None:
                if message.get("type") == "stop":
                    self._stopped = True
                elif message.get("type") == "resumed":
                    self._resyncing = True
                return message
            if self._stopped or not self._armed or self._finished:
                return None
            await self._detach(generation)
            log.info("voice socket dropped; holding the call for %.0fs", self._grace)

    async def _flush_quietly(self) -> None:
        with contextlib.suppress(Exception):  # that socket is dropping; the buffer stays for the next one
            await self._flush()

    async def finish(self, reason: str) -> None:
        """The call is over: tell the browser why (if it is there) and let go of every socket."""
        self._finished = True
        socket, self._socket = self._socket, None
        if socket is not None:
            with contextlib.suppress(Exception):  # the browser may be gone already
                await socket.send_json({"type": "ended", "reason": reason})
                await socket.close()
        for task in self._readers.values():
            task.cancel()
        for released in self._released.values():
            released.set()
        self._readers.clear()
        self._released.clear()


class CallRegistry:
    """`callId -> transport` of the calls that can be resumed."""

    def __init__(self) -> None:
        self._calls: dict[str, ResumableTransport] = {}

    def add(self, call_id: str, transport: ResumableTransport) -> None:
        self._calls[call_id] = transport

    def remove(self, call_id: str) -> None:
        self._calls.pop(call_id, None)

    def get(self, call_id: object) -> ResumableTransport | None:
        transport = self._calls.get(call_id) if isinstance(call_id, str) else None
        return transport if transport is not None and not transport.finished else None

    def any_detached(self) -> bool:
        return any(t.detached for t in self._calls.values())


registry = CallRegistry()
