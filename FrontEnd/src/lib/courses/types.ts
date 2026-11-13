export type CourseSection = { heading: string; paragraphs: string[]; bullets: string[] };

export type CourseQuizQuestion = { id: string; question: string; options: string[] };

/** One YouTube clip; `embedUrl` is the privacy-enhanced youtube-nocookie.com player URL. */
export type CourseVideo = { youtubeId: string; title: string; url: string; embedUrl: string };

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
  /** Short key points ("Ghi nhớ") shown under the video. */
  sections: CourseSection[];
  quiz: CourseQuizQuestion[];
  completed: boolean;
  quizScore: number | null;
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

export type QuizAnswerResult = {
  questionId: string;
  correct: boolean;
  correctIndex: number;
  explanation: string;
};

export type QuizResult = {
  passed: boolean;
  correctCount: number;
  total: number;
  results: QuizAnswerResult[];
  course: Course;
};
