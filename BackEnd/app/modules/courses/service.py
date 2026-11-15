"""Course access and progress.

The courses are open to every signed-in account: finishing them is the first step to becoming a responder
(`requirement`, checked again by `/api/support/me/application`). Anonymous callers get 401 from the router. Progress
rows are upserted when a lesson quiz is passed; a course is complete when every lesson has a row. Completed courses are
also part of the responder's profile (`completed_courses`, used by `/api/support/me` and the requester's view of the
responder).

Quizzes are generated per attempt from the spreadsheet question bank (`quiz.py`). Attempts are not stored: `new_quiz`
signs (user, course, lesson, nonce, bank version, expiry) into a token, and `submit_quiz` verifies it and regenerates
the same questions to grade them. The seed is derived from the nonce with the server secret, so the answer key cannot be
computed from the token. A token is graded once (the result reveals the correct answers; the graded nonce is a row in
`course_quiz_attempts`, so this holds across serverless instances), expires after QUIZ_TOKEN_TTL_SECONDS, and a token
from an older version of the spreadsheet gets 409.
"""

import base64
import hashlib
import hmac
import logging
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from sqlmodel import Session, col, select

from app.common.checks import require, reviewed
from app.core import clock
from app.core.config import get_settings
from app.core.errors import error
from app.modules.auth.security import AuthUser
from app.modules.courses.content import (
    COURSES,
    DISCLAIMER,
    SOURCE_CHANNEL_URL,
    SOURCE_NAME,
    SOURCE_NOTE,
    SOURCE_PLAYLIST_TITLE,
    SOURCE_PLAYLIST_URL,
    Course,
    Lesson,
)
from app.modules.courses.models import CourseProgress, CourseQuizAttempt
from app.modules.courses.question_bank import QuestionBank, QuestionBankError, load_bank
from app.modules.courses.quiz import QUIZ_SIZE, GeneratedQuestion, generate_quiz
from app.modules.courses.schemas import (
    CompletedCourseView,
    CourseOverview,
    CourseView,
    LessonView,
    QuizAnswerResult,
    QuizQuestionView,
    QuizResult,
    QuizView,
    SectionView,
    SourceView,
    VideoView,
)
from app.modules.support.models import Responder

log = logging.getLogger("app.courses")

QUIZ_TOKEN_TTL_SECONDS = 2 * 3600  # time to watch the video and answer; a new quiz can always be requested
_FALLBACK_KEY = secrets.token_hex(32)
REQUIRED_COURSES = COURSES  # a responder finishes every course before applying

SOURCE = SourceView(
    name=SOURCE_NAME,
    channel_url=SOURCE_CHANNEL_URL,
    playlist_url=SOURCE_PLAYLIST_URL,
    playlist_title=SOURCE_PLAYLIST_TITLE,
    note=SOURCE_NOTE,
)


def _video(lesson: Lesson) -> VideoView:
    vid = lesson.video.youtube_id
    return VideoView(
        youtube_id=vid,
        title=lesson.video.title,
        url=f"https://www.youtube.com/watch?v={vid}",
        embed_url=f"https://www.youtube-nocookie.com/embed/{vid}?rel=0",
    )


def _bank() -> QuestionBank:
    try:
        return load_bank(get_settings().course_question_bank_file)
    except QuestionBankError as exc:
        log.warning("Course question bank unavailable: %s", exc)
        raise error(503, "Chưa tải được bộ câu hỏi sơ cứu.") from exc


def _mac(purpose: str, message: str) -> bytes:
    # Without a configured secret (local dev), a random per-process key: tokens then only last as long as the process.
    key = (get_settings().course_quiz_key or _FALLBACK_KEY).encode()
    return hmac.new(key, f"course-quiz-{purpose}:{message}".encode(), hashlib.sha256).digest()


@dataclass(frozen=True)
class QuizTicket:
    """The verified content of a quiz token."""

    nonce: str
    version: str  # question bank version the quiz was generated from
    expires_at: int  # Unix seconds

    @property
    def seed(self) -> int:
        """Derived with the server secret: the token alone does not give away the answer key."""
        return int.from_bytes(_mac("seed", self.nonce)[:8], "big")


def _token(user_id: str, course_id: str, lesson_id: str, version: str) -> tuple[str, QuizTicket]:
    ticket = QuizTicket(
        nonce=secrets.token_urlsafe(16),
        version=version,
        expires_at=int(clock.now().timestamp()) + QUIZ_TOKEN_TTL_SECONDS,
    )
    payload = "|".join((user_id, course_id, lesson_id, ticket.nonce, ticket.version, str(ticket.expires_at)))
    encoded = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
    return f"{encoded}.{_mac('sign', payload).hex()}", ticket


