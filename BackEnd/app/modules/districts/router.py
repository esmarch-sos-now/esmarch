from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.db import get_session
from app.modules.districts import service

router = APIRouter(prefix="/api", tags=["districts"])


@router.get("/districts", response_model=list[str])
def districts(session: Session = Depends(get_session)):
    return service.all_districts(session)
