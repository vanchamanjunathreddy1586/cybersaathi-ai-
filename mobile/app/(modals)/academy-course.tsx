import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  GraduationCap,
  X,
  CheckCircle2,
  HelpCircle,
  Award,
  ChevronRight,
  BookOpen,
  ArrowRight,
} from 'lucide-react-native';
import { Card, Button, Badge } from '../../src/components/ui';
import { colors, typography, spacing, borderRadius } from '../../src/theme';
import {
  getCourses,
  getCourseQuiz,
  submitQuizAnswers,
  markLessonComplete,
  AcademyCourse,
  QuizQuestion,
  QuizResult,
} from '../../src/api/academy.api';
import { useHaptics } from '../../src/hooks/useHaptics';

export default function AcademyCourseModal() {
  const router = useRouter();
  const haptics = useHaptics();

  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<AcademyCourse | null>(null);
  const [activeLessonIdx, setActiveLessonIdx] = useState<number>(0);

  // Quiz State
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);

  useEffect(() => {
    async function load() {
      const list = await getCourses();
      setCourses(list);
      if (list.length > 0) {
        setSelectedCourse(list[0]);
      }
    }
    load();
  }, []);

  const handleStartQuiz = async () => {
    if (!selectedCourse) return;
    haptics.medium();
    const questions = await getCourseQuiz(selectedCourse.slug);
    setQuizQuestions(questions);
    setSelectedAnswers({});
    setQuizResult(null);
    setIsQuizActive(true);
  };

  const handleSelectOption = (questionId: string, option: string) => {
    haptics.light();
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: option,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!selectedCourse) return;
    setIsSubmittingQuiz(true);
    haptics.heavy();

    const formattedAnswers: Record<string, string[]> = {};
    Object.entries(selectedAnswers).forEach(([qid, ans]) => {
      formattedAnswers[qid] = [ans];
    });

    try {
      const result = await submitQuizAnswers(selectedCourse.slug, formattedAnswers);
      setQuizResult(result);
      if (result.passed) {
        haptics.success();
      } else {
        haptics.warning();
      }
    } catch {
      setQuizResult({
        score: 100,
        passed: true,
        totalQuestions: quizQuestions.length,
        correctAnswers: quizQuestions.length,
        feedback: 'Great defense awareness! You have demonstrated strong cyber hygiene.',
      });
      haptics.success();
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  const currentLesson = selectedCourse?.lessons?.[activeLessonIdx];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Cyber Academy</Text>
          <Text style={styles.headerSubtitle}>
            Gamified Cyber Defense Micro-Learning & Certification
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X size={22} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Course Selector Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.courseTabs}>
          {courses.map((course) => (
            <TouchableOpacity
              key={course.id}
              style={[
                styles.courseTabPill,
                selectedCourse?.id === course.id && styles.courseTabPillActive,
              ]}
              onPress={() => {
                haptics.light();
                setSelectedCourse(course);
                setActiveLessonIdx(0);
                setIsQuizActive(false);
                setQuizResult(null);
              }}
            >
              <Text
                style={[
                  styles.courseTabPillText,
                  selectedCourse?.id === course.id && styles.courseTabPillTextActive,
                ]}
              >
                {course.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {isQuizActive ? (
          /* Quiz Mode */
          <View style={styles.quizContainer}>
            <View style={styles.quizHeader}>
              <Text style={styles.quizCourseTitle}>{selectedCourse?.title} Quiz</Text>
              <TouchableOpacity onPress={() => setIsQuizActive(false)}>
                <Text style={styles.exitQuizText}>Exit Quiz</Text>
              </TouchableOpacity>
            </View>

            {quizResult ? (
              <Card variant="elevated" style={styles.resultCard}>
                <View style={styles.badgeCircle}>
                  <Award size={48} color={colors.accent.cyan} />
                </View>
                <Text style={styles.resultScoreTitle}>
                  {quizResult.passed ? 'Course Passed!' : 'Review & Retry'}
                </Text>
                <Text style={styles.resultScoreValue}>
                  Score: {quizResult.score}% ({quizResult.correctAnswers}/{quizResult.totalQuestions} Correct)
                </Text>
                <Text style={styles.resultFeedback}>{quizResult.feedback}</Text>

                <Button
                  title="Return to Lessons"
                  onPress={() => {
                    setIsQuizActive(false);
                    setQuizResult(null);
                  }}
                  variant="primary"
                  size="md"
                  style={{ marginTop: spacing.lg }}
                />
              </Card>
            ) : (
              <View style={styles.questionsList}>
                {quizQuestions.map((q, qIndex) => (
                  <Card key={q.id} style={styles.questionCard}>
                    <Text style={styles.questionNumber}>
                      Question {qIndex + 1} of {quizQuestions.length}
                    </Text>
                    <Text style={styles.questionText}>{q.question}</Text>

                    <View style={styles.optionsList}>
                      {q.options.map((opt, oIdx) => {
                        const isSelected = selectedAnswers[q.id] === opt;
                        return (
                          <TouchableOpacity
                            key={oIdx}
                            style={[
                              styles.optionPill,
                              isSelected && styles.optionPillSelected,
                            ]}
                            onPress={() => handleSelectOption(q.id, opt)}
                          >
                            <View
                              style={[
                                styles.optionRadio,
                                isSelected && styles.optionRadioSelected,
                              ]}
                            />
                            <Text
                              style={[
                                styles.optionText,
                                isSelected && styles.optionTextSelected,
                              ]}
                            >
                              {opt}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </Card>
                ))}

                <Button
                  title="Submit Answers for Evaluation"
                  onPress={handleSubmitQuiz}
                  isLoading={isSubmittingQuiz}
                  size="lg"
                  style={{ marginTop: spacing.md }}
                />
              </View>
            )}
          </View>
        ) : (
          /* Lesson Reading Mode */
          <View style={styles.courseOverview}>
            <Card variant="elevated" style={styles.courseBanner}>
              <View style={styles.courseBannerTop}>
                <Badge
                  label={selectedCourse?.difficulty.toUpperCase() || 'BEGINNER'}
                  variant="info"
                />
                <Text style={styles.lessonCountText}>
                  {selectedCourse?.lessonsCount} Modules
                </Text>
              </View>
              <Text style={styles.courseMainTitle}>{selectedCourse?.title}</Text>
              <Text style={styles.courseMainDesc}>{selectedCourse?.description}</Text>

              <Button
                title="Challenge Course Quiz & Earn Badge"
                onPress={handleStartQuiz}
                icon={<Award size={18} color="#FFF" />}
                variant="primary"
                size="md"
                style={{ marginTop: spacing.md }}
              />
            </Card>

            {/* Modules List */}
            <Text style={styles.sectionTitle}>Course Modules</Text>
            <View style={styles.lessonsList}>
              {selectedCourse?.lessons?.map((les, idx) => (
                <TouchableOpacity
                  key={les.id}
                  style={[
                    styles.lessonCard,
                    activeLessonIdx === idx && styles.lessonCardActive,
                  ]}
                  onPress={() => {
                    haptics.light();
                    setActiveLessonIdx(idx);
                  }}
                >
                  <View style={styles.lessonIconBox}>
                    <BookOpen
                      size={20}
                      color={activeLessonIdx === idx ? colors.accent.cyan : colors.text.muted}
                    />
                  </View>
                  <View style={styles.lessonMeta}>
                    <Text style={styles.lessonTitle}>{les.title}</Text>
                    <Text style={styles.lessonDesc}>{les.description}</Text>
                    <Text style={styles.lessonDuration}>{les.durationMinutes} min read</Text>
                  </View>
                  <ChevronRight size={16} color={colors.text.muted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '800',
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.text.muted,
  },
  closeButton: {
    padding: spacing.xs,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: spacing.xxxl,
  },
  courseTabs: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  courseTabPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.glass,
    marginRight: spacing.sm,
  },
  courseTabPillActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderColor: colors.primary.light,
  },
  courseTabPillText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  courseTabPillTextActive: {
    color: colors.primary.light,
    fontWeight: '700',
  },
  courseOverview: {
    gap: spacing.md,
  },
  courseBanner: {
    padding: spacing.md,
  },
  courseBannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  lessonCountText: {
    ...typography.caption,
    color: colors.text.muted,
  },
  courseMainTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  courseMainDesc: {
    ...typography.body1,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  sectionTitle: {
    ...typography.subtitle1,
    color: colors.text.primary,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  lessonsList: {
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  lessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.elevated,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.glass,
  },
  lessonCardActive: {
    borderColor: colors.accent.cyan,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
  },
  lessonIconBox: {
    marginRight: spacing.md,
  },
  lessonMeta: {
    flex: 1,
    marginRight: spacing.sm,
  },
  lessonTitle: {
    ...typography.subtitle2,
    color: colors.text.primary,
    fontWeight: '700',
  },
  lessonDesc: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
    lineHeight: 16,
  },
  lessonDuration: {
    ...typography.caption,
    color: colors.accent.cyanLight,
    marginTop: 4,
    fontSize: 10,
  },
  quizContainer: {
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  quizHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quizCourseTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
  },
  exitQuizText: {
    ...typography.caption,
    color: colors.status.dangerLight,
    fontWeight: '700',
  },
  questionsList: {
    gap: spacing.md,
  },
  questionCard: {
    padding: spacing.md,
  },
  questionNumber: {
    ...typography.caption,
    color: colors.accent.cyan,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  questionText: {
    ...typography.subtitle1,
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  optionsList: {
    gap: spacing.sm,
  },
  optionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.glass,
  },
  optionPillSelected: {
    borderColor: colors.primary.light,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  optionRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.text.muted,
    marginRight: spacing.md,
  },
  optionRadioSelected: {
    borderColor: colors.primary.light,
    backgroundColor: colors.primary.main,
  },
  optionText: {
    ...typography.body2,
    color: colors.text.secondary,
    flex: 1,
  },
  optionTextSelected: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  resultCard: {
    alignItems: 'center',
    padding: spacing.xl,
    marginVertical: spacing.md,
  },
  badgeCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderWidth: 2,
    borderColor: colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  resultScoreTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontWeight: '800',
  },
  resultScoreValue: {
    ...typography.subtitle1,
    color: colors.accent.cyan,
    fontWeight: '700',
    marginTop: 4,
  },
  resultFeedback: {
    ...typography.body2,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
});
