import { API_BASE_URL } from '../services/apiBaseUrl'

export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

export interface AcademyLesson {
  id: string
  course_id: string
  title: string
  difficulty: Difficulty
  duration_minutes: number
  objectives: string[]
  explanation: string
  practical_example: string
  important_concepts: string[]
  scenario: string
  key_takeaways: string[]
  display_order: number
}

export interface AcademyCourse {
  id: string
  title: string
  description: string
  display_order: number
  lessons: AcademyLesson[]
  questionCount: number
}

export interface AcademyCatalog {
  courses: AcademyCourse[]
  offline: boolean
}

export interface AcademyQuestion {
  id: string
  course_id: string
  lesson_id: string
  difficulty: Difficulty
  prompt: string
  options: { id: string; text: string }[]
  multiple_select: boolean
}

export interface AcademyProgress {
  lessons: { lesson_id: string; completed_at: string; time_spent_seconds: number }[]
  attempts: {
    id: string
    course_id: string
    correct_count: number
    total_questions: number
    score: number
    created_at: string
  }[]
  achievements: {
    achievement_key: string
    title: string
    description: string
    points: number
    awarded_at: string
  }[]
  certificates: {
    id: string
    course_id: string
    student_name: string
    certificate_reference: string
    completed_at: string
  }[]
}

export interface QuizResult {
  attempt_id: string
  correct_count: number
  total_questions: number
  score: number
  explanations: {
    questionId: string
    correctOptionIds: string[]
    explanation: string
  }[]
}

export interface Certificate {
  id: string
  course_id: string
  student_name: string
  certificate_reference: string
  completed_at: string
}

export interface TutorResponse {
  answer: string
  questions: {
    prompt: string
    options: string[]
    correctOptionIndexes: number[]
    explanation: string
  }[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function stringField(value: Record<string, unknown>, key: string): string {
  const field = value[key]
  if (typeof field !== 'string') throw new Error('The academy returned invalid content.')
  return field
}

function numberField(value: Record<string, unknown>, key: string): number {
  const field = value[key]
  if (typeof field !== 'number' || !Number.isFinite(field)) {
    throw new Error('The academy returned invalid progress data.')
  }
  return field
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error('The academy returned invalid lesson content.')
  }
  return value
}

function parseDifficulty(value: unknown): Difficulty {
  if (value !== 'beginner' && value !== 'intermediate' && value !== 'advanced') {
    throw new Error('The academy returned an unsupported difficulty.')
  }
  return value
}

function parseLesson(value: unknown): AcademyLesson {
  if (!isRecord(value)) throw new Error('The academy returned invalid lesson content.')
  return {
    id: stringField(value, 'id'),
    course_id: stringField(value, 'course_id'),
    title: stringField(value, 'title'),
    difficulty: parseDifficulty(value.difficulty),
    duration_minutes: numberField(value, 'duration_minutes'),
    objectives: stringArray(value.objectives),
    explanation: stringField(value, 'explanation'),
    practical_example: stringField(value, 'practical_example'),
    important_concepts: stringArray(value.important_concepts),
    scenario: stringField(value, 'scenario'),
    key_takeaways: stringArray(value.key_takeaways),
    display_order: numberField(value, 'display_order'),
  }
}

function parseCourse(value: unknown): AcademyCourse {
  if (!isRecord(value) || !Array.isArray(value.lessons)) {
    throw new Error('The academy returned invalid course content.')
  }
  return {
    id: stringField(value, 'id'),
    title: stringField(value, 'title'),
    description: stringField(value, 'description'),
    display_order: numberField(value, 'display_order'),
    lessons: value.lessons.map(parseLesson),
    questionCount: numberField(value, 'questionCount'),
  }
}

function parseQuestion(value: unknown): AcademyQuestion {
  if (!isRecord(value) || !Array.isArray(value.options)) {
    throw new Error('The academy returned an invalid quiz.')
  }
  const options = value.options.map((option) => {
    if (!isRecord(option)) throw new Error('The academy returned an invalid quiz option.')
    return { id: stringField(option, 'id'), text: stringField(option, 'text') }
  })
  if (typeof value.multiple_select !== 'boolean') {
    throw new Error('The academy returned an invalid quiz.')
  }
  return {
    id: stringField(value, 'id'),
    course_id: stringField(value, 'course_id'),
    lesson_id: stringField(value, 'lesson_id'),
    difficulty: parseDifficulty(value.difficulty),
    prompt: stringField(value, 'prompt'),
    options,
    multiple_select: value.multiple_select,
  }
}

async function request<T>(
  path: string,
  accessToken: string,
  parse: (value: unknown) => T,
  body?: unknown,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/academy${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      credentials: 'omit',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('The academy API could not be reached. Check your connection and try again.')
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('The academy API returned an invalid response.')
  }
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.message === 'string'
      ? payload.message
      : 'The academy request could not be completed.'
    throw new Error(message)
  }
  return parse(payload)
}

