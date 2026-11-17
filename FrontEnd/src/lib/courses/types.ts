export type CourseSection = { heading: string; paragraphs: string[]; bullets: string[] };

export type CourseQuizQuestion = { id: string; question: string; options: string[] };

/** A freshly generated quiz for one attempt; `token` must be sent back with the answers. */
export type LessonQuiz = { token: string; questions: CourseQuizQuestion[] };

/** One YouTube clip; `embedUrl` is the privacy-enhanced youtube-nocookie.com player URL, `seconds` its length. */
export type CourseVideo = { youtubeId: string; title: string; url: string; embedUrl: string; seconds: number };

/** Where the course videos come from (credited under every video and at the bottom of the course). */
export type CourseSource = { name: string; channelUrl: string; playlistUrl: string; playlistTitle: string; note: string };

/** A finished course as recorded on the responder's profile. */
export type CompletedCourse = { id: string; title: string; badge: string; completedAt: string };

export type CourseLesson = {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  video: CourseVideo;
  /** Short key points ("Ghi nhớ") shown under the video; empty until the video has been watched. */
  sections: CourseSection[];
  completed: boolean;
  quizScore: number | null;
  /** Furthest point of the video reached by playing it, as recorded by the server. */
  watchedSeconds: number;
  /** What must be watched (90% of the video) before the quiz opens. */
  requiredSeconds: number;
  /** The quiz is open: the video was watched, or the lesson was already passed. */
  watched: boolean;
};

export type Course = {
  id: string;
  title: string;
  summary: string;
  audience: string;
  disclaimer: string;
  badge: string;
  completedAt: string | null;
  source: CourseSource;
  lessonCount: number;
  completedLessons: number;
  progressPercent: number;
  completed: boolean;
  nextLessonId: string | null;
  lessons: CourseLesson[];
};

export type CourseOverview = {
  responderName: string;
  responderSkills: string[];
  courses: Course[];
  completedCourses: CompletedCourse[];
};

/** `correctIndex` and `explanation` only come with a passed quiz: a failed one only says which answers were wrong. */
export type QuizAnswerResult = {
  questionId: string;
  correct: boolean;
  correctIndex: number | null;
  explanation: string | null;
};

export type QuizResult = {
  passed: boolean;
  correctCount: number;
  total: number;
  results: QuizAnswerResult[];
  /** Failed quizzes left before the video must be watched again; 0 = this failure reset it; null for a passed lesson. */
  attemptsLeft: number | null;
  course: Course;
};
