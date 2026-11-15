import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FlaskConical,
  GraduationCap,
  Languages,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import {
  askTutor,
  completeLesson,
  createCertificate,
  loadCourses,
  loadProgress,
  loadQuiz,
  submitQuiz,
  type AcademyCourse,
  type AcademyLesson,
  type AcademyProgress,
  type AcademyQuestion,
  type Certificate,
  type Difficulty,
  type QuizResult,
  type TutorResponse,
} from './academyApi'
import './Academy.css'

type AcademySection = 'dashboard' | 'course' | 'lesson' | 'quiz' | 'history'
type MainTab = 'academy' | 'labs' | 'tutor'
type Language = 'en' | 'te' | 'hi'
type TutorMessage = {
  id: string
  question: string
  answer?: string
  questions?: TutorResponse['questions']
  error?: string
}

const difficultyLabels: Record<Difficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

const phishingExamples = [
  {
    url: 'https://account-update.example.attacker.invalid/verify',
    suspicious: true,
    explanation: 'The registrable domain is attacker.invalid. “example” is only a subdomain.',
  },
  {
    url: 'https://accounts.google.com/',
    suspicious: false,
    explanation: 'This example uses the expected google.com domain. Still verify context and never trust display text alone.',
  },
  {
    url: 'http://paypaI.example.invalid/login',
    suspicious: true,
    explanation: 'The host is example.invalid and the path uses a lookalike brand name; the link is not a trusted PayPal domain.',
  },
]

const safeLogExamples = [
  { line: '2026-11-08T10:01:02Z INFO backup completed for training-db', concern: false },
  { line: '2026-11-08T10:03:18Z WARN login denied for user demo from unfamiliar device', concern: true },
  { line: '2026-11-08T10:05:44Z INFO security update installed successfully', concern: false },
  { line: '2026-11-08T10:06:13Z ALERT MFA denied after unexpected sign-in request', concern: true },
]

function localDateKey(value: string) {
  return new Date(value).toISOString().slice(0, 10)
}

