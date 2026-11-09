from fastapi import APIRouter, Depends
from sqlmodel import Session, desc, select

from app.core import clock
from app.core.db import get_session
from app.modules.alerts.models import SosAlert
from app.modules.alerts.schemas import AlertIn, AlertOut

router = APIRouter(prefix="/api/alerts", tags=["alerts (legacy SOS Bump, stores location)"])


@router.get("", response_model=list[AlertOut])
def latest(session: Session = Depends(get_session)):
    return session.exec(select(SosAlert).order_by(desc(SosAlert.created_at)).limit(20)).all()


@router.post("", response_model=AlertOut, status_code=201)
def create(body: AlertIn, session: Session = Depends(get_session)):
    alert = SosAlert(
        scenario_id=body.scenario_id,
        latitude=body.latitude,
        longitude=body.longitude,
        note=body.note,
        created_at=clock.now(),
    )
    session.add(alert)
    session.commit()
    session.refresh(alert)
    return alert
