"""Shared input checks, ported from the legacy ApiChecks."""

import math
import re
import unicodedata
from datetime import datetime
from urllib.parse import urlparse

from app.core.errors import error, require


def need[T](value: T | None, detail: str) -> T:
    """Return value or raise 400; narrows Optional for the type checker."""
    if value is None:
        raise error(400, detail)
    return value


def text(value: str | None, max_len: int, field: str) -> str:
    if value is None or value.strip() == "" or len(value) > max_len:
        raise error(400, f"Invalid {field}.")
    return value.strip()


def locale(value: str | None) -> str:
    language = text(value, 10, "locale").lower()
    if language in ("vi", "vi-vn"):
        return "vi"
    if language in ("en", "en-us", "en-gb"):
        return "en"
    raise error(400, "Supported locales: vi, en.")


def location(lat: float, lng: float) -> None:
    require(
        math.isfinite(lat) and math.isfinite(lng) and -90 <= lat <= 90 and -180 <= lng <= 180,
        "Invalid coordinates.",
    )


def nearby(lat: float, lng: float, radius: int, limit: int) -> None:
    location(lat, lng)
    require(1 <= radius <= 50_000 and 1 <= limit <= 50, "Invalid radius or limit.")


def reviewed(date: datetime | None, now: datetime) -> bool:
    return date is not None and date <= now


def https(value: str | None) -> None:
    try:
        parsed = urlparse(value or "")
        ok = parsed.scheme == "https" and bool(parsed.hostname) and not parsed.username
    except ValueError:
        raise error(400, "Invalid media URL.") from None
    require(ok, "Media URLs must use HTTPS.")


def strip_accents(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value)
    return "".join(c for c in decomposed if not unicodedata.combining(c)).replace("đ", "d")


def normalized(value: str) -> str:
    folded = strip_accents(value.lower())
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", folded)).strip()


def contains_phrase(text_in: str, phrase: str) -> bool:
    return f" {normalized(phrase)} " in f" {normalized(text_in)} "


def meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    a = (
        math.sin(math.radians(lat2 - lat1) / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(math.radians(lng2 - lng1) / 2) ** 2
    )
    return 6_371_008.8 * 2 * math.asin(math.sqrt(min(1.0, max(0.0, a))))
