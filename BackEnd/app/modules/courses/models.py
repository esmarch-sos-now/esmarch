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


class CourseQuizAttempt(SQLModel, table=True):
    """Nonce of a quiz token that was already graded, kept until the token expires (a token is graded once)."""

    __tablename__ = "course_quiz_attempts"  # pyrefly: ignore[bad-override]

    nonce: str = Field(primary_key=True, max_length=64)
    expires_at: datetime = Field(sa_column=tstz(nullable=False, index=True))
