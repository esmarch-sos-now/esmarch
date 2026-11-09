from fastapi import APIRouter

from app.common.checks import contains_phrase, require, text
from app.modules.guides.schemas import Audience, GuideView, Language, MediaFormat, VideoQuestion
from app.modules.guides.service import catalog

router = APIRouter(prefix="/api", tags=["guides"])


@router.get("/guides", response_model=list[GuideView])
def guides(locale: str = "vi", audience: Audience = Audience.ADULT, featured: bool = False):
    return catalog.all(locale, audience, featured)


@router.get("/guides/{scenario_id}", response_model=GuideView)
def guide(scenario_id: str, locale: str = "vi", audience: Audience = Audience.ADULT):
    return catalog.get(scenario_id, locale, audience)


@router.get("/locales", response_model=list[Language])
def locales():
    return catalog.languages()


@router.get("/wear/guides/{scenario_id}")
def watch(scenario_id: str, locale: str = "vi", audience: Audience = Audience.ADULT) -> dict:
    g = catalog.get(scenario_id, locale, audience)
    return {
        "scenarioId": g.scenario_id,
        "title": g.title,
        "status": g.status,
        "locale": g.locale,
        "audience": g.audience,
        "emergencyNumber": "115",
        "steps": [{"number": s.number, "title": s.title, "text": s.text} for s in g.steps],
        "delivery": "CLIENT_COMPANION",
        "dispatchConnected": False,
    }


@router.post("/video/answers")
def answer(req: VideoQuestion) -> dict:
    question = text(req.question, 500, "question")
    import math

    require(
        req.position_seconds is None or (math.isfinite(req.position_seconds) and req.position_seconds >= 0),
        "Invalid playback position.",
    )
    g = catalog.get(req.scenario_id, req.locale, req.audience)
    if g.status != "READY":
        return {"status": "CONTENT_UNAVAILABLE", "requiresConfirmation": True}
    ranked = sorted(
        ((sum(contains_phrase(question, k) for k in s.keywords), s) for s in g.steps),
        key=lambda x: -x[0],
    )
    if ranked[0][0] == 0 or (len(ranked) > 1 and ranked[0][0] == ranked[1][0]):
        return {"status": "NEEDS_CLARIFICATION", "requiresConfirmation": True}
    step = ranked[0][1]
    video = next((m for m in step.media if m.type == MediaFormat.VIDEO and m.start_seconds is not None), None)
    if video is None:
        return {"status": "VIDEO_UNAVAILABLE", "stepNumber": step.number, "text": step.text}
    return {
        "status": "MATCHED",
        "stepNumber": step.number,
        "text": step.text,
        "video": video.model_dump(by_alias=True),
        "seekToSeconds": video.start_seconds,
        "answerMode": "REVIEWED_CONTENT_LOOKUP",
        "requiresConfirmation": True,
    }
