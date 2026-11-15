"""Speech -> text for the requester's "Mô tả tình huống" box, through OpenAI speech-to-text.

The browser sends its MediaRecorder output (WebM/Ogg/MP4); nothing is stored. A request does not exist yet while the
form is filled in, so this endpoint takes no credential: the `Origin` check, the size cap and a per-IP limit bound
what it can cost.
"""

from openai import APIError, AsyncOpenAI

from app.core.config import Settings
from app.core.errors import error, require
from app.core.ratelimit import IpRateLimiter

# MediaRecorder output (Chrome/Firefox: WebM or Ogg Opus, Safari: MP4/AAC) plus the usual audio files.
AUDIO_TYPES = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "mp4",
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
    "audio/aac": "m4a",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "video/webm": "webm",  # some browsers label an audio-only WebM recording as video
}

_limiter: IpRateLimiter | None = None


def _limit(s: Settings) -> IpRateLimiter:
    """Per-process, like the public API limit; rebuilt when the settings change (tests)."""
    global _limiter
    wanted = (s.support_transcribe_per_ip, s.support_transcribe_window_seconds)
    if _limiter is None or (_limiter.requests, _limiter.window) != wanted:
        _limiter = IpRateLimiter(*wanted, max_clients=s.public_api_max_clients)
    return _limiter


def media_type(content_type: str | None) -> str:
    """Drops parameters: `audio/webm;codecs=opus` -> `audio/webm`."""
    return (content_type or "").split(";")[0].strip().lower()


def check(s: Settings, ip: str, content_type: str | None, data: bytes) -> str:
    """Validates a recording before it costs anything; returns the file extension to send it under."""
    if not s.openai_api_key:
        raise error(503, "Voice input is not available.")
    if not _limit(s).allow(ip):
        raise error(429, "Too many recordings. Please type the description.")
    extension = AUDIO_TYPES.get(media_type(content_type))
    require(extension is not None, "Unsupported audio format.")
    require(0 < len(data) <= s.support_transcribe_max_bytes, "Recording is empty or too large.")
    return str(extension)


async def transcribe(s: Settings, extension: str, content_type: str | None, data: bytes) -> str:
    client = AsyncOpenAI(api_key=s.openai_api_key, timeout=30, max_retries=1)
    try:
        result = await client.audio.transcriptions.create(
            model=s.support_transcribe_model,
            file=(f"description.{extension}", data, media_type(content_type)),
            language="vi",
        )
    except APIError as e:
        raise error(502, "Speech-to-text failed.") from e
    return result.text.strip()
