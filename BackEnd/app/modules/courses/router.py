from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.db import get_session
from app.modules.auth.deps import CurrentUser, require_auth_configured
from app.modules.courses.schemas import CourseOverview, LessonView, QuizResult, QuizSubmission, QuizView, WatchReport
from app.modules.courses.service import course_service

# Closed content: every route needs a signed-in user with a verified responder profile (checked in the service).
router = APIRouter(
    prefix="/api/courses",
    tags=["courses"],
    dependencies=[Depends(require_auth_configured)],
)
Db = Annotated[Session, Depends(get_session)]


@router.get("", response_model=CourseOverview)
def overview(user: CurrentUser, session: Db) -> CourseOverview:
    """Courses and progress of the signed-in responder. 403 when the user is not a registered responder."""
    return course_service.overview(session, user)


@router.post("/{course_id}/lessons/{lesson_id}/watch", response_model=LessonView)
def watch(course_id: str, lesson_id: str, report: WatchReport, user: CurrentUser, session: Db) -> LessonView:
    """How far the lesson video has played; returns the lesson (its quiz opens once enough of the video is watched)."""
    return course_service.watch(session, user, course_id, lesson_id, report)


@router.get("/{course_id}/lessons/{lesson_id}/quiz", response_model=QuizView)
def new_quiz(course_id: str, lesson_id: str, user: CurrentUser, session: Db) -> QuizView:
    """A new random set of questions for the lesson, generated from the first-aid spreadsheet. 403 until the video of
    a lesson not yet passed has been watched."""
    return course_service.new_quiz(session, user, course_id, lesson_id)


@router.post("/{course_id}/lessons/{lesson_id}/quiz", response_model=QuizResult)
def quiz(course_id: str, lesson_id: str, submission: QuizSubmission, user: CurrentUser, session: Db) -> QuizResult:
    """Grade the quiz issued with `token` and record the lesson as completed when every answer is correct."""
    return course_service.submit_quiz(session, user, course_id, lesson_id, submission.token, submission.answers)
