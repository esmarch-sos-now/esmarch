"""Course access and progress.

The course is closed content for registered responders: `_responder` runs before every read or write, so a signed-in
user without a verified responder profile gets 403 and never receives lesson content. Progress rows are upserted when
a lesson quiz is passed; the course is complete when every lesson has a row. Completed courses are also part of the
responder's profile (`completed_courses`, used by `/api/support/me` and the requester's view of the responder), which
needs no responder check: it only reads the user's own progress rows.
"""

from dataclasses import dataclass
from datetime import datetime

from sqlmodel import Session, select

from app.common.checks import require, reviewed
from app.core import clock
from app.core.errors import error
from app.modules.auth.models import User
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
from app.modules.courses.models import CourseProgress
from app.modules.courses.schemas import (
    CompletedCourseView,
    CourseOverview,
    CourseView,
    LessonView,
    QuizAnswerResult,
    QuizQuestionView,
    QuizResult,
    SectionView,
    SourceView,
    VideoView,
)
from app.modules.support.models import Responder

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


def _finished_at(course: Course, done: dict[str, CourseProgress]) -> datetime | None:
    """When the last lesson was passed, or None while any lesson is still open."""
    if not course.lessons or any(lesson.id not in done for lesson in course.lessons):
        return None
    return max(done[lesson.id].completed_at for lesson in course.lessons)


@dataclass
class CourseService:
    def _responder(self, session: Session, user: User) -> Responder:
        profile = session.get(Responder, user.id)
        if profile is None:
            raise error(403, "Khóa học chỉ dành cho người đã đăng ký làm người hỗ trợ.")
        if not reviewed(profile.verified_at, clock.now()):
            raise error(403, "Hồ sơ người hỗ trợ chưa được xác minh.")
        return profile

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

    def _completed(self, session: Session, user_id: str, course: Course) -> dict[str, CourseProgress]:
        rows = session.exec(
            select(CourseProgress).where(
                CourseProgress.user_id == user_id,
                CourseProgress.course_id == course.id,
            )
        ).all()
        return {row.lesson_id: row for row in rows}

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
            quiz=[QuizQuestionView(id=q.id, question=q.question, options=list(q.options)) for q in lesson.quiz],
            completed=progress is not None,
            quiz_score=progress.quiz_score if progress is not None else None,
        )

    def _course_view(self, session: Session, user: User, course: Course) -> CourseView:
        done = self._completed(session, user.id, course)
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
        rows = session.exec(select(CourseProgress).where(CourseProgress.user_id == user_id)).all()
        done: dict[str, dict[str, CourseProgress]] = {}
        for row in rows:
            done.setdefault(row.course_id, {})[row.lesson_id] = row
        finished = [
            (at, course) for course in COURSES if (at := _finished_at(course, done.get(course.id, {}))) is not None
        ]
        finished.sort(key=lambda item: item[0])
        return [
            CompletedCourseView(id=course.id, title=course.title, badge=course.badge, completed_at=at)
            for at, course in finished
        ]

    def overview(self, session: Session, user: User) -> CourseOverview:
        profile = self._responder(session, user)
        return CourseOverview(
            responder_name=profile.display_name,
            responder_skills=sorted(profile.skills),
            courses=[self._course_view(session, user, course) for course in COURSES],
            completed_courses=self.completed_courses(session, user.id),
        )

    def submit_quiz(
        self, session: Session, user: User, course_id: str, lesson_id: str, answers: list[int]
    ) -> QuizResult:
        self._responder(session, user)
        course = self._course(course_id)
        lesson = self._lesson(course, lesson_id)
        require(len(answers) == len(lesson.quiz), "Answer every question before submitting.")
        for answer, question in zip(answers, lesson.quiz, strict=True):
            require(0 <= answer < len(question.options), "Invalid answer.")

        results = [
            QuizAnswerResult(
                question_id=question.id,
                correct=answer == question.answer,
                correct_index=question.answer,
                explanation=question.explanation,
            )
            for answer, question in zip(answers, lesson.quiz, strict=True)
        ]
        correct_count = sum(result.correct for result in results)
        passed = correct_count == len(lesson.quiz)

        if passed:
            key = f"{user.id}:{lesson.id}"
            progress = session.get(CourseProgress, key)
            now = clock.now()
            if progress is None:
                session.add(
                    CourseProgress(
                        id=key,
                        user_id=user.id,
                        course_id=course.id,
                        lesson_id=lesson.id,
                        quiz_score=correct_count,
                        completed_at=now,
                    )
                )
            else:
                progress.quiz_score = max(progress.quiz_score, correct_count)
                progress.completed_at = now
            session.commit()

        return QuizResult(
            passed=passed,
            correct_count=correct_count,
            total=len(lesson.quiz),
            results=results,
            course=self._course_view(session, user, course),
        )


course_service = CourseService()
