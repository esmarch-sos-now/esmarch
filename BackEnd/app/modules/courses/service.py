"""Course access and progress.

The courses are open to every signed-in account: finishing them is the first step to becoming a responder
(`requirement`, checked again by `/api/support/me/application`). Anonymous callers get 401 from the router. Progress
rows are upserted when a lesson quiz is passed; a course is complete when every lesson has a row. Completed courses are
also part of the responder's profile (`completed_courses`, used by `/api/support/me` and the requester's view of the
responder).

Quizzes are generated per attempt from the spreadsheet question bank (`quiz.py`). Attempts are not stored: `new_quiz`
signs (user, course, lesson, nonce, bank version, expiry) into a token, and `submit_quiz` verifies it and regenerates
the same questions to grade them. The seed is derived from the nonce with the server secret, so the answer key cannot be
computed from the token. A token is graded once (the graded nonce is a row in `course_quiz_attempts`, so this holds
across serverless instances), expires after QUIZ_TOKEN_TTL_SECONDS, and a token from an older version of the
spreadsheet gets 409.

The quiz of a lesson not yet passed only opens once its video has been watched: the player reports how far it got
(`watch`), and the server lets that grow by no more than the real time between two reports, so the video has to
actually play. A failed quiz tells which answers were wrong but not the right ones (those come with a pass), and
MAX_FAILED_QUIZZES failures in a row reset the video. A lesson already passed is open for review without limits.
"""

import base64
import hashlib
import hmac
import logging
import math
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
from app.modules.courses.models import CourseProgress, CourseQuizAttempt, LessonWatch
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
    WatchReport,
)
from app.modules.support.models import Responder

log = logging.getLogger("app.courses")

QUIZ_TOKEN_TTL_SECONDS = 2 * 3600  # time to watch the video and answer; a new quiz can always be requested
_FALLBACK_KEY = secrets.token_hex(32)
REQUIRED_COURSES = COURSES  # a responder finishes every course before applying

WATCH_REQUIRED = 0.9  # share of the video to watch before the quiz of a new lesson opens
# A report may move the watched point by the real time since the previous report, counted up to WATCH_MAX_GAP_SECONDS
# (the player reports when playback starts and every few seconds while it plays). No extra slack: a burst of reports
# must not add up, and the WATCH_REQUIRED margin already absorbs network jitter.
WATCH_MAX_GAP_SECONDS = 15
MAX_FAILED_QUIZZES = 2  # failed quizzes in a row before the video has to be watched again

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
        seconds=lesson.video.seconds,
    )