def _read_token(token: str, user_id: str, course_id: str, lesson_id: str) -> QuizTicket:
    """The ticket of a token issued to this user for this lesson: 400 when invalid, 409 when expired."""
    ticket = None
    try:
        encoded, signature = token.split(".", 1)
        payload = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)).decode()
        if hmac.compare_digest(signature.encode(), _mac("sign", payload).hex().encode()):
            owner, course, lesson, nonce, version, expires_at = payload.split("|")
            if (owner, course, lesson) == (user_id, course_id, lesson_id):
                ticket = QuizTicket(nonce=nonce, version=version, expires_at=int(expires_at))
    except ValueError:  # malformed: bad base64 or UTF-8 (both ValueError), wrong field count
        pass
    if ticket is None:
        raise error(400, "Invalid quiz token.")
    if clock.now().timestamp() >= ticket.expires_at:
        raise error(409, "Bộ câu hỏi đã hết hạn. Hãy làm bộ câu hỏi mới.")
    return ticket


def _claim(session: Session, ticket: QuizTicket) -> bool:
    """True the first time a ticket is graded, False on a replay. Expired nonces are pruned: their tokens get 409."""
    now = clock.now()
    session.exec(delete(CourseQuizAttempt).where(col(CourseQuizAttempt.expires_at) <= now))  # type: ignore[call-overload]
    claimed = session.exec(
        insert(CourseQuizAttempt)  # type: ignore[call-overload]
        .values(nonce=ticket.nonce, expires_at=datetime.fromtimestamp(ticket.expires_at, UTC))
        .on_conflict_do_nothing(index_elements=["nonce"])
        .returning(col(CourseQuizAttempt.nonce))
    ).first()
    session.commit()
    return claimed is not None


def _finished_at(course: Course, done: dict[str, CourseProgress]) -> datetime | None:
    """When the last lesson was passed, or None while any lesson is still open."""
    if not course.lessons or any(lesson.id not in done for lesson in course.lessons):
        return None
    return max(done[lesson.id].completed_at for lesson in course.lessons)


