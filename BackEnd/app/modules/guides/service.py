import json
import threading
from pathlib import Path

from pydantic import TypeAdapter, ValidationError
from sqlmodel import Session, delete, select

from app.common.checks import https, locale, need, require, reviewed, text
from app.core import clock
from app.core.errors import error
from app.modules.guides.models import GuideRecord
from app.modules.guides.schemas import Audience, Guide, GuideView, Language, MediaFormat

IDS = ["cardiac", "choking", "stroke", "bleeding"]
TITLES = {
    "cardiac": ("Bất tỉnh hoặc ngừng thở", "Unresponsive or not breathing normally"),
    "choking": ("Hóc nghẹn", "Choking"),
    "stroke": ("Dấu hiệu đột quỵ", "Stroke signs"),
    "bleeding": ("Chảy máu nhiều", "Severe bleeding"),
}
_MIME = {MediaFormat.IMAGE: "image/", MediaFormat.VIDEO: "video/", MediaFormat.MODEL_3D: "model/gltf"}
_adapter = TypeAdapter(list[Guide])


class GuidanceCatalog:
    def __init__(self) -> None:
        self._guides: dict[str, Guide] = {}
        self._lock = threading.Lock()

    @staticmethod
    def _key(sid: str, lang: str, audience: Audience) -> str:
        return f"{sid}:{lang}:{audience.value}"

    def load_file(self, path: str, session: Session | None = None) -> None:
        p = Path(path)
        require(p.stat().st_size <= 5_000_000, "Guide file exceeds 5 MB.")
        try:
            rows = _adapter.validate_python(json.loads(p.read_text(encoding="utf-8")))
        except ValidationError:
            raise error(400, "Invalid guide catalog.") from None
        self.replace_reviewed(rows, session)

    def replace_reviewed(self, rows: list[Guide], session: Session | None = None) -> None:
        """Validate every guide first; replace the whole catalogue atomically."""
        require(0 < len(rows) <= 100, "Invalid guide catalog size.")
        now = clock.now()
        nxt: dict[str, Guide] = {}
        for g in rows:
            require(g.scenario_id in IDS, "Invalid guide identity.")
            lang = locale(g.locale)
            text(g.title, 200, "guide title")
            require(reviewed(g.reviewed_at, now), "Guide must have a completed clinical review.")
            text(g.reviewed_by, 200, "reviewedBy")
            require(bool(g.sources), "Guide sources are required.")
            for s in g.sources:
                text(s, 1000, "source")
            require(0 < len(g.steps) <= 50, "Invalid guide steps.")
            for number, step in enumerate(g.steps, start=1):
                require(step.number == number, "Guide steps must be sequential from 1.")
                text(step.title, 200, "step title")
                text(step.text, 3000, "step text")
                require(len(step.keywords) <= 30 and len(step.media) <= 10, "Invalid step metadata.")
                for term in step.keywords:
                    text(term, 100, "keyword")
                for m in step.media:
                    https(m.url)
                    text(m.alt, 500, "media alt")
                    require(
                        text(m.mime_type, 100, "mimeType").startswith(_MIME[m.type]),
                        "Media MIME type does not match format.",
                    )
                    if m.start_seconds is not None or m.end_seconds is not None:
                        require(
                            m.type == MediaFormat.VIDEO
                            and m.start_seconds is not None
                            and m.end_seconds is not None
                            and m.start_seconds >= 0
                            and m.end_seconds > m.start_seconds,
                            "Invalid video segment.",
                        )
            key = self._key(g.scenario_id, lang, g.audience)
            require(key not in nxt, "Duplicate guide identity.")
            nxt[key] = g.model_copy(update={"locale": lang})
        if session is not None:  # persist the validated catalogue; swap rows atomically
            session.exec(delete(GuideRecord))
            for key, g in nxt.items():
                session.add(
                    GuideRecord(
                        id=key,
                        scenario_id=g.scenario_id,
                        locale=g.locale,
                        audience=g.audience.value,
                        title=g.title,
                        steps=[st.model_dump(by_alias=True, mode="json") for st in g.steps],
                        reviewed_at=g.reviewed_at,
                        reviewed_by=g.reviewed_by,
                        sources=list(g.sources),
                    )
                )
            session.commit()
        with self._lock:
            self._guides = nxt

    def load_from_db(self, session: Session) -> None:
        """Refresh the in-memory snapshot from the guides table."""
        nxt: dict[str, Guide] = {}
        for r in session.exec(select(GuideRecord)).all():
            nxt[r.id] = Guide.model_validate(
                {
                    "scenarioId": r.scenario_id,
                    "locale": r.locale,
                    "audience": r.audience,
                    "title": r.title,
                    "steps": r.steps,
                    "reviewedAt": r.reviewed_at,
                    "reviewedBy": r.reviewed_by,
                    "sources": r.sources,
                }
            )
        with self._lock:
            self._guides = nxt

    def get(self, sid: str | None, lang: str | None, audience: Audience | None) -> GuideView:
        aud = need(audience, "Audience is required.")
        language = locale(lang)
        if sid is None or sid not in IDS:
            raise error(404, "Scenario not found.")
        found = self._guides.get(self._key(sid, language, aud))
        guide = found if found is not None and reviewed(found.reviewed_at, clock.now()) else None
        steps = guide.steps if guide else []
        formats: list[MediaFormat] = []
        for s in steps:
            for m in s.media:
                if m.type not in formats:
                    formats.append(m.type)
        return GuideView(
            scenario_id=sid,
            title=guide.title if guide else TITLES[sid][0 if language == "vi" else 1],
            locale=language,
            audience=aud,
            featured=sid != "bleeding",
            status="READY" if guide else "PENDING_REVIEW",
            steps=steps,
            available_formats=formats,
            reviewed_at=guide.reviewed_at if guide else None,
            sources=list(guide.sources) if guide else [],
        )

    def all(self, lang: str, audience: Audience, featured_only: bool) -> list[GuideView]:
        return [self.get(i, lang, audience) for i in IDS if not featured_only or i != "bleeding"]

    def languages(self) -> list[Language]:
        def reviewed_audiences(lang: str) -> list[Audience]:
            return [a for a in Audience if any(g.status == "READY" for g in self.all(lang, a, False))]

        return [
            Language(code="vi", name="Tiếng Việt", speech_locale="vi-VN", reviewed_audiences=reviewed_audiences("vi")),
            Language(code="en", name="English", speech_locale="en-US", reviewed_audiences=reviewed_audiences("en")),
        ]


catalog = GuidanceCatalog()
