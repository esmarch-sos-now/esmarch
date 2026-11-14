"""Optional, data-minimal FCM delivery for responders who have closed the app."""

from __future__ import annotations

import json
import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.db import get_engine
from app.modules.support.models import ResponderDevice

log = logging.getLogger(__name__)
_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="support-fcm")
_firebase_lock = threading.Lock()


def send_request(responder_id: str, request: dict[str, Any]) -> None:
    settings = get_settings()
    if not settings.fcm_configured:
        return
    request_id = str(request.get("id", ""))
    area = str(request.get("area", ""))
    if not request_id or not area:
        return
    _executor.submit(_send, responder_id, request_id, area)


def _send(responder_id: str, request_id: str, area: str) -> None:
    try:
        import firebase_admin
        from firebase_admin import credentials, messaging

        with Session(get_engine()) as session:
            devices = session.exec(select(ResponderDevice).where(ResponderDevice.responder_id == responder_id)).all()
            if not devices:
                return
            account = json.loads(get_settings().fcm_service_account_json)
            with _firebase_lock:
                try:
                    app = firebase_admin.get_app("sos-now")
                except ValueError:
                    app = firebase_admin.initialize_app(credentials.Certificate(account), name="sos-now")

            data = {
                "type": "request.new",
                "requestId": request_id,
                "area": area,
                "title": "Có yêu cầu SOS mới",
                "body": f"Có người cần hỗ trợ tại {area}. Mở ứng dụng để xem.",
                "url": f"/app/san-sang-ho-tro?requestId={request_id}",
            }
            messages = [
                messaging.Message(
                    token=device.token,
                    data=data,
                    webpush=messaging.WebpushConfig(headers={"TTL": "120"}),
                )
                for device in devices
            ]
            for start in range(0, len(messages), 500):
                batch = devices[start : start + 500]
                result = messaging.send_each(messages[start : start + 500], app=app)
                stale = [
                    batch[index]
                    for index, item in enumerate(result.responses)
                    if not item.success and isinstance(item.exception, messaging.UnregisteredError)
                ]
                for device in stale:
                    session.delete(device)
                if stale:
                    session.commit()
    except Exception as exc:
        # Push delivery is best-effort; don't fail SOS creation or log device tokens/private request data.
        log.warning("FCM delivery failed (%s).", type(exc).__name__)
