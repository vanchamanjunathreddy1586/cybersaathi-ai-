import { getCourses, getCourseQuiz, submitQuizAnswers } from '../src/api/academy.api';

describe('Cyber Academy API & Quizzes', () => {
  it('returns cyber defense modules including Phishing, UPI, and Identity', async () => {
    const courses = await getCourses();
    expect(courses.length).toBeGreaterThanOrEqual(3);
    const phishing = courses.find((c) => c.slug === 'phishing-defense');
    expect(phishing).toBeDefined();
    expect(phishing?.lessons?.length).toBeGreaterThan(0);
  });

  it('loads quiz questions and validates responses', async () => {
    const questions = await getCourseQuiz('phishing-defense');
    expect(questions.length).toBeGreaterThanOrEqual(3);

    const answers: Record<string, string[]> = {
      q1: ['No, never enter PIN to receive money'],
      q2: ['Electricity Bill Fraud / Panic Phishing scam'],
      q3: ['1930'],
    };

    const result = await submitQuizAnswers('phishing-defense', answers);
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });
});
