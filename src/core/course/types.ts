import type {
  ChapterRef,
  Course,
  Exercise,
  LessonRef,
  Quiz,
  SectionRef,
} from "../../schema/index.ts";

/** 演習1つ。位置情報も含む（採点は spec だけを見る）。 */
export interface ExerciseEntry {
  id: string;
  courseId: string;
  dir: string;
  spec: Exercise;
  lessonId: string;
  lessonTitle: string;
  /** 1 始まり。 */
  lessonIndex: number;
  chapterId: string;
  chapterTitle: string;
  /** レッスン内の 1 始まり。 */
  chapterIndex: number;
  sectionId: string;
  sectionTitle: string;
  /** 章内の 1 始まり。 */
  sectionIndex: number;
  /** レッスン内の 1 始まり。 */
  index: number;
}

export interface LoadedSlide {
  /** 1 始まり。 */
  index: number;
  /** ファイル名の番号。 */
  id: string;
  file: string;
  /** セクションディレクトリからの相対パス。 */
  relPath: string;
  /** 最初の # 見出し。無ければ null。 */
  title: string | null;
  body: string;
}

export interface LoadedSection {
  ref: SectionRef;
  /** 章内の 1 始まり。 */
  index: number;
  dir: string;
  slides: LoadedSlide[];
  exercise: ExerciseEntry;
}

export interface LoadedChapter {
  ref: ChapterRef;
  /** レッスン内の 1 始まり。 */
  index: number;
  dir: string;
  sections: LoadedSection[];
  exercises: ExerciseEntry[];
}

export interface LoadedLesson {
  ref: LessonRef;
  index: number;
  dir: string;
  chapters: LoadedChapter[];
  exercises: ExerciseEntry[];
  quiz: Quiz | null;
}

export interface LoadedCourse {
  id: string;
  dir: string;
  spec: Course;
  lessons: LoadedLesson[];
  exercises: ExerciseEntry[];
  byId: Map<string, ExerciseEntry>;
  sectionByExercise: Map<string, LoadedSection>;
}
