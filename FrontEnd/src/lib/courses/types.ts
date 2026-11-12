export type CourseSection = { heading: string; paragraphs: string[]; bullets: string[] };

export type CourseQuizQuestion = { id: string; question: string; options: string[] };

export type CourseLesson = {
  id: string;
  title: string;
  summary: string;
  minutes: number;
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
