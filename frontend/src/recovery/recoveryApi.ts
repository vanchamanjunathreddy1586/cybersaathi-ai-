import { API_BASE_URL } from '../services/apiBaseUrl.ts'

export interface GoldenHourStep {
  id: string
  order: number
  action: string
  detail: string
  isImmediate: boolean
  authority: string
  tip?: string
}

export interface LegalSection {
  code: string
  act: string
  title: string
  description: string
  penalty: string
  equivalentSections?: string
}

export interface OfficialPortal {
  name: string
  url: string
  purpose: string
  contact?: string
}

export interface FraudVector {
  id: string
  title: string
  category: string
  urgencyLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM'
  shortDescription: string
  commonScenarios: string[]
  goldenHourMinutes: number
  goldenHourChecklist: GoldenHourStep[]
  evidenceToCollect: string[]
  legalSections: LegalSection[]
  officialPortals: OfficialPortal[]
  recoveryTips: string[]
}

export interface VectorSummary {
  id: string
  title: string
  category: string
  urgencyLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM'
  shortDescription: string
  goldenHourMinutes: number
  totalChecklistSteps: number
}

export interface Helpline {
  name: string
  number: string
  timing: string
  scope: string
  portal: string
}

export interface BankEmergencyContact {
  bankName: string
  tollFree: string
  alternateNumber?: string
  smsBlockCommand?: string
  smsBlockNumber?: string
  portalUrl?: string
}

export interface EmergencyDirectory {
  helplines: Helpline[]
  bankContacts: BankEmergencyContact[]
}

export interface ComplaintInput {
  victimName: string
  victimPhone: string
  victimEmail: string
  victimAddress: string
  cityState: string
  incidentDate: string
  incidentTime: string
  vectorId: string
  policeStation?: string
  lossAmountInr?: number
  bankName?: string
  accountNumberLast4?: string
  transactionIdUtr?: string
  accusedIdentifier?: string
  cybercrimeAckNumber?: string
  incidentChronology: string
  evidenceList: string[]
}

export interface ComplaintDraftResult {
  formattedText: string
  subjectLine: string
  applicableSections: string[]
  reliefSought: string[]
  annexures: string[]
  generatedAt: string
}

export class RecoveryApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'RecoveryApiError'
    this.status = status
  }
}

async function requestJson<T>(
  path: string,
  options?: {
    method?: string
    body?: unknown
    accessToken?: string
  },
): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15_000)

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    }
    if (options?.body) {
      headers['Content-Type'] = 'application/json'
    }
    if (options?.accessToken) {
      headers['Authorization'] = `Bearer ${options.accessToken}`
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options?.method ?? 'GET',
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
      credentials: 'omit',
    })

    let json: unknown
    try {
      json = await response.json()
    } catch {
      throw new RecoveryApiError('The recovery service returned an invalid response.', response.status)
    }

    if (!response.ok) {
      const message =
        typeof json === 'object' && json !== null && 'message' in json && typeof (json as { message: unknown }).message === 'string'
          ? (json as { message: string }).message
          : `Recovery request failed (${response.status})`
      throw new RecoveryApiError(message, response.status)
    }

    const result = json as { success: boolean; data: T }
    return result.data
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function fetchRecoveryVectors(): Promise<VectorSummary[]> {
  return requestJson<VectorSummary[]>('/api/recovery/vectors')
}

export async function fetchRecoveryVector(id: string): Promise<FraudVector> {
  return requestJson<FraudVector>(`/api/recovery/vectors/${encodeURIComponent(id)}`)
}

export async function fetchEmergencyDirectory(): Promise<EmergencyDirectory> {
  return requestJson<EmergencyDirectory>('/api/recovery/contacts')
}

export async function draftPoliceComplaint(input: ComplaintInput): Promise<ComplaintDraftResult> {
  return requestJson<ComplaintDraftResult>('/api/recovery/draft-complaint', {
    method: 'POST',
    body: input,
  })
}

export async function bridgeRecoveryToInvestigation(
  accessToken: string,
  data: {
    vectorId: string
    lossAmountInr?: number
    complaintText: string
    transactionIdUtr?: string
    evidenceCount: number
  },
): Promise<{ id: string; title: string }> {
  return requestJson<{ id: string; title: string }>('/api/recovery/investigation', {
    method: 'POST',
    accessToken,
    body: data,
  })
}