@dataclass
class CourseService:
    def _course(self, course_id: str) -> Course:
        course = next((c for c in COURSES if c.id == course_id), None)
        if course is None:
            raise error(404, "Course not found.")
        return course

    def _lesson(self, course: Course, lesson_id: str) -> Lesson:
        lesson = next((lesson for lesson in course.lessons if lesson.id == lesson_id), None)
        if lesson is None:
            raise error(404, "Lesson not found.")
        return lesson

    def _progress(self, session: Session, user_id: str) -> dict[str, dict[str, CourseProgress]]:
        """The user's progress rows by course and lesson, in one query."""
        rows = session.exec(select(CourseProgress).where(CourseProgress.user_id == user_id)).all()
        done: dict[str, dict[str, CourseProgress]] = {}
        for row in rows:
            done.setdefault(row.course_id, {})[row.lesson_id] = row
        return done

    def _lesson_view(self, lesson: Lesson, progress: CourseProgress | None) -> LessonView:
        return LessonView(
            id=lesson.id,
            title=lesson.title,
            summary=lesson.summary,
            minutes=lesson.minutes,
            video=_video(lesson),
            sections=[
                SectionView(heading=s.heading, paragraphs=list(s.paragraphs), bullets=list(s.bullets))
                for s in lesson.sections
            ],
            completed=progress is not None,
            quiz_score=progress.quiz_score if progress is not None else None,
        )

    def _course_view(self, course: Course, done: dict[str, CourseProgress]) -> CourseView:
        lessons = [self._lesson_view(lesson, done.get(lesson.id)) for lesson in course.lessons]
        completed_lessons = sum(1 for lesson in course.lessons if lesson.id in done)
        next_lesson = next((lesson.id for lesson in lessons if not lesson.completed), None)
        return CourseView(
            id=course.id,
            title=course.title,
            summary=course.summary,
            audience=course.audience,
            badge=course.badge,
            disclaimer=DISCLAIMER,
            lesson_count=len(lessons),
            completed_lessons=completed_lessons,
            progress_percent=round(completed_lessons / len(lessons) * 100) if lessons else 0,
            completed=next_lesson is None and bool(lessons),
            completed_at=_finished_at(course, done),
            next_lesson_id=next_lesson,
            source=SOURCE,
            lessons=lessons,
        )

    def completed_courses(self, session: Session, user_id: str) -> list[CompletedCourseView]:
        """Courses whose every lesson the user has passed, oldest completion first. No responder check."""
        return self._finished_courses(self._progress(session, user_id))

    def _finished_courses(self, done: dict[str, dict[str, CourseProgress]]) -> list[CompletedCourseView]:
        finished = [
            (at, course) for course in COURSES if (at := _finished_at(course, done.get(course.id, {}))) is not None
        ]
        finished.sort(key=lambda item: item[0])
        return [
            CompletedCourseView(id=course.id, title=course.title, badge=course.badge, completed_at=at)
            for at, course in finished
        ]

    def requirement(self, session: Session, user_id: str) -> dict[str, Any]:
        """Progress through the courses a responder must finish (all of them), for the onboarding steps."""
        done = self._progress(session, user_id)
        courses = [self._course_view(course, done.get(course.id, {})) for course in REQUIRED_COURSES]
        return {
            "done": sum(c.completed_lessons for c in courses),
            "total": sum(c.lesson_count for c in courses),
            "complete": all(c.completed for c in courses),
            "courses": [
                {
                    "id": c.id,
                    "title": c.title,
                    "completed": c.completed,
                    "completedLessons": c.completed_lessons,
                    "lessonCount": c.lesson_count,
                    "nextLessonId": c.next_lesson_id,
                }
                for c in courses
            ],
        }

    def overview(self, session: Session, user: AuthUser) -> CourseOverview:
        profile = session.get(Responder, user.id)
        verified = profile is not None and reviewed(profile.verified_at, clock.now())
        done = self._progress(session, user.id)
        return CourseOverview(
            responder_name=profile.display_name if profile is not None and verified else None,
            responder_skills=sorted(profile.skills) if profile is not None and verified else [],
            courses=[self._course_view(course, done.get(course.id, {})) for course in COURSES],
            completed_courses=self._finished_courses(done),
        )

    def _questions(self, bank: QuestionBank, lesson: Lesson, seed: int) -> list[GeneratedQuestion]:
        questions = generate_quiz(bank, lesson.id, lesson.bank_topics, seed)
        if len(questions) < QUIZ_SIZE:  # the sheet lost the lesson's rows: a shorter quiz must not pass the lesson
            log.warning("Lesson %s: %d of %d questions from the question bank", lesson.id, len(questions), QUIZ_SIZE)
            raise error(503, "Chưa có câu hỏi cho bài học này.")
        return questions

    def new_quiz(self, session: Session, user: AuthUser, course_id: str, lesson_id: str) -> QuizView:
        course = self._course(course_id)
        lesson = self._lesson(course, lesson_id)
        bank = _bank()
        token, ticket = _token(user.id, course.id, lesson.id, bank.version)
        questions = self._questions(bank, lesson, ticket.seed)
        return QuizView(
            token=token,
            questions=[QuizQuestionView(id=q.id, question=q.question, options=list(q.options)) for q in questions],
        )

    def submit_quiz(
        self, session: Session, user: AuthUser, course_id: str, lesson_id: str, token: str, answers: list[int]
    ) -> QuizResult:
        course = self._course(course_id)
        lesson = self._lesson(course, lesson_id)
        ticket = _read_token(token, user.id, course.id, lesson.id)
        bank = _bank()
        if ticket.version != bank.version:
            raise error(409, "Bộ câu hỏi vừa được cập nhật. Hãy làm bộ câu hỏi mới.")
        quiz = self._questions(bank, lesson, ticket.seed)
        require(len(answers) == len(quiz), "Answer every question before submitting.")
        for answer, question in zip(answers, quiz, strict=True):
            require(0 <= answer < len(question.options), "Invalid answer.")
        # Grading reveals the correct answers, so each quiz is graded once; a retry starts a new quiz.
        if not _claim(session, ticket):
            raise error(409, "Bộ câu hỏi này đã được chấm. Hãy làm bộ câu hỏi mới.")

        results = [
            QuizAnswerResult(
                question_id=question.id,
                correct=answer == question.answer,
                correct_index=question.answer,
                explanation=question.explanation,
            )
            for answer, question in zip(answers, quiz, strict=True)
        ]
        correct_count = sum(result.correct for result in results)
        passed = correct_count == len(quiz)

        if passed:
            key = f"{user.id}:{lesson.id}"
            progress = session.get(CourseProgress, key)
            if progress is None:
                session.add(
                    CourseProgress(
                        id=key,
                        user_id=user.id,
                        course_id=course.id,
                        lesson_id=lesson.id,
                        quiz_score=correct_count,
                        completed_at=clock.now(),
                    )
                )
            else:
                # Keep the first completion date: redoing a lesson must not move the course's completion date.
                progress.quiz_score = max(progress.quiz_score, correct_count)
            session.commit()

        return QuizResult(
            passed=passed,
            correct_count=correct_count,
            total=len(quiz),
            results=results,
            course=self._course_view(course, self._progress(session, user.id).get(course.id, {})),
        )


course_service = CourseService()
