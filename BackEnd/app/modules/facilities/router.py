from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.common.params import Lat, Limit, Lng, Radius
from app.core.db import get_session
from app.modules.facilities import service
from app.modules.facilities.schemas import FacilityOut

router = APIRouter(prefix="/api", tags=["facilities"])


# Distance fields are omitted (not null) when absent, as in the legacy contract.
@router.get("/facilities/nearby", response_model=list[FacilityOut], response_model_exclude_none=True)
def nearby(lat: Lat, lng: Lng, radius: Radius = 5000, limit: Limit = 5, session: Session = Depends(get_session)):
    return service.nearby(session, lat, lng, radius, limit)


@router.get("/facilities", response_model=list[FacilityOut], response_model_exclude_none=True)
def by_district(district: str = Query(...), session: Session = Depends(get_session)):
    return service.by_district(session, district)
