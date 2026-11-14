import { fail } from "@sveltejs/kit";
import { gradeQuiz, lessonPage } from "$lib/server/prograde";

export async function load({ params }) {
  const { course, lesson, progress, docHtml, quiz, exercises, prevLesson, nextLesson } = await lessonPage(
    params.course,
    params.lesson,
  );
  return {
    courseId: course.id,
    courseLabel: course.spec.label,
    id: lesson.ref.id,
    title: lesson.ref.title,
    goal: lesson.ref.goal ?? "",
    skills: lesson.ref.skills ?? [],
    estimateMin: lesson.ref.estimateMin ?? null,
    docHtml,
    quiz,
    exercises,
    prevLesson,
    nextLesson,
    solved: progress.lessons[lesson.ref.id]?.solved ?? 0,
  };
}

export const actions = {
  quiz: async ({ request, params }) => {
    const { quiz } = await lessonPage(params.course, params.lesson);
    if (!quiz) return fail(400, { error: "このレッスンにクイズはありません。" });
    const form = await request.formData();
    const selected = new Map<string, string[]>();
    for (const question of quiz.questions) {
      selected.set(question.id, form.getAll("q:" + question.id).map(String));
    }
    return { quizResult: gradeQuiz(quiz, selected) };
  },
};
