"""Single time source so tests can move the clock."""

from datetime import UTC, datetime

_offset = 0.0


def now() -> datetime:
    from datetime import timedelta

    return datetime.now(UTC) + timedelta(seconds=_offset)


def advance(seconds: float) -> None:
    global _offset
    _offset += seconds


def reset() -> None:
    global _offset
    _offset = 0.0
