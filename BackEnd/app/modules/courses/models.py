from datetime import datetime

from sqlmodel import Field, SQLModel

from app.common.columns import tstz


class CourseProgress(SQLModel, table=True):
    """One row per user and completed lesson. IDs are "<user id>:<lesson id>" (the Supabase user id)."""

    __tablename__ = "course_progress"  # pyrefly: ignore[bad-override]

    id: str = Field(primary_key=True, max_length=100)
    user_id: str = Field(foreign_key="accounts.id", ondelete="CASCADE", index=True, max_length=36)
    course_id: str = Field(max_length=60)
    lesson_id: str = Field(max_length=60)
    quiz_score: int = 0
    completed_at: datetime = Field(sa_column=tstz(nullable=False))


class LessonWatch(SQLModel, table=True):
    """How far a user has watched a lesson video, and their failed quizzes since. IDs are "<user id>:<lesson id>".

    `seconds` is the furthest point reached by playing (the player does not let the learner skip ahead) and only grows
    by about the real time between two reports (see `service.CourseService.watch`). `watched_at` is set once
    WATCH_REQUIRED of the video is reached; until then the quiz of a lesson not yet passed stays closed. Too many
    failed quizzes in a row reset the row, so the video has to be watched again.
    """

    __tablename__ = "course_lesson_watch"  # pyrefly: ignore[bad-override]

    id: str = Field(primary_key=True, max_length=100)
    user_id: str = Field(foreign_key="accounts.id", ondelete="CASCADE", index=True, max_length=36)
    lesson_id: str = Field(max_length=60)
    seconds: float = 0
    reported_at: datetime = Field(sa_column=tstz(nullable=False))
    watched_at: datetime | None = Field(default=None, sa_column=tstz(nullable=True))
    failed_quizzes: int = 0


class CourseQuizAttempt(SQLModel, table=True):
    """Nonce of a quiz token that was already graded, kept until the token expires (a token is graded once)."""

    __tablename__ = "course_quiz_attempts"  # pyrefly: ignore[bad-override]

    nonce: str = Field(primary_key=True, max_length=64)
    expires_at: datetime = Field(sa_column=tstz(nullable=False, index=True))
