from datetime import datetime

from app.common.schemas import CamelModel
from app.modules.guides.schemas import Audience
from app.modules.support.models import Skill


class Enrollment(CamelModel):
    display_name: str | None = None
    contact_phone: str | None = None
    skills: list[Skill] | None = None
    verified_at: datetime | None = None
    verification_source: str | None = None


class Availability(CamelModel):
    available: bool
    latitude: float | None = None
    longitude: float | None = None
    consent_to_location_use: bool = False


class CreateSupportRequest(CamelModel):
    scenario_id: str | None = None
    locale: str | None = None
    audience: Audience | None = None
    latitude: float | None = None
    longitude: float | None = None
    radius: int = 0
    share_location_with_accepted_responder: bool = False


class NearbyResponder(CamelModel):
    responder_id: str
    display_name: str
    skills: list[str]
    approximate_distance_meters: int
