"""Transactional email through the official Resend SDK. Runs in a background task after the response."""

import html
import logging

import resend
from resend.exceptions import ResendError

from app.core.config import get_settings
from app.modules.auth.models import CodePurpose

log = logging.getLogger("app.auth.mail")

_SUBJECT = {
    CodePurpose.VERIFY_EMAIL: "Mã xác nhận tài khoản SOS NOW",
    CodePurpose.RESET_PASSWORD: "Mã đặt lại mật khẩu SOS NOW",
}
_INTRO = {
    CodePurpose.VERIFY_EMAIL: "Dùng mã dưới đây để xác nhận địa chỉ email và hoàn tất đăng ký tài khoản SOS NOW.",
    CodePurpose.RESET_PASSWORD: "Dùng mã dưới đây để đặt lại mật khẩu tài khoản SOS NOW của bạn.",
}
_FOOTER = "Nếu bạn không yêu cầu, hãy bỏ qua email này. Trong nguy hiểm tính mạng, hãy gọi ngay 115."


def _send(to: str, subject: str, text: str, body_html: str) -> None:
    s = get_settings()
    if not s.resend_api_key:
        if s.auth_dev_log_codes:
            log.warning("Email delivery disabled (no RESEND_API_KEY). Would send %r:\n%s", subject, text)
        else:
            log.error("Email delivery is not configured; set RESEND_API_KEY.")
        return
    resend.api_key = s.resend_api_key
    params: resend.Emails.SendParams = {
        "from": s.resend_from,
        "to": [to],
        "subject": subject,
        "text": text,
        "html": body_html,
    }
    try:
        resend.Emails.send(params)
    except ResendError:
        log.exception("Resend rejected an email (%s).", subject)  # no recipient in logs


def _layout(heading: str, paragraphs: list[str], code: str | None = None) -> str:
    parts = [f'<p style="margin:0 0 16px">{html.escape(p)}</p>' for p in paragraphs]
    if code is not None:
        parts.insert(
            1,
            '<p style="margin:24px 0;font:700 32px/1 monospace;letter-spacing:8px;color:#da361a">'
            f"{html.escape(code)}</p>",
        )
    return (
        '<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#2a2929">'
        f'<h1 style="font-size:20px">{html.escape(heading)}</h1>{"".join(parts)}'
        f'<p style="margin-top:32px;font-size:13px;color:#5f5f5f">{html.escape(_FOOTER)}</p></div>'
    )


def send_code(to: str, purpose: CodePurpose, code: str, minutes: int) -> None:
    subject = _SUBJECT[purpose]
    validity = f"Mã có hiệu lực trong {minutes} phút. Không chia sẻ mã này với bất kỳ ai."
    text = f"{_INTRO[purpose]}\n\n{code}\n\n{validity}\n\n{_FOOTER}"
    _send(to, subject, text, _layout(subject, [_INTRO[purpose], validity], code))


def send_already_registered(to: str) -> None:
    subject = "Bạn đã có tài khoản SOS NOW"
    lines = [
        "Có người vừa dùng email này để đăng ký SOS NOW, nhưng email đã có tài khoản.",
        "Hãy đăng nhập, hoặc dùng “Quên mật khẩu” nếu bạn không nhớ mật khẩu.",
    ]
    _send(to, subject, "\n\n".join([*lines, _FOOTER]), _layout(subject, lines))
