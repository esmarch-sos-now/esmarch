from app.common.schemas import CamelModel


class SectionView(CamelModel):
    heading: str
    paragraphs: list[str]
    bullets: list[str]


class QuizQuestionView(CamelModel):
    id: str
    question: str
    options: list[str]


class LessonView(CamelModel):
    id: str
    title: str
    summary: str
    minutes: int
    sections: list[SectionView]
    quiz: list[QuizQuestionView]
    completed: bool
    quiz_score: int | None = None


class CourseView(CamelModel):
    id: str
    title: str
    summary: str
    audience: str
    disclaimer: str
    lesson_count: int
    completed_lessons: int
    progress_percent: int
    completed: bool
    next_lesson_id: str | None
    lessons: list[LessonView]


class CourseOverview(CamelModel):
    responder_name: str
    responder_skills: list[str]
    courses: list[CourseView]


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
