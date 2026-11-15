"""Transactional email through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).

Sent synchronously with a short timeout: on Vercel a function may be frozen as soon as the response is out, so a
background task could never run. A failure is logged and reported to the caller as False; it never undoes the action
that triggered the email. Without RESEND_API_KEY (local dev, tests) nothing is sent and the message is logged.
"""

import html
import logging

import httpx

from app.core.config import get_settings

log = logging.getLogger("app.mail")

RESEND_URL = "https://api.resend.com/emails"
TIMEOUT = httpx.Timeout(5.0, connect=3.0)
FOOTER = "Trong nguy hiểm tính mạng, hãy gọi ngay 115."


def send(to: str, subject: str, paragraphs: list[str], link: tuple[str, str] | None = None) -> bool:
    """Sends a short plain email (paragraphs and an optional (label, url) button). True when Resend accepted it."""
    s = get_settings()
    text = "\n\n".join([*paragraphs, *([f"{link[0]}: {link[1]}"] if link else []), FOOTER])
    if not s.resend_api_key:
        log.warning("Email delivery is not configured (RESEND_API_KEY). Would send %r to %s:\n%s", subject, to, text)
        return False
    body = "".join(f"<p>{html.escape(p)}</p>" for p in paragraphs)
    if link:
        label, url = (html.escape(part, quote=True) for part in link)
        body += (
            f'<p><a href="{url}" style="display:inline-block;padding:10px 18px;border-radius:999px;'
            f'background:#da361a;color:#fff;font-weight:700;text-decoration:none">{label}</a></p>'
        )
    body += f'<p style="color:#666;font-size:13px">{html.escape(FOOTER)}</p>'
    try:
        response = httpx.post(
            RESEND_URL,
            headers={"Authorization": f"Bearer {s.resend_api_key}"},
            json={"from": s.mail_from, "to": [to], "subject": subject, "text": text, "html": body},
            timeout=TIMEOUT,
        )
        response.raise_for_status()
        return True
    except httpx.HTTPError:
        log.warning("Could not send %r", subject, exc_info=True)
        return False