function learningStreak(progress: AcademyProgress | null) {
  if (!progress) return 0
  const activeDays = new Set([
    ...progress.lessons.map((lesson) => localDateKey(lesson.completed_at)),
    ...progress.attempts.map((attempt) => localDateKey(attempt.created_at)),
  ])
  const today = new Date()
  const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const todayKey = cursor.toISOString().slice(0, 10)
  if (!activeDays.has(todayKey)) cursor.setUTCDate(cursor.getUTCDate() - 1)
  let streak = 0
  while (activeDays.has(cursor.toISOString().slice(0, 10))) {
    streak += 1
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return streak
}

async function downloadCertificate(certificate: Certificate, courseTitle: string) {
  const { jsPDF } = await import('jspdf')
  const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = document.internal.pageSize.getWidth()
  const pageHeight = document.internal.pageSize.getHeight()
  document.setFillColor(8, 11, 20)
  document.rect(0, 0, pageWidth, pageHeight, 'F')
  document.setDrawColor(102, 216, 232)
  document.setLineWidth(1)
  document.roundedRect(12, 12, pageWidth - 24, pageHeight - 24, 4, 4)
  document.setTextColor(102, 216, 232)
  document.setFont('helvetica', 'bold')
  document.setFontSize(15)
  document.text('CYBERSAATHI AI  /  ACADEMY', pageWidth / 2, 39, { align: 'center' })
  document.setTextColor(235, 239, 248)
  document.setFontSize(30)
  document.text('Certificate of Completion', pageWidth / 2, 66, { align: 'center' })
  document.setTextColor(177, 188, 208)
  document.setFont('helvetica', 'normal')
  document.setFontSize(14)
  document.text('This certificate is awarded to', pageWidth / 2, 87, { align: 'center' })
  document.setTextColor(169, 145, 255)
  document.setFont('helvetica', 'bold')
  document.setFontSize(25)
  document.text(certificate.student_name, pageWidth / 2, 105, { align: 'center' })
  document.setTextColor(177, 188, 208)
  document.setFont('helvetica', 'normal')
  document.setFontSize(14)
  document.text('for completing the course', pageWidth / 2, 122, { align: 'center' })
  document.setTextColor(235, 239, 248)
  document.setFont('helvetica', 'bold')
  document.setFontSize(19)
  const courseLines = document.splitTextToSize(courseTitle, pageWidth - 64)
  document.text(courseLines, pageWidth / 2, 138, { align: 'center' })
  document.setTextColor(145, 157, 181)
  document.setFont('helvetica', 'normal')
  document.setFontSize(10)
  document.text(
    `Completed ${new Date(certificate.completed_at).toLocaleDateString()}  •  Reference ${certificate.certificate_reference}`,
    pageWidth / 2,
    pageHeight - 29,
    { align: 'center' },
  )
  document.save(`CyberSaathi-${certificate.course_id}-certificate.pdf`)
}

function hasCoursePassed(courseId: string, progress: AcademyProgress | null) {
  return progress?.attempts.some((attempt) => attempt.course_id === courseId && attempt.score >= 80) ?? false
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export function AcademyPage() {
  const { session, profile, user } = useAuth()
  const accessToken = session?.access_token ?? ''
  const [courses, setCourses] = useState<AcademyCourse[]>([])
  const [offlineCatalog, setOfflineCatalog] = useState(false)
  const [progress, setProgress] = useState<AcademyProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [progressError, setProgressError] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [mainTab, setMainTab] = useState<MainTab>('academy')
  const [section, setSection] = useState<AcademySection>('dashboard')
  const [courseId, setCourseId] = useState('')
  const [lessonId, setLessonId] = useState('')
  const [quizQuestions, setQuizQuestions] = useState<AcademyQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null)
  const [passwordSample, setPasswordSample] = useState('')
  const [xssSample, setXssSample] = useState('')
  const [phishingAnswers, setPhishingAnswers] = useState<Record<number, boolean>>({})
  const [selectedLogLines, setSelectedLogLines] = useState<number[]>([])
  const [logsChecked, setLogsChecked] = useState(false)
  const [tutorLanguage, setTutorLanguage] = useState<Language>('en')
  const [tutorLevel, setTutorLevel] = useState<Difficulty>('beginner')
  const [tutorIntent, setTutorIntent] = useState<'explain' | 'practice' | 'mistakes' | 'recommend'>('explain')
  const [tutorInput, setTutorInput] = useState('')
  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>([])
  const [tutorSending, setTutorSending] = useState(false)
  const lessonElapsedMs = useRef(0)
  const lessonActiveSince = useRef<number | null>(null)

  const refreshData = async () => {
    if (!accessToken) return
    const [nextCatalog, nextProgress] = await Promise.all([
      loadCourses(accessToken),
      loadProgress(accessToken),
    ])
    setCourses(nextCatalog.courses)
    setOfflineCatalog(nextCatalog.offline)
    setProgress(nextProgress)
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')
    setProgressError('')
    void loadCourses(accessToken)
      .then(async (nextCatalog) => {
        if (!active) return
        setCourses(nextCatalog.courses)
        setOfflineCatalog(nextCatalog.offline)
        try {
          const nextProgress = await loadProgress(accessToken)
          if (active) setProgress(nextProgress)
        } catch (error) {
          if (active) {
            setProgress(null)
            setProgressError(nextCatalog.offline
              ? ''
              : error instanceof Error ? error.message : 'Learning progress could not be loaded.')
          }
        }
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Learning data could not be loaded.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [accessToken])

  const activeCourse = courses.find((course) => course.id === courseId) ?? null
  const activeLesson = activeCourse?.lessons.find((lesson) => lesson.id === lessonId) ?? null
  const completedLessonIds = useMemo(
    () => new Set(progress?.lessons.map((lesson) => lesson.lesson_id) ?? []),
    [progress],
  )
  const totalLessons = courses.reduce((total, course) => total + course.lessons.length, 0)
  const completedCount = progress?.lessons.length ?? 0
  const coursesInProgress = courses.filter((course) => {
    const done = course.lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length
    return done > 0 && done < course.lessons.length
  }).length
  const today = new Date().toISOString().slice(0, 10)
  const todayActivities = [
    ...(progress?.lessons.filter((lesson) => localDateKey(lesson.completed_at) === today) ?? []),
    ...(progress?.attempts.filter((attempt) => localDateKey(attempt.created_at) === today) ?? []),
  ].length
  const totalLearningSeconds = progress?.lessons.reduce((total, lesson) => total + lesson.time_spent_seconds, 0) ?? 0
  const points = progress?.achievements.reduce((total, achievement) => total + achievement.points, 0) ?? 0
  const streak = learningStreak(progress)
  const recentActivities = [
    ...(progress?.lessons.map((lesson) => ({
      id: `lesson-${lesson.lesson_id}`,
      title: courses.flatMap((course) => course.lessons).find((item) => item.id === lesson.lesson_id)?.title ?? 'Lesson completed',
      detail: 'Lesson completed',
      createdAt: lesson.completed_at,
      icon: 'lesson' as const,
    })) ?? []),
    ...(progress?.attempts.map((attempt) => ({
      id: `quiz-${attempt.id}`,
      title: courses.find((course) => course.id === attempt.course_id)?.title ?? 'Knowledge check',
      detail: `Quiz score ${attempt.score}%`,
      createdAt: attempt.created_at,
      icon: 'quiz' as const,
    })) ?? []),
  ].sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt)).slice(0, 5)

  useEffect(() => {
    if (section !== 'lesson') return
    lessonElapsedMs.current = 0
    lessonActiveSince.current = document.visibilityState === 'visible' ? performance.now() : null
    const trackVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (lessonActiveSince.current === null) lessonActiveSince.current = performance.now()
      } else if (lessonActiveSince.current !== null) {
        lessonElapsedMs.current += performance.now() - lessonActiveSince.current
        lessonActiveSince.current = null
      }
    }
    document.addEventListener('visibilitychange', trackVisibility)
    return () => {
      document.removeEventListener('visibilitychange', trackVisibility)
      if (lessonActiveSince.current !== null) {
        lessonElapsedMs.current += performance.now() - lessonActiveSince.current
        lessonActiveSince.current = null
      }
    }
  }, [section, lessonId])

  const openCourse = (id: string) => {
    setCourseId(id)
    setSection('course')
    setActionError('')
    setQuizResult(null)
  }

  const openLesson = (lesson: AcademyLesson) => {
    setLessonId(lesson.id)
    setSection('lesson')
    setActionError('')
  }

  const openQuiz = async (course: AcademyCourse) => {
    setActionError('')
    setSaving(true)
    try {
      const questions = await loadQuiz(accessToken, course.id)
      setCourseId(course.id)
      setQuizQuestions(questions)
      setAnswers({})
      setQuizResult(null)
      setSection('quiz')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The quiz could not be loaded.')
    } finally {
      setSaving(false)
    }
  }

  const markLessonComplete = async () => {
    if (!activeLesson || !accessToken) return
    setSaving(true)
    setActionError('')
    try {
      const activeDuration = lessonElapsedMs.current +
        (lessonActiveSince.current === null ? 0 : performance.now() - lessonActiveSince.current)
      await completeLesson(accessToken, activeLesson.id, Math.min(7200, Math.floor(activeDuration / 1000)))
      await refreshData()
      setSection('course')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Lesson completion could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const submitCurrentQuiz = async () => {
    if (!activeCourse) return
    setSaving(true)
    setActionError('')
    try {
      const result = await submitQuiz(accessToken, activeCourse.id, answers)
      setQuizResult(result)
      await refreshData()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The quiz could not be submitted.')
    } finally {
      setSaving(false)
    }
  }

  const issueCertificate = async (course: AcademyCourse) => {
    setSaving(true)
    setActionError('')
    try {
      const certificate = await createCertificate(accessToken, course.id)
      await refreshData()
      downloadCertificate(certificate, course.title)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The certificate could not be created.')
    } finally {
      setSaving(false)
    }
  }

  const downloadSavedCertificate = async (certificate: Certificate, courseTitle: string) => {
    setActionError('')
    try {
      await downloadCertificate(certificate, courseTitle)
    } catch {
      setActionError('The certificate PDF could not be generated. Try again.')
    }
  }

  const submitTutorMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const question = tutorInput.trim()
    if (!question || tutorSending) return
    const messageId = `${Date.now()}`
    setTutorMessages((current) => [...current, { id: messageId, question }])
    setTutorInput('')
    setTutorSending(true)
    try {
      const mistakeContext = quizResult
        ? quizResult.explanations.filter((item) => {
          const selected = answers[item.questionId] ?? []
          return selected.length !== item.correctOptionIds.length ||
            selected.some((option) => !item.correctOptionIds.includes(option))
        }).map((item) => {
          const question = quizQuestions.find((entry) => entry.id === item.questionId)
          const optionText = (ids: string[]) => question?.options
            .filter((option) => ids.includes(option.id))
            .map((option) => option.text)
            .join(', ') ?? ids.join(', ')
          return `Question: ${question?.prompt ?? item.questionId}\nYour answer: ${optionText(answers[item.questionId] ?? [])}\nCorrect answer: ${optionText(item.correctOptionIds)}\nExplanation: ${item.explanation}`
        }).join('\n\n') || 'No incorrect answers in the latest quiz result.'
        : 'No quiz result is currently selected.'
      const nextLessonContext = tutorIntent === 'recommend'
        ? `Saved progress: ${completedCount} of ${totalLessons} lessons complete. Next incomplete lessons: ${courses.flatMap((course) => course.lessons.filter((lesson) => !completedLessonIds.has(lesson.id)).slice(0, 1).map((lesson) => `${course.title}: ${lesson.title} (${difficultyLabels[lesson.difficulty]})`)).slice(0, 5).join('; ') || 'All lessons are complete.'}`
        : ''
      const result = await askTutor(accessToken, {
        question,
        language: tutorLanguage,
        level: tutorLevel,
        intent: tutorIntent,
        lessonContext: [
          activeLesson ? `Current lesson: ${activeLesson.title}. ${activeLesson.explanation}` : '',
          tutorIntent === 'mistakes' ? `Quiz feedback: ${mistakeContext}` : '',
          nextLessonContext,
        ].filter(Boolean).join('\n').slice(0, 5_000),
      })
      setTutorMessages((current) => current.map((message) =>
        message.id === messageId ? { ...message, answer: result.answer, questions: result.questions } : message
      ))
    } catch (error) {
      setTutorMessages((current) => current.map((message) =>
        message.id === messageId
          ? { ...message, error: error instanceof Error ? error.message : 'The AI tutor could not respond.' }
          : message
      ))
    } finally {
      setTutorSending(false)
    }
  }

  const startTutorForLesson = () => {
    setTutorIntent('explain')
    setTutorInput(activeLesson ? `Explain “${activeLesson.title}” to me step by step.` : '')
    setMainTab('tutor')
  }

  const chooseAnswer = (question: AcademyQuestion, optionId: string) => {
    setAnswers((current) => {
      const existing = current[question.id] ?? []
      const next = question.multiple_select
        ? existing.includes(optionId) ? existing.filter((id) => id !== optionId) : [...existing, optionId]
        : [optionId]
      return { ...current, [question.id]: next }
    })
  }

  const passwordSignals = useMemo(() => {
    if (!passwordSample) return { score: 0, label: 'Enter a sample to see local feedback', signals: [] as string[] }
    const signals = [
      passwordSample.length >= 14 ? 'At least 14 characters' : '',
      /[a-z]/.test(passwordSample) && /[A-Z]/.test(passwordSample) ? 'Mixed letter case' : '',
      /\d/.test(passwordSample) ? 'Includes a number' : '',
      /[^A-Za-z0-9]/.test(passwordSample) ? 'Includes a symbol' : '',
      !/(.)\1{2,}/.test(passwordSample) ? 'No obvious repeated-character run' : '',
      !/password|qwerty|123456|letmein/i.test(passwordSample) ? 'No common weak pattern detected' : '',
    ].filter(Boolean)
    const score = Math.min(100, Math.round((signals.length / 6) * 100))
    return {
      score,
      label: score >= 80 ? 'Stronger sample' : score >= 50 ? 'Could be stronger' : 'Weak sample',
      signals,
    }
  }, [passwordSample])

  if (loading) {
    return <section className="academy-state" role="status"><Sparkles size={20} /> Loading your learning workspace…</section>
  }
  if (loadError) {
    return (
      <section className="academy-state academy-state-error" role="alert">
        <ShieldCheck size={23} />
        <div><h2>Academy data is unavailable</h2><p>{loadError}</p><button className="academy-button" onClick={() => window.location.reload()} type="button"><RefreshCw size={15} /> Try again</button></div>
      </section>
    )
  }

  return (
    <section className="academy-page">
      {offlineCatalog && <div className="academy-offline-note" role="status">Offline reading mode: showing previously loaded public lessons. Progress, quizzes, certificates, and AI tutoring are unavailable until the service reconnects.</div>}
      {progressError && <div className="academy-offline-note" role="status">Saved learning progress is currently unavailable. Course completion, activity, and achievement metrics are not shown until progress can be loaded.</div>}
      <div className="academy-hero">
        <div className="academy-hero-copy">
          <p className="eyebrow">CYBERSAATHI AI / LEARN</p>
          <h1>Cybersecurity skills,<br /><span>built one lesson at a time.</span></h1>
          <p>Original, practical learning paths from safe fundamentals to advanced defensive concepts.</p>
          <div className="academy-hero-meta"><span><BookOpen size={15} /> 10 learning paths</span><span><GraduationCap size={15} /> 3 levels each</span><span><ShieldCheck size={15} /> Safe by design</span></div>
        </div>
        <div className="academy-hero-icon" aria-hidden="true"><GraduationCap size={54} strokeWidth={1.3} /><span>Learn</span></div>
      </div>

      <nav className="academy-tabs" aria-label="Academy sections">
        <button className={mainTab === 'academy' ? 'academy-tab active' : 'academy-tab'} onClick={() => { setMainTab('academy'); setSection('dashboard') }} type="button"><BookOpen size={16} /> Academy</button>
        <button className={mainTab === 'labs' ? 'academy-tab active' : 'academy-tab'} onClick={() => setMainTab('labs')} type="button"><FlaskConical size={16} /> Safe labs</button>
        <button className={mainTab === 'tutor' ? 'academy-tab active' : 'academy-tab'} onClick={() => setMainTab('tutor')} type="button"><MessageCircle size={16} /> AI tutor</button>
        <button className="academy-tab academy-history-tab" onClick={() => { setMainTab('academy'); setSection('history') }} type="button"><Clock3 size={16} /> Quiz history</button>
      </nav>

      {mainTab === 'academy' && section === 'dashboard' && (
        <>
          {progress && <div className="academy-stats">
            <article className="academy-stat"><span className="academy-stat-icon"><CheckCircle2 size={17} /></span><span>LESSONS COMPLETED</span><strong>{completedCount}<small> / {totalLessons}</small></strong></article>
            <article className="academy-stat"><span className="academy-stat-icon blue"><BookOpen size={17} /></span><span>COURSES IN PROGRESS</span><strong>{coursesInProgress}</strong></article>
            <article className="academy-stat"><span className="academy-stat-icon violet"><Target size={17} /></span><span>LEARNING STREAK</span><strong>{streak}<small> days</small></strong></article>
            <article className="academy-stat"><span className="academy-stat-icon amber"><Trophy size={17} /></span><span>LEARNING POINTS</span><strong>{points}</strong></article>
            <article className="academy-stat"><span className="academy-stat-icon blue"><Clock3 size={17} /></span><span>LEARNING TIME</span><strong>{formatDuration(totalLearningSeconds)}</strong></article>
          </div>}
          {!progress && <div className="academy-offline-note">Saved learning metrics are unavailable; lesson content remains available to read.</div>}
          <div className="academy-dashboard-grid">
            <section className="academy-panel academy-paths-panel">
              <div className="academy-section-heading"><div><p className="eyebrow">YOUR LEARNING PATHS</p><h2>Explore the academy</h2></div><span className="academy-count">{courses.length} courses</span></div>
              <div className="academy-course-grid">
                {courses.map((course) => {
                  const done = course.lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length
                  const lastAttempt = progress?.attempts.find((attempt) => attempt.course_id === course.id)
                  return (
                    <article className="academy-course-card" key={course.id}>
                      <div className="academy-course-card-top"><span className="academy-course-icon"><ShieldCheck size={18} /></span><span className="academy-level-count">3 LEVELS</span></div>
                      <h3>{course.title}</h3>
                      <p>{course.description}</p>
                      {progress
                        ? <><div className="academy-progress-track" aria-label={`${done} of ${course.lessons.length} lessons complete`}><span style={{ width: `${course.lessons.length ? (done / course.lessons.length) * 100 : 0}%` }} /></div><div className="academy-course-card-meta"><span>{done}/{course.lessons.length} lessons</span>{lastAttempt && <span>Last quiz {lastAttempt.score}%</span>}</div></>
                        : <p className="academy-muted">Saved course progress is unavailable.</p>}
                      <button className="academy-card-link" onClick={() => openCourse(course.id)} type="button">View path <ChevronRight size={15} /></button>
                    </article>
                  )
                })}
              </div>
            </section>
            <aside className="academy-side-column">
              <section className="academy-panel academy-goal-panel">
                <div className="academy-section-heading"><div><p className="eyebrow">DAILY LEARNING GOAL</p><h2>Small steps count</h2></div><Target size={18} /></div>
                {progress ? <><p>Complete 3 lessons or knowledge checks today.</p>
                <div className="academy-progress-track academy-goal-track"><span style={{ width: `${Math.min(100, todayActivities / 3 * 100)}%` }} /></div>
                <strong>{todayActivities} / 3 <small>learning activities today</small></strong>
                <p className="academy-muted">Your streak is based on saved lesson completions and quiz attempts.</p></> : <p className="academy-muted">Saved learning activity is unavailable.</p>}
              </section>
              <section className="academy-panel academy-skill-panel">
                <div className="academy-section-heading"><div><p className="eyebrow">SKILL PROGRESS</p><h2>By course</h2></div></div>
                {progress ? <div className="academy-skill-list">
                  {courses.map((course) => {
                    const done = course.lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length
                    return <div className="academy-skill-row" key={course.id}><div><span>{course.title}</span><small>{done}/{course.lessons.length}</small></div><div className="academy-progress-track"><span style={{ width: `${done / Math.max(1, course.lessons.length) * 100}%` }} /></div></div>
                  })}
                </div> : <p className="academy-muted">Saved skill progress is unavailable.</p>}
              </section>
              <section className="academy-panel academy-achievements-panel">
                <div className="academy-section-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Your learning timeline</h2></div><Clock3 size={18} /></div>
                {!progress
                  ? <p className="academy-muted">Saved learning activity is unavailable.</p>
                  : recentActivities.length
                  ? <div className="academy-achievement-list">{recentActivities.map((activity) => <div key={activity.id}><span className="academy-activity-mark">{activity.icon === 'lesson' ? <BookOpen size={14} /> : <Target size={14} />}</span><span><strong>{activity.title}</strong><small>{activity.detail} · {new Date(activity.createdAt).toLocaleDateString()}</small></span></div>)}</div>
                  : <p className="academy-muted">Your saved lesson and quiz activity will appear here.</p>}
              </section>
              <section className="academy-panel academy-achievements-panel">
                <div className="academy-section-heading"><div><p className="eyebrow">ACHIEVEMENTS</p><h2>Earned milestones</h2></div><Award size={18} /></div>
                {!progress
                  ? <p className="academy-muted">Saved achievements are unavailable.</p>
                  : progress.achievements.length
                  ? <div className="academy-achievement-list">{progress.achievements.slice(0, 4).map((achievement) => <div key={achievement.achievement_key}><CheckCircle2 size={15} /><span><strong>{achievement.title}</strong><small>{achievement.description}</small></span><b>+{achievement.points}</b></div>)}</div>
                  : <p className="academy-muted">Complete a lesson or pass a quiz to earn your first saved milestone.</p>}
              </section>
            </aside>
          </div>
        </>
      )}

      {mainTab === 'academy' && section === 'course' && activeCourse && (
        <section className="academy-panel academy-detail-panel">
          <button className="academy-back-link" onClick={() => setSection('dashboard')} type="button"><ArrowLeft size={15} /> All learning paths</button>
          <div className="academy-course-detail-heading"><span className="academy-course-icon large"><ShieldCheck size={23} /></span><div><p className="eyebrow">LEARNING PATH</p><h2>{activeCourse.title}</h2><p>{activeCourse.description}</p></div></div>
          <div className="academy-detail-actions">
            <button className="academy-button academy-button-primary" disabled={saving || offlineCatalog} onClick={() => void openQuiz(activeCourse)} type="button"><Target size={16} /> {offlineCatalog ? 'Quiz unavailable offline' : saving ? 'Loading quiz…' : 'Take course quiz'}</button>
            {(() => {
              const certificate = progress?.certificates.find((item) => item.course_id === activeCourse.id)
              const courseComplete = activeCourse.lessons.every((lesson) => completedLessonIds.has(lesson.id))
              const eligible = courseComplete && hasCoursePassed(activeCourse.id, progress)
              return certificate
                ? <button className="academy-button" onClick={() => { void downloadSavedCertificate(certificate, activeCourse.title) }} type="button"><Download size={15} /> Download certificate</button>
                : <button className="academy-button" disabled={!eligible || saving || offlineCatalog || !progress} onClick={() => void issueCertificate(activeCourse)} type="button"><Award size={15} /> {eligible ? 'Earn & download certificate' : 'Certificate: lessons + 80% quiz required'}</button>
            })()}
          </div>
          {actionError && <p className="academy-inline-error" role="alert">{actionError}</p>}
          <div className="academy-level-list">
            {activeCourse.lessons.map((lesson) => {
              const isComplete = completedLessonIds.has(lesson.id)
              return (
                <article className={`academy-lesson-row${isComplete ? ' is-complete' : ''}`} key={lesson.id}>
                  <span className={`academy-level-badge level-${lesson.difficulty}`}>{isComplete ? <Check size={15} /> : lesson.display_order.toString().padStart(2, '0')}</span>
                  <div className="academy-lesson-row-copy"><span className={`academy-difficulty level-text-${lesson.difficulty}`}>{difficultyLabels[lesson.difficulty]}</span><h3>{lesson.title}</h3><p><Clock3 size={13} /> {lesson.duration_minutes} min <span>·</span> {lesson.objectives.length} objectives</p></div>
                  <button className="academy-button academy-open-lesson" onClick={() => openLesson(lesson)} type="button">{isComplete ? 'Review lesson' : 'Start lesson'} <ArrowRight size={15} /></button>
                </article>
              )
            })}
          </div>
          <div className="academy-course-quiz-note"><Target size={17} /><span><strong>{activeCourse.questionCount} questions</strong><small> One question from each level. Your attempt and explanations are saved to your account.</small></span><button className="academy-text-button" onClick={() => setSection('history')} type="button">View quiz history</button></div>
        </section>
      )}

      {mainTab === 'academy' && section === 'lesson' && activeCourse && activeLesson && (
        <article className="academy-panel academy-lesson-detail">
          <button className="academy-back-link" onClick={() => setSection('course')} type="button"><ArrowLeft size={15} /> {activeCourse.title}</button>
          <div className="academy-lesson-title"><span className={`academy-level-badge level-${activeLesson.difficulty}`}>{difficultyLabels[activeLesson.difficulty].slice(0, 1)}</span><div><p className={`academy-difficulty level-text-${activeLesson.difficulty}`}>{difficultyLabels[activeLesson.difficulty]} · {activeLesson.duration_minutes} MIN</p><h2>{activeLesson.title}</h2></div></div>
          <section className="academy-lesson-section"><h3>Learning objectives</h3><ul>{activeLesson.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul></section>
          <section className="academy-lesson-section"><h3>Understand the concept</h3><p>{activeLesson.explanation}</p></section>
          <section className="academy-lesson-section academy-example-section"><h3><Sparkles size={16} /> Practical example</h3><p>{activeLesson.practical_example}</p></section>
          <section className="academy-lesson-section"><h3>Important concepts</h3><div className="academy-concept-list">{activeLesson.important_concepts.map((concept) => <span key={concept}>{concept}</span>)}</div></section>
          <section className="academy-lesson-section academy-scenario-section"><h3>Real-world scenario</h3><p>{activeLesson.scenario}</p></section>
          <section className="academy-lesson-section"><h3>Key takeaways</h3><ul>{activeLesson.key_takeaways.map((takeaway) => <li key={takeaway}>{takeaway}</li>)}</ul></section>
          <div className="academy-lesson-actions"><button className="academy-button" disabled={offlineCatalog} onClick={startTutorForLesson} type="button"><MessageCircle size={15} /> Ask the AI tutor</button><button className="academy-button academy-button-primary" disabled={saving || offlineCatalog || completedLessonIds.has(activeLesson.id)} onClick={() => void markLessonComplete()} type="button">{completedLessonIds.has(activeLesson.id) ? <><Check size={16} /> Completed</> : <><CheckCircle2 size={16} /> {offlineCatalog ? 'Completion unavailable offline' : saving ? 'Saving…' : 'Mark lesson complete'}</>}</button></div>
          {actionError && <p className="academy-inline-error" role="alert">{actionError}</p>}
          <p className="academy-privacy-note"><LockKeyhole size={13} /> Completion saves to your authenticated account. Lesson time is measured only while this lesson is open.</p>
        </article>
      )}

      {mainTab === 'academy' && section === 'quiz' && activeCourse && (
        <section className="academy-panel academy-quiz-panel">
          <button className="academy-back-link" onClick={() => setSection('course')} type="button"><ArrowLeft size={15} /> {activeCourse.title}</button>
          <div className="academy-section-heading"><div><p className="eyebrow">KNOWLEDGE CHECK</p><h2>{activeCourse.title}</h2><p>Choose an answer for each question. Scoring and explanations come from the server.</p></div><Target size={22} /></div>
          {quizResult ? (
            <div className="academy-quiz-result">
              <div className={`academy-score-ring${quizResult.score >= 80 ? ' score-pass' : ''}`}><strong>{quizResult.score}%</strong><span>score</span></div>
              <h3>{quizResult.score >= 80 ? 'Knowledge check passed' : 'Keep learning and try again'}</h3>
              <p>{quizResult.correct_count} of {quizResult.total_questions} correct. {quizResult.score >= 80 ? 'Your saved result counts toward certificate eligibility.' : 'An 80% score is required for a certificate.'}</p>
              <div className="academy-answer-review">{quizQuestions.map((question) => {
                const explanation = quizResult.explanations.find((entry) => entry.questionId === question.id)
                const correct = explanation?.correctOptionIds ?? []
                const selected = answers[question.id] ?? []
                const gotItRight = selected.length === correct.length && selected.every((option) => correct.includes(option))
                return <article className={`academy-review-item${gotItRight ? ' answer-correct' : ' answer-incorrect'}`} key={question.id}><strong>{gotItRight ? 'Correct' : 'Review'} · {question.prompt}</strong><p>{explanation?.explanation}</p><small>Correct answer: {question.options.filter((option) => correct.includes(option.id)).map((option) => option.text).join(', ')}</small></article>
              })}</div>
              <div className="academy-lesson-actions"><button className="academy-button" onClick={() => setSection('course')} type="button">Back to path</button><button className="academy-button academy-button-primary" disabled={offlineCatalog} onClick={() => void openQuiz(activeCourse)} type="button"><RefreshCw size={15} /> Retry quiz</button></div>
            </div>
          ) : (
            <>
              <div className="academy-quiz-questions">{quizQuestions.map((question, index) => (
                <article className="academy-question" key={question.id}>
                  <div className="academy-question-meta"><span>QUESTION {index + 1} OF {quizQuestions.length}</span><span className={`academy-difficulty level-text-${question.difficulty}`}>{difficultyLabels[question.difficulty]}</span></div>
                  <h3>{question.prompt}</h3>
                  {question.multiple_select && <p className="academy-muted">Select all that apply.</p>}
                  <div className="academy-options">{question.options.map((option) => {
                    const selected = (answers[question.id] ?? []).includes(option.id)
                    return <button aria-pressed={selected} className={`academy-option${selected ? ' option-selected' : ''}`} key={option.id} onClick={() => chooseAnswer(question, option.id)} type="button"><span className="academy-option-mark">{selected && <Check size={14} />}</span>{option.text}</button>
                  })}</div>
                </article>
              ))}</div>
              {actionError && <p className="academy-inline-error" role="alert">{actionError}</p>}
              <button className="academy-button academy-button-primary" disabled={offlineCatalog || saving || quizQuestions.length === 0 || quizQuestions.some((question) => !(answers[question.id]?.length))} onClick={() => void submitCurrentQuiz()} type="button"><CheckCircle2 size={16} /> {offlineCatalog ? 'Scoring unavailable offline' : saving ? 'Scoring securely…' : 'Submit answers'}</button>
            </>
          )}
        </section>
      )}

      {mainTab === 'academy' && section === 'history' && (
        <section className="academy-panel academy-history-panel">
          <button className="academy-back-link" onClick={() => { setSection('dashboard'); setMainTab('academy') }} type="button"><ArrowLeft size={15} /> Learning dashboard</button>
          <div className="academy-section-heading"><div><p className="eyebrow">YOUR SAVED RESULTS</p><h2>Quiz history</h2></div><Clock3 size={20} /></div>
          {!progress
            ? <div className="academy-empty"><Target size={23} /><h3>Quiz history unavailable</h3><p>Reconnect to retrieve your saved results.</p></div>
            : !progress.attempts.length
            ? <div className="academy-empty"><Target size={23} /><h3>No quiz attempts yet</h3><p>Your submitted attempts and scores will appear here.</p></div>
            : <div className="academy-history-list">{progress.attempts.map((attempt) => <article key={attempt.id}><span className="academy-course-icon"><Target size={17} /></span><div><strong>{courses.find((course) => course.id === attempt.course_id)?.title ?? 'Cybersecurity course'}</strong><small>{new Date(attempt.created_at).toLocaleString()} · {attempt.correct_count}/{attempt.total_questions} correct</small></div><b className={attempt.score >= 80 ? 'score-good' : 'score-needs-work'}>{attempt.score}%</b></article>)}</div>}
        </section>
      )}

      {mainTab === 'labs' && (
        <div className="academy-labs">
          <section className="academy-panel academy-labs-intro"><span className="academy-course-icon large"><FlaskConical size={23} /></span><div><p className="eyebrow">AUTHORIZED, ISOLATED EXERCISES</p><h2>Practical cyber lab</h2><p>These exercises run locally in your browser using sample-only data. Nothing is sent to a scanner or external system.</p></div></section>
          <div className="academy-lab-grid">
            <article className="academy-panel academy-lab-card"><div className="academy-lab-title"><LockKeyhole size={18} /><div><h3>Password strength check</h3><small>Local-only heuristic · never stored or transmitted</small></div></div><label className="academy-label" htmlFor="sample-password">Use a made-up sample, never a real password</label><input id="sample-password" autoComplete="off" onChange={(event) => setPasswordSample(event.target.value)} placeholder="Type a fictional sample" type="password" value={passwordSample} /><div className="academy-progress-track"><span style={{ width: `${passwordSignals.score}%` }} /></div><strong>{passwordSignals.label}</strong><ul className="academy-lab-checks">{passwordSignals.signals.map((signal) => <li key={signal}><Check size={13} /> {signal}</li>)}</ul><p className="academy-muted">This simple teaching heuristic is not a password audit or guarantee. Prefer a password manager and unique credentials.</p></article>
            <article className="academy-panel academy-lab-card"><div className="academy-lab-title"><ShieldCheck size={18} /><div><h3>Spot a suspicious URL</h3><small>Fictional practice addresses only</small></div></div>{phishingExamples.map((example, index) => <div className="academy-phishing-exercise" key={example.url}><code>{example.url}</code><div><button aria-pressed={phishingAnswers[index] === true} className={phishingAnswers[index] === true ? 'selected' : ''} onClick={() => setPhishingAnswers((current) => ({ ...current, [index]: true }))} type="button">Suspicious</button><button aria-pressed={phishingAnswers[index] === false} className={phishingAnswers[index] === false ? 'selected' : ''} onClick={() => setPhishingAnswers((current) => ({ ...current, [index]: false }))} type="button">Looks expected</button></div>{index in phishingAnswers && <p className={phishingAnswers[index] === example.suspicious ? 'lab-feedback-good' : 'lab-feedback-review'}>{phishingAnswers[index] === example.suspicious ? 'Good call. ' : 'Review this example. '}{example.explanation}</p>}</div>)}</article>
            <article className="academy-panel academy-lab-card"><div className="academy-lab-title"><MessageCircle size={18} /><div><h3>Read an email header</h3><small>Synthetic learning example</small></div></div><div className="academy-header-example"><p><b>From:</b> billing@example.invalid</p><p><b>Reply-To:</b> payment-help@unfamiliar.invalid</p><p><b>Authentication-Results:</b> spf=fail; dkim=none</p><p><b>Received:</b> by mail.training.invalid</p></div><p>The visible sender and Reply-To can differ. SPF/DKIM signals help administrators evaluate sending domains, but a “pass” does not guarantee message intent is trustworthy.</p><details><summary>What should a learner check?</summary><p>Compare the sender domain with a trusted source, inspect unexpected Reply-To values, interpret authentication results in context, and report using the organization’s approved channel.</p></details></article>
            <article className="academy-panel academy-lab-card"><div className="academy-lab-title"><Target size={18} /><div><h3>Network security basics</h3><small>Safe concept matching</small></div></div><div className="academy-concept-row"><strong>Segmentation</strong><span>Separates systems so guest devices cannot reach business resources.</span></div><div className="academy-concept-row"><strong>Encryption in transit</strong><span>Helps protect data as it moves between endpoints.</span></div><div className="academy-concept-row"><strong>Least privilege</strong><span>Allows only the access needed for a specific task.</span></div><p className="academy-muted">All examples are conceptual; no network scanning is performed.</p></article>
            <article className="academy-panel academy-lab-card"><div className="academy-lab-title"><Clock3 size={18} /><div><h3>Safe log analysis</h3><small>Choose the entries that deserve review</small></div></div><div className="academy-log-list">{safeLogExamples.map((entry, index) => <label key={entry.line}><input checked={selectedLogLines.includes(index)} onChange={(event) => { setLogsChecked(false); setSelectedLogLines((current) => event.target.checked ? [...current, index] : current.filter((value) => value !== index)) }} type="checkbox" /><code>{entry.line}</code></label>)}</div><button className="academy-button" onClick={() => setLogsChecked(true)} type="button">Check selected entries</button>{logsChecked && <p className={selectedLogLines.length === safeLogExamples.filter((entry) => entry.concern).length && safeLogExamples.every((entry, index) => selectedLogLines.includes(index) === entry.concern) ? 'lab-feedback-good' : 'lab-feedback-review'}>{selectedLogLines.length === safeLogExamples.filter((entry) => entry.concern).length && safeLogExamples.every((entry, index) => selectedLogLines.includes(index) === entry.concern) ? 'Good review. These are the entries worth investigating.' : 'Review your choices. Look for denied access and unexpected MFA signals.'} A warning or alert is a signal, not proof of compromise.</p>}</article>
            <article className="academy-panel academy-lab-card academy-code-lab"><div className="academy-lab-title"><BookOpen size={18} /><div><h3>Secure coding: injection and XSS</h3><small>Read-only prevention demonstrations</small></div></div><h4>SQL injection prevention</h4><pre><code>{`// Keep query structure separate from data\nconst result = await db.query(\n  'SELECT id FROM users WHERE email = $1',\n  [email],\n)`}</code></pre><p>Use your database driver’s parameter binding. Do not concatenate user input into SQL.</p><h4>XSS prevention</h4><pre><code>{`// Render user content as text, not HTML\n<span>{commentText}</span>`}</code></pre><p>React escapes text interpolation. Do not use raw HTML rendering for untrusted input.</p><label className="academy-label" htmlFor="harmless-xss">Harmless text-rendering preview</label><input id="harmless-xss" onChange={(event) => setXssSample(event.target.value)} placeholder="For example: &lt;b&gt;not HTML&lt;/b&gt;" value={xssSample} /><div className="academy-safe-preview"><strong>Rendered as text:</strong><span>{xssSample || 'Your sample appears here as text, never executed.'}</span></div></article>
          </div>
        </div>
      )}

      {mainTab === 'tutor' && (
        <section className="academy-panel academy-tutor-panel">
          <div className="academy-section-heading"><div><p className="eyebrow">PERSONALIZED CYBER TUTOR</p><h2>Ask, practice, understand</h2><p>Responses use the configured AI provider. If it is unavailable, you’ll see an explicit error.</p></div><span className="academy-tutor-icon"><Sparkles size={21} /></span></div>
          <div className="academy-tutor-controls">
            <label><Languages size={14} />Language<select onChange={(event) => setTutorLanguage(event.target.value as Language)} value={tutorLanguage}><option value="en">English</option><option value="te">Telugu</option><option value="hi">Hindi</option></select></label>
            <label>Learning level<select onChange={(event) => setTutorLevel(event.target.value as Difficulty)} value={tutorLevel}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
            <label>Help me<select onChange={(event) => setTutorIntent(event.target.value as typeof tutorIntent)} value={tutorIntent}><option value="explain">Explain a concept</option><option value="practice">Generate practice questions</option><option value="mistakes">Explain quiz mistakes</option><option value="recommend">Recommend what to learn next</option></select></label>
          </div>
          <div className="academy-chat-thread" aria-live="polite">
            {!tutorMessages.length && <div className="academy-empty"><MessageCircle size={23} /><h3>Your learning companion</h3><p>Ask a question about a lesson, request a step-by-step explanation, or generate practice questions in English, Telugu, or Hindi.</p></div>}
            {tutorMessages.map((message) => <article className="academy-chat-message" key={message.id}><div className="academy-chat-question"><span>You</span><p>{message.question}</p></div>{message.answer && <div className="academy-chat-answer"><span><Sparkles size={14} /> CyberSaathi tutor</span><p>{message.answer}</p>{message.questions?.map((question, index) => <details className="academy-generated-question" key={`${message.id}-${index}`}><summary>Practice {index + 1}: {question.prompt}</summary><ol>{question.options.map((option, optionIndex) => <li key={option}>{option}{question.correctOptionIndexes.includes(optionIndex) && <b> — Answer</b>}</li>)}</ol><p>{question.explanation}</p></details>)}</div>}{message.error && <p className="academy-inline-error" role="alert">{message.error}</p>}</article>)}
            {tutorSending && <p className="academy-tutor-loading" role="status"><Sparkles size={14} /> Waiting for the configured AI provider…</p>}
          </div>
          <form className="academy-tutor-form" onSubmit={(event) => void submitTutorMessage(event)}><textarea aria-label="Ask the cybersecurity tutor" disabled={offlineCatalog} maxLength={2000} onChange={(event) => setTutorInput(event.target.value)} placeholder={offlineCatalog ? 'AI tutoring requires a connection.' : tutorIntent === 'practice' ? 'Which topic should the tutor create safe practice questions about?' : tutorIntent === 'mistakes' ? 'Ask about the quiz feedback or a specific answer.' : 'Ask a cybersecurity question…'} rows={3} value={tutorInput} /><button className="academy-button academy-button-primary" disabled={offlineCatalog || tutorSending || !tutorInput.trim()} type="submit"><Send size={15} /> Send to AI tutor</button></form>
          <p className="academy-privacy-note"><LockKeyhole size={13} /> Do not share passwords, verification codes, or confidential data. Tutor messages are sent to the configured AI provider and are not saved as learning progress.</p>
          {profile?.full_name || user?.user_metadata.full_name ? <span className="academy-signed-in">Personalized for {profile?.full_name || user?.user_metadata.full_name}</span> : null}
        </section>
      )}
      <footer className="academy-footer"><ShieldCheck size={14} /> Original educational content · Safe practice only · Progress is stored to your authenticated account</footer>
    </section>
  )
}
