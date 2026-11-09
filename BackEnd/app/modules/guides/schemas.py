from datetime import datetime
from enum import StrEnum

from app.common.schemas import CamelModel, StrictCamelModel


class Audience(StrEnum):
    ADULT = "ADULT"
    CHILD = "CHILD"
    INFANT = "INFANT"


class MediaFormat(StrEnum):
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    MODEL_3D = "MODEL_3D"


class Media(CamelModel):
    type: MediaFormat
    url: str
    mime_type: str
    alt: str
    start_seconds: float | None = None
    end_seconds: float | None = None


class Step(CamelModel):
    number: int
    title: str
    text: str
    keywords: list[str]
    media: list[Media]


class Guide(StrictCamelModel):
    scenario_id: str
    locale: str
    audience: Audience
    title: str
    steps: list[Step]
    reviewed_at: datetime | None
    reviewed_by: str
    sources: list[str]


class GuideView(CamelModel):
    scenario_id: str
    title: str
    locale: str
    audience: Audience
    featured: bool
    status: str
    steps: list[Step]
    available_formats: list[MediaFormat]
    reviewed_at: datetime | None
    sources: list[str]


class Language(CamelModel):
    code: str
    name: str
    speech_locale: str
    reviewed_audiences: list[Audience]


class VideoQuestion(CamelModel):
    scenario_id: str | None = None
    locale: str | None = None
    audience: Audience | None = None
    question: str | None = None
    position_seconds: float | None = None
