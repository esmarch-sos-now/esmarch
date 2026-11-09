from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.config import get_settings
from app.core.db import get_session
from app.modules.aeds.service import operational
from app.modules.facilities import catalog as facility_catalog
from app.modules.guides.schemas import Audience
from app.modules.guides.service import catalog as guides

router = APIRouter(prefix="/api", tags=["capabilities"])


@router.get("/capabilities")
def capabilities(session: Session = Depends(get_session)) -> dict:
    g = guides.all("vi", Audience.ADULT, True)
    return {
        "project": "Esmarch",
        "apiVersion": "0.2.0",
        "emergencyNumber": "115",
        "phase1": {
            "facilities": {"apiReady": True, "verifiedCount": len(facility_catalog.all_facilities(session))},
            "featuredScenarioIds": ["cardiac", "choking", "stroke"],
            "guides": [
                {"scenarioId": x.scenario_id, "status": x.status, "formats": [f.value for f in x.available_formats]}
                for x in g
            ],
        },
        "phase2": {
            "locales": [lang.model_dump(by_alias=True) for lang in guides.languages()],
            "audiences": [a.value for a in Audience],
            "watchDelivery": "CLIENT_COMPANION",
            "videoAnswers": "REVIEWED_CONTENT_LOOKUP",
            "aeds": {"apiReady": True, "verifiedOperationalCount": len(operational(session))},
        },
        "phase3": {
            "apiReady": True,
            "adminConfigured": get_settings().admin_configured,
            "delivery": "RESPONDER_POLLING",
            "presenceTtlSeconds": 300,
            "requestTtlSeconds": 600,
            "storage": "SINGLE_INSTANCE_MEMORY",
            "dispatchConnected": False,
        },
    }
