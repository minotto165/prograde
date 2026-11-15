import { listCourses, loadCourse } from "../../../../../src/core/course.ts";
import { readProgress, XP_PER_LEVEL } from "../../../../../src/core/progress.ts";
import { webCtx } from "../ctx.ts";
import { link, stats, type ExerciseLink } from "../view.ts";

export async function dashboard() {
  const ctx = webCtx();
  const summaries = await listCourses(ctx);
  const cards: {
    id: string;
    label: string;
    description: string;
    lessons: number;
    exercises: number;
    solved: number;
    xp: number;
    level: number;
    streak: number;
    next: ExerciseLink | null;
  }[] = [];
  let xp = 0;
  let solved = 0;
  let total = 0;
  let streak = 0;
  for (const summary of summaries) {
    const course = await loadCourse(ctx, summary.id);
    const { progress } = await readProgress(ctx, course);
    const value = stats(course, progress);
    xp += value.xp;
    solved += value.solved;
    total += value.total;
    streak = Math.max(streak, value.streak);
    cards.push({
      id: course.id,
      label: course.spec.label,
      description: course.spec.description ?? "",
      lessons: course.lessons.length,
      exercises: value.total,
      solved: value.solved,
      xp: value.xp,
      level: value.level,
      streak: value.streak,
      next: progress.next ? link(course.byId.get(progress.next.exerciseId)!) : null,
    });
  }
  return {
    courses: cards,
    totals: { xp, level: Math.floor(xp / XP_PER_LEVEL) + 1, solved, total, streak },
  };
}
