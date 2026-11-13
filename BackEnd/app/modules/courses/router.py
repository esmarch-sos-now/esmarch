from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.db import get_session
from app.modules.auth.deps import CurrentUser, require_auth_configured
from app.modules.courses.schemas import CourseOverview, QuizResult, QuizSubmission
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


@router.post("/{course_id}/lessons/{lesson_id}/quiz", response_model=QuizResult)
def quiz(course_id: str, lesson_id: str, submission: QuizSubmission, user: CurrentUser, session: Db) -> QuizResult:
    """Grade a lesson quiz and record the lesson as completed when every answer is correct."""
    return course_service.submit_quiz(session, user, course_id, lesson_id, submission.answers)
