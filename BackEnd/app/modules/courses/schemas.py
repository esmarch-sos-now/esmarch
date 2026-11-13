from datetime import datetime

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
    sections: list[SectionView]
    quiz: list[QuizQuestionView]
    completed: bool
    quiz_score: int | None = None


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
    responder_name: str
    responder_skills: list[str]
    courses: list[CourseView]
    completed_courses: list[CompletedCourseView]


class QuizSubmission(CamelModel):
    answers: list[int]


class QuizAnswerResult(CamelModel):
    question_id: str
    correct: bool
    correct_index: int
    explanation: str


class QuizResult(CamelModel):
    passed: bool
    correct_count: int
    total: int
    results: list[QuizAnswerResult]
    course: CourseView