function envelopeData<T>(
  value: unknown,
  key: string,
  parse: (value: unknown) => T,
): T {
  if (!isRecord(value) || value.success !== true || !(key in value)) {
    throw new Error('The academy response was incomplete.')
  }
  return parse(value[key])
}

const publicCatalogCacheKey = 'cybersaathi-public-academy-catalog-v1'

function readCachedCourses(): AcademyCourse[] | null {
  const cached = localStorage.getItem(publicCatalogCacheKey)
  if (!cached) return null
  const parsed: unknown = JSON.parse(cached)
  if (!Array.isArray(parsed)) throw new Error('The saved offline academy content is invalid.')
  return parsed.map(parseCourse)
}

export async function loadCourses(accessToken: string): Promise<AcademyCatalog> {
  try {
    const courses = await request('/courses', accessToken, (value) =>
      envelopeData(value, 'courses', (rows) =>
        Array.isArray(rows) ? rows.map(parseCourse) : (() => { throw new Error('Invalid courses.') })(),
      ),
    )
    try {
      localStorage.setItem(publicCatalogCacheKey, JSON.stringify(courses))
    } catch (error) {
      console.warn('Public academy lessons could not be saved for offline reading.', error)
    }
    return { courses, offline: false }
  } catch (error) {
    try {
      const cachedCourses = readCachedCourses()
      if (cachedCourses) return { courses: cachedCourses, offline: true }
    } catch (cacheError) {
      if (cacheError instanceof Error && cacheError.message === 'The saved offline academy content is invalid.') {
        throw cacheError
      }
      throw new Error('Previously loaded academy content could not be read from this device.', {
        cause: cacheError,
      })
    }
    throw error
  }
}

export function loadProgress(accessToken: string): Promise<AcademyProgress> {
  return request('/progress', accessToken, (value) =>
    envelopeData(value, 'progress', (progress) => {
      if (!isRecord(progress)) throw new Error('Invalid learning progress.')
      const lessonRows = progress.lessons
      const attemptRows = progress.attempts
      const achievementRows = progress.achievements
      const certificateRows = progress.certificates
      if (
        !Array.isArray(lessonRows) ||
        !Array.isArray(attemptRows) ||
        !Array.isArray(achievementRows) ||
        !Array.isArray(certificateRows)
      ) {
        throw new Error('Invalid learning progress.')
      }
      return {
        lessons: lessonRows.map((row) => {
          if (!isRecord(row)) throw new Error('Invalid lesson progress.')
          return {
            lesson_id: stringField(row, 'lesson_id'),
            completed_at: stringField(row, 'completed_at'),
            time_spent_seconds: numberField(row, 'time_spent_seconds'),
          }
        }),
        attempts: attemptRows.map((row) => {
          if (!isRecord(row)) throw new Error('Invalid quiz history.')
          return {
            id: stringField(row, 'id'),
            course_id: stringField(row, 'course_id'),
            correct_count: numberField(row, 'correct_count'),
            total_questions: numberField(row, 'total_questions'),
            score: numberField(row, 'score'),
            created_at: stringField(row, 'created_at'),
          }
        }),
        achievements: achievementRows.map((row) => {
          if (!isRecord(row)) throw new Error('Invalid achievements.')
          return {
            achievement_key: stringField(row, 'achievement_key'),
            title: stringField(row, 'title'),
            description: stringField(row, 'description'),
            points: numberField(row, 'points'),
            awarded_at: stringField(row, 'awarded_at'),
          }
        }),
        certificates: certificateRows.map((row) => {
          if (!isRecord(row)) throw new Error('Invalid certificates.')
          return {
            id: stringField(row, 'id'),
            course_id: stringField(row, 'course_id'),
            student_name: stringField(row, 'student_name'),
            certificate_reference: stringField(row, 'certificate_reference'),
            completed_at: stringField(row, 'completed_at'),
          }
        }),
      }
    }),
  )
}

