import { z } from 'zod';
import { getUserSupabaseClient } from '../../config/supabase.js';

const courseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  display_order: z.number(),
});
const lessonSchema = z.object({
  id: z.string(),
  course_id: z.string(),
  title: z.string(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  duration_minutes: z.number(),
  objectives: z.array(z.string()),
  explanation: z.string(),
  practical_example: z.string(),
  important_concepts: z.array(z.string()),
  scenario: z.string(),
  key_takeaways: z.array(z.string()),
  display_order: z.number(),
});
const questionSchema = z.object({
  id: z.string(),
  course_id: z.string(),
  lesson_id: z.string(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  prompt: z.string(),
  options: z.array(z.object({ id: z.string(), text: z.string() })),
  multiple_select: z.boolean(),
});
const attemptResultSchema = z.object({
  attempt_id: z.string().uuid(),
  correct_count: z.number().int(),
  total_questions: z.number().int(),
  score: z.number().int().min(0).max(100),
  explanations: z.array(z.object({
    questionId: z.string(),
    correctOptionIds: z.array(z.string()),
    explanation: z.string(),
  })),
});

export async function listAcademyCourses(accessToken: string) {
  const client = getUserSupabaseClient(accessToken);
  const [courseResult, lessonResult, questionResult] = await Promise.all([
    client.from('academy_courses')
      .select('id, title, description, display_order')
      .order('display_order'),
    client.from('academy_lessons')
      .select('id, course_id, title, difficulty, duration_minutes, objectives, explanation, practical_example, important_concepts, scenario, key_takeaways, display_order')
      .order('display_order'),
    client.from('academy_questions')
      .select('id, course_id'),
  ]);
  if (courseResult.error || lessonResult.error || questionResult.error) {
    throw new Error('ACADEMY_CONTENT_UNAVAILABLE');
  }
  const courses = z.array(courseSchema).safeParse(courseResult.data);
  const lessons = z.array(lessonSchema).safeParse(lessonResult.data);
  const questionCounts = z.array(z.object({ id: z.string(), course_id: z.string() }))
    .safeParse(questionResult.data);
  if (!courses.success || !lessons.success || !questionCounts.success) {
    throw new Error('INVALID_ACADEMY_CONTENT');
  }
  return courses.data.map((course) => ({
    ...course,
    lessons: lessons.data.filter((lesson) => lesson.course_id === course.id),
    questionCount: questionCounts.data.filter((question) => question.course_id === course.id).length,
  }));
}

export async function getAcademyQuiz(accessToken: string, courseId: string) {
  const client = getUserSupabaseClient(accessToken);
  const { data, error } = await client.from('academy_questions')
    .select('id, course_id, lesson_id, difficulty, prompt, options, multiple_select')
    .eq('course_id', courseId)
    .order('difficulty');
  if (error) throw new Error('ACADEMY_QUIZ_UNAVAILABLE');
  const parsed = z.array(questionSchema).safeParse(data);
  if (!parsed.success) throw new Error('INVALID_ACADEMY_QUIZ');
  const difficultyOrder = { beginner: 0, intermediate: 1, advanced: 2 };
  return parsed.data.sort((first, second) =>
    difficultyOrder[first.difficulty] - difficultyOrder[second.difficulty],
  );
}

export async function getAcademyProgress(accessToken: string) {
  const client = getUserSupabaseClient(accessToken);
  const [lessons, attempts, achievements, certificates] = await Promise.all([
    client.from('user_lesson_progress')
      .select('lesson_id, completed_at, time_spent_seconds')
      .order('completed_at', { ascending: false }),
    client.from('user_quiz_attempts')
      .select('id, course_id, correct_count, total_questions, score, created_at')
      .order('created_at', { ascending: false }).limit(50),
    client.from('user_achievements')
      .select('achievement_key, title, description, points, awarded_at')
      .order('awarded_at', { ascending: false }),
    client.from('user_certificates')
      .select('id, course_id, student_name, certificate_reference, completed_at')
      .order('completed_at', { ascending: false }),
  ]);
  if (lessons.error || attempts.error || achievements.error || certificates.error) {
    throw new Error('ACADEMY_PROGRESS_UNAVAILABLE');
  }
  return {
    lessons: lessons.data,
    attempts: attempts.data,
    achievements: achievements.data,
    certificates: certificates.data,
  };
}

export async function completeAcademyLesson(
  accessToken: string,
  lessonId: string,
  timeSpentSeconds: number,
) {
  const client = getUserSupabaseClient(accessToken);
  const { data, error } = await client.rpc('complete_academy_lesson', {
    p_lesson_id: lessonId,
    p_time_spent_seconds: timeSpentSeconds,
  });
  if (error) throw new Error('ACADEMY_LESSON_SAVE_FAILED');
  return data;
}

export async function submitAcademyQuiz(
  accessToken: string,
  courseId: string,
  answers: Record<string, string[]>,
) {
  const client = getUserSupabaseClient(accessToken);
  const { data, error } = await client.rpc('submit_academy_quiz', {
    p_course_id: courseId,
    p_answers: answers,
  });
  if (error) throw new Error('ACADEMY_QUIZ_SUBMIT_FAILED');
  const result = Array.isArray(data) ? data[0] : data;
  const parsed = attemptResultSchema.safeParse(result);
  if (!parsed.success) throw new Error('INVALID_ACADEMY_QUIZ_RESULT');
  return parsed.data;
}

export async function issueAcademyCertificate(accessToken: string, courseId: string) {
  const client = getUserSupabaseClient(accessToken);
  const { data, error } = await client.rpc('issue_academy_certificate', {
    p_course_id: courseId,
  });
  if (error) throw new Error('ACADEMY_CERTIFICATE_NOT_ELIGIBLE');
  const certificate = Array.isArray(data) ? data[0] : data;
  return z.object({
    id: z.string().uuid(),
    course_id: z.string(),
    student_name: z.string(),
    certificate_reference: z.string(),
    completed_at: z.string(),
  }).parse(certificate);
}
