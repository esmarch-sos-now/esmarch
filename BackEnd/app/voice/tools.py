"""Run the backend model's tool calls on the server, one HTTP request at a time.

The browser relays each function call it sees on its data channel. It is untrusted, so a call is only a name and
arguments: they are validated exactly as the agent validates them (an unknown tool or bad arguments become an error
the model can retry), and the result is computed from the call's stored state and the guides, never from anything
else the browser sends. The state lives in `VoiceCall.state` between requests.
"""

import json
from dataclasses import asdict
from typing import Any

from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    RetryPromptPart,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
)
from pydantic_ai.models.function import AgentInfo, FunctionModel

from app.voice.agent import CallSession, build_agent
from app.voice.call_state import CallState, VictimSigns
from app.voice.live import tool_definitions

_agent = build_agent()


def dump(call: CallSession) -> dict[str, Any]:
    return {"call": asdict(call.state), "shownGuide": call.shown_guide, "handedOff": call.handed_off}


def load(data: dict[str, Any], emit: Any) -> CallSession:
    raw = dict(data.get("call") or {})
    if raw:
        raw["signs"] = VictimSigns(**raw.get("signs", {}))
        raw["completed_guides"] = tuple(raw.get("completed_guides", ()))
        state = CallState(**raw)
    else:
        state = CallState()
    call = CallSession(emit=emit, state=state, shown_guide=data.get("shownGuide"))
    call.handed_off = bool(data.get("handedOff"))
    return call


def _output(content: Any) -> str:
    return content if isinstance(content, str) else json.dumps(content, ensure_ascii=False)


async def run_tool(call: CallSession, name: str, arguments: str) -> str:
    """One tool call, as the agent would run it: the output to hand back to the backend model (JSON or an error)."""
    try:
        args = json.loads(arguments or "{}")
    except ValueError:
        return json.dumps({"error": "Tham số không phải JSON hợp lệ."}, ensure_ascii=False)
    if not isinstance(args, dict):
        return json.dumps({"error": "Tham số phải là một đối tượng JSON."}, ensure_ascii=False)
    if name not in {t.name for t in tool_definitions()}:
        return json.dumps({"error": "Không có công cụ này."}, ensure_ascii=False)

    result: list[str] = []
    asked = False

    def model(messages: list[ModelMessage], _: AgentInfo) -> ModelResponse:
        nonlocal asked
        last = messages[-1]
        if isinstance(last, ModelRequest):
            for part in last.parts:
                # Bad arguments: the model is told why and may try again (a retry part, or a return marked `retry`).
                if isinstance(part, RetryPromptPart):
                    result.append(json.dumps({"error": part.model_response()}, ensure_ascii=False))
                elif isinstance(part, ToolReturnPart) and getattr(part, "retry", None) is not None:
                    result.append(json.dumps({"error": part.content}, ensure_ascii=False, default=str))
                elif isinstance(part, ToolReturnPart):
                    result.append(_output(part.content))
        if asked:
            return ModelResponse(parts=[TextPart("ok")])  # an empty answer would be retried
        asked = True
        return ModelResponse(parts=[ToolCallPart(name, args, tool_call_id="server")])

    await _agent.run("", model=FunctionModel(model), deps=call)
    return result[0] if result else json.dumps({"error": "Công cụ không trả kết quả."}, ensure_ascii=False)