export function loadQuiz(accessToken: string, courseId: string): Promise<AcademyQuestion[]> {
  return request(`/courses/${encodeURIComponent(courseId)}/quiz`, accessToken, (value) =>
    envelopeData(value, 'questions', (questions) =>
      Array.isArray(questions) ? questions.map(parseQuestion) : (() => { throw new Error('Invalid quiz.') })(),
    ),
  )
}

export function completeLesson(
  accessToken: string,
  lessonId: string,
  timeSpentSeconds: number,
): Promise<{ completed: boolean }> {
  return request(`/lessons/${encodeURIComponent(lessonId)}/complete`, accessToken, (value) =>
    envelopeData(value, 'result', (result) => {
      if (!Array.isArray(result) || !isRecord(result[0]) || typeof result[0].completed !== 'boolean') {
        throw new Error('The lesson completion response was invalid.')
      }
      return { completed: result[0].completed }
    }),
    { timeSpentSeconds },
  )
}

export function submitQuiz(
  accessToken: string,
  courseId: string,
  answers: Record<string, string[]>,
): Promise<QuizResult> {
  return request(`/courses/${encodeURIComponent(courseId)}/quiz-attempts`, accessToken, (value) =>
    envelopeData(value, 'result', (result) => {
      if (!isRecord(result)) throw new Error('The quiz result was invalid.')
      if (!Array.isArray(result.explanations)) throw new Error('The quiz result was invalid.')
      return {
        attempt_id: stringField(result, 'attempt_id'),
        correct_count: numberField(result, 'correct_count'),
        total_questions: numberField(result, 'total_questions'),
        score: numberField(result, 'score'),
        explanations: result.explanations.map((entry) => {
          if (!isRecord(entry)) throw new Error('The quiz explanation was invalid.')
          return {
            questionId: stringField(entry, 'questionId'),
            correctOptionIds: stringArray(entry.correctOptionIds),
            explanation: stringField(entry, 'explanation'),
          }
        }),
      }
    }),
    { answers },
  )
}

export function createCertificate(
  accessToken: string,
  courseId: string,
): Promise<Certificate> {
  return request(`/courses/${encodeURIComponent(courseId)}/certificate`, accessToken, (value) =>
    envelopeData(value, 'certificate', (certificate) => {
      if (!isRecord(certificate)) throw new Error('The certificate response was invalid.')
      return {
        id: stringField(certificate, 'id'),
        course_id: stringField(certificate, 'course_id'),
        student_name: stringField(certificate, 'student_name'),
        certificate_reference: stringField(certificate, 'certificate_reference'),
        completed_at: stringField(certificate, 'completed_at'),
      }
    }),
    {},
  )
}

export function askTutor(
  accessToken: string,
  input: {
    question: string
    language: 'en' | 'te' | 'hi'
    level: Difficulty
    intent: 'explain' | 'practice' | 'mistakes' | 'recommend'
    lessonContext: string
  },
): Promise<TutorResponse> {
  return request('/tutor', accessToken, (value) =>
    envelopeData(value, 'answer', (answer) => {
      if (typeof answer !== 'string') throw new Error('The tutor response was invalid.')
      const questions = isRecord(value) && Array.isArray(value.questions) ? value.questions : []
      return {
        answer,
        questions: questions.map((question) => {
          if (!isRecord(question) || !Array.isArray(question.options) || !Array.isArray(question.correctOptionIndexes)) {
            throw new Error('The tutor practice question was invalid.')
          }
          if (
            !question.options.every((option) => typeof option === 'string') ||
            !question.correctOptionIndexes.every((index) => typeof index === 'number')
          ) {
            throw new Error('The tutor practice question was invalid.')
          }
          return {
            prompt: stringField(question, 'prompt'),
            options: question.options,
            correctOptionIndexes: question.correctOptionIndexes,
            explanation: stringField(question, 'explanation'),
          }
        }),
      }
    }),
    input,
  )
}
