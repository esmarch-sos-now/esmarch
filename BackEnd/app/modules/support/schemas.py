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


class ResponderUpdate(CamelModel):
    """Admin page: `verified` false suspends a responder, true reinstates it; `skills` replaces its skills."""

    verified: bool | None = None
    skills: list[Skill] | None = None


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
    radius: int = 0  # 0 = the configured default (SUPPORT_RADIUS_METERS)
    share_location_with_accepted_responder: bool = False
    # Shown only to the responder who accepts (the situation and a short description also go with the invitation).
    contact_phone: str | None = None
    situation: str | None = None
    description: str | None = None
    area: str | None = None


class NearbyResponder(CamelModel):
    responder_id: str
    display_name: str
    skills: list[str]
    approximate_distance_meters: int


class ResponderApplication(CamelModel):
    """A signed-in user's application to become a responder, after the courses. The phone is the account's own."""

    display_name: str | None = None
    commitment: bool = False  # "I only accept a request I can really go to", ticked on the form


class LocationUpdate(CamelModel):
    latitude: float
    longitude: float
