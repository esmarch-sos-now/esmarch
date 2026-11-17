from datetime import datetime

from pydantic import Field

from app.common.schemas import CamelModel


class SectionView(CamelModel):
    heading: str
    paragraphs: list[str]
    bullets: list[str]


class QuizQuestionView(CamelModel):
    id: str
    question: str
    options: list[str]


class VideoView(CamelModel):
    youtube_id: str
    title: str
    url: str
    embed_url: str
    seconds: int  # length of the video


class SourceView(CamelModel):
    """Credit for the videos: they belong to the source and are embedded from YouTube unchanged."""

    name: str
    channel_url: str
    playlist_url: str
    playlist_title: str
    note: str


class LessonView(CamelModel):
    id: str
    title: str
    summary: str
    minutes: int
    video: VideoView
    sections: list[SectionView]  # empty until the video has been watched (or the lesson passed)
    completed: bool
    quiz_score: int | None = None
    watched_seconds: float  # furthest point of the video reached by playing it
    required_seconds: int  # what must be watched before the quiz opens
    watched: bool  # the quiz is open: the video was watched, or the lesson was already passed


class CourseView(CamelModel):
    id: str
    title: str
    summary: str
    audience: str
    badge: str
    disclaimer: str
    lesson_count: int
    completed_lessons: int
    progress_percent: int
    completed: bool
    completed_at: datetime | None
    next_lesson_id: str | None
    source: SourceView
    lessons: list[LessonView]


class CompletedCourseView(CamelModel):
    """A finished course as recorded on the profile ("Đã hoàn thành khóa ...")."""

    id: str
    title: str
    badge: str
    completed_at: datetime


class CourseOverview(CamelModel):
    responder_name: str | None  # set once the user is a verified responder
    responder_skills: list[str]
    courses: list[CourseView]
    completed_courses: list[CompletedCourseView]


class QuizView(CamelModel):
    """A freshly generated quiz. `token` is signed and must be sent back with the answers."""

    token: str
    questions: list[QuizQuestionView]


class QuizSubmission(CamelModel):
    token: str = Field(max_length=1000)
    answers: list[int] = Field(max_length=50)  # bounded before grading; the exact count is checked there


class WatchReport(CamelModel):
    seconds: float = Field(ge=0, le=24 * 3600)  # furthest point of the video the player reached


class QuizAnswerResult(CamelModel):
    """`correct_index` and `explanation` are only sent once the quiz is passed: a failed quiz tells which answers were
    wrong, not what the right ones are."""

    question_id: str
    correct: bool
    correct_index: int | None
    explanation: str | None


class QuizResult(CamelModel):
    passed: bool
    correct_count: int
    total: int
    results: list[QuizAnswerResult]
    # Failed quizzes left before the video has to be watched again; None when the lesson is already passed (reviews
    # are not limited). 0 means this failure reset the video: `course` shows the lesson as not watched.
    attempts_left: int | None
    course: CourseView