def _required_seconds(lesson: Lesson) -> int:
    return math.ceil(lesson.video.seconds * WATCH_REQUIRED)


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

    def _watches(self, session: Session, user_id: str) -> dict[str, LessonWatch]:
        """The user's video progress by lesson, in one query."""
        rows = session.exec(select(LessonWatch).where(LessonWatch.user_id == user_id)).all()
        return {row.lesson_id: row for row in rows}

    def _lesson_view(self, lesson: Lesson, progress: CourseProgress | None, watch: LessonWatch | None) -> LessonView:
        completed = progress is not None
        watched = completed or (watch is not None and watch.watched_at is not None)
        return LessonView(
            id=lesson.id,
            title=lesson.title,
            summary=lesson.summary,
            minutes=lesson.minutes,
            video=_video(lesson),
            # The key points sum up the video: they come after it, not instead of it.
            sections=[
                SectionView(heading=s.heading, paragraphs=list(s.paragraphs), bullets=list(s.bullets))
                for s in lesson.sections
            ]
            if watched
            else [],
            completed=completed,
            quiz_score=progress.quiz_score if progress is not None else None,
            watched_seconds=min(watch.seconds, lesson.video.seconds) if watch is not None else 0,
            required_seconds=_required_seconds(lesson),
            watched=watched,
        )

    def _course_view(
        self, course: Course, done: dict[str, CourseProgress], watches: dict[str, LessonWatch] | None = None
    ) -> CourseView:
        watches = watches or {}
        lessons = [self._lesson_view(lesson, done.get(lesson.id), watches.get(lesson.id)) for lesson in course.lessons]
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
        watches = self._watches(session, user.id)
        return CourseOverview(
            responder_name=profile.display_name if profile is not None and verified else None,
            responder_skills=sorted(profile.skills) if profile is not None and verified else [],
            courses=[self._course_view(course, done.get(course.id, {}), watches) for course in COURSES],
            completed_courses=self._finished_courses(done),
        )

    def watch(
        self, session: Session, user: AuthUser, course_id: str, lesson_id: str, report: WatchReport
    ) -> LessonView:
        """Record how far the lesson video has played. The stored point never goes back and only moves forward by the
        real time since the previous report, so it cannot run ahead of an actual playback."""
        course = self._course(course_id)
        lesson = self._lesson(course, lesson_id)
        key = f"{user.id}:{lesson.id}"
        now = clock.now()
        row = session.get(LessonWatch, key)
        if row is None:
            row = LessonWatch(id=key, user_id=user.id, lesson_id=lesson.id, seconds=0, reported_at=now)
            session.add(row)
            elapsed = 0.0
        else:
            elapsed = max(0.0, (now - row.reported_at).total_seconds())
        allowed = row.seconds + min(elapsed, WATCH_MAX_GAP_SECONDS)
        row.seconds = min(max(row.seconds, min(report.seconds, allowed)), float(lesson.video.seconds))
        row.reported_at = now
        if row.watched_at is None and row.seconds >= _required_seconds(lesson):
            row.watched_at = now
        session.commit()
        session.refresh(row)
        return self._lesson_view(lesson, session.get(CourseProgress, key), row)

    def _open_quiz(
        self, session: Session, user_id: str, lesson: Lesson
    ) -> tuple[CourseProgress | None, LessonWatch | None]:
        """The lesson's progress and watch rows; 403 while the quiz of a lesson not yet passed is still closed."""
        key = f"{user_id}:{lesson.id}"
        progress = session.get(CourseProgress, key)
        watch = session.get(LessonWatch, key)
        if progress is None and (watch is None or watch.watched_at is None):
            raise error(403, "Hãy xem hết video của bài học trước khi làm bài kiểm tra.")
        return progress, watch

    def _questions(self, bank: QuestionBank, lesson: Lesson, seed: int) -> list[GeneratedQuestion]:
        questions = generate_quiz(bank, lesson.id, lesson.bank_topics, seed)
        if len(questions) < QUIZ_SIZE:  # the sheet lost the lesson's rows: a shorter quiz must not pass the lesson
            log.warning("Lesson %s: %d of %d questions from the question bank", lesson.id, len(questions), QUIZ_SIZE)
            raise error(503, "Chưa có câu hỏi cho bài học này.")
        return questions

    def new_quiz(self, session: Session, user: AuthUser, course_id: str, lesson_id: str) -> QuizView:
        course = self._course(course_id)
        lesson = self._lesson(course, lesson_id)
        self._open_quiz(session, user.id, lesson)
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
        progress, watch = self._open_quiz(session, user.id, lesson)  # a reset since the quiz was issued closes it
        bank = _bank()
        if ticket.version != bank.version:
            raise error(409, "Bộ câu hỏi vừa được cập nhật. Hãy làm bộ câu hỏi mới.")
        quiz = self._questions(bank, lesson, ticket.seed)
        require(len(answers) == len(quiz), "Answer every question before submitting.")
        for answer, question in zip(answers, quiz, strict=True):
            require(0 <= answer < len(question.options), "Invalid answer.")
        # Each quiz is graded once (a pass reveals the answers, and failures are counted); a retry starts a new quiz.
        if not _claim(session, ticket):
            raise error(409, "Bộ câu hỏi này đã được chấm. Hãy làm bộ câu hỏi mới.")

        correct = [answer == question.answer for answer, question in zip(answers, quiz, strict=True)]
        correct_count = sum(correct)
        passed = correct_count == len(quiz)
        # A failed quiz says which answers were wrong, not the right ones: those would make the next try a lookup.
        results = [
            QuizAnswerResult(
                question_id=question.id,
                correct=ok,
                correct_index=question.answer if passed else None,
                explanation=question.explanation if passed else None,
            )
            for ok, question in zip(correct, quiz, strict=True)
        ]

        attempts_left: int | None = None
        if progress is None and watch is not None:  # a new lesson (a passed one is open for review)
            if passed:
                watch.failed_quizzes = 0
            else:
                watch.failed_quizzes += 1
                attempts_left = max(0, MAX_FAILED_QUIZZES - watch.failed_quizzes)
                if attempts_left == 0:  # watch the video again before the next try
                    watch.seconds = 0
                    watch.watched_at = None
                    watch.failed_quizzes = 0
                    watch.reported_at = clock.now()
            session.commit()

        if passed:
            key = f"{user.id}:{lesson.id}"
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
            attempts_left=attempts_left,
            course=self._course_view(
                course, self._progress(session, user.id).get(course.id, {}), self._watches(session, user.id)
            ),
        )


course_service = CourseService()
