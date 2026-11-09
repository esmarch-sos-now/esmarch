from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.common.params import Lat, Limit, Lng, Radius
from app.core.db import get_session
from app.modules.aeds import service
from app.modules.aeds.schemas import AedOut

router = APIRouter(prefix="/api/aeds", tags=["aeds"])


@router.get("/nearby", response_model=list[AedOut])
def nearby(lat: Lat, lng: Lng, radius: Radius = 5000, limit: Limit = 5, session: Session = Depends(get_session)):
    return service.find_nearby(session, lat, lng, radius, limit)
