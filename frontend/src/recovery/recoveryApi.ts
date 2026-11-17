import { API_BASE_URL } from '../services/apiBaseUrl.ts'
import {
  FRAUD_VECTORS,
  BANK_EMERGENCY_CONTACTS,
  EMERGENCY_HELPLINES,
  type FraudVector,
  type BankEmergencyContact,
} from './recoveryData.ts'

export type { FraudVector, BankEmergencyContact }

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
  const timeout = window.setTimeout(() => controller.abort(), 12_000)

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

function getLocalVectorSummaries(): VectorSummary[] {
  return Object.values(FRAUD_VECTORS).map((vector) => ({
    id: vector.id,
    title: vector.title,
    category: vector.category,
    urgencyLevel: vector.urgencyLevel,
    shortDescription: vector.shortDescription,
    goldenHourMinutes: vector.goldenHourMinutes,
    totalChecklistSteps: vector.goldenHourChecklist.length,
  }))
}

function getLocalEmergencyDirectory(): EmergencyDirectory {
  return {
    helplines: EMERGENCY_HELPLINES,
    bankContacts: BANK_EMERGENCY_CONTACTS,
  }
}

function generateLocalPoliceComplaint(input: ComplaintInput): ComplaintDraftResult {
  const vector = FRAUD_VECTORS[input.vectorId]
  const vectorTitle = vector ? vector.title : 'Cyber Crime Incident'
  const applicableSections = vector
    ? vector.legalSections.map((s) => `${s.code} ${s.act} (${s.title})`)
    : ['Section 66D Information Technology Act (Cheating by personation using computer resource)']

  const dateFormatted = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const subjectLine = `FORMAL COMPLAINT REGARDING ${vectorTitle.toUpperCase()} & FRAUDULENT MISAPPROPRIATION OF FUNDS UNDER ${applicableSections.slice(0, 2).join(' & ')}`

  const reliefSought = [
    'Registration of a formal First Information Report (FIR) / Cyber Crime Complaint under the cited sections of the Information Technology Act and Bharatiya Nyaya Sanhita.',
    'Immediate issuance of an electronic preservation & debit-freeze order under Section 106 of the Bharatiya Nagarik Suraksha Sanhita (BNSS) / Section 102 of CrPC to the beneficiary bank(s) and intermediaries to secure the defrauded amount.',
    'Requisition of IP login logs, MAC addresses, device fingerprints, IMEI, and call detail records (CDR) from telecom service providers and intermediaries under Section 94 BNSS / Section 91 CrPC.',
    'Facilitation of lawful recovery and restitution of defrauded funds to the complainant in accordance with RBI and regulatory guidelines.',
  ]

  const lossText = input.lossAmountInr !== undefined && input.lossAmountInr > 0
    ? `Total Defrauded Amount: ₹${input.lossAmountInr.toLocaleString('en-IN')}/- (Indian Rupees)`
    : 'Financial Loss: As detailed in bank debit records.'

  const ackText = input.cybercrimeAckNumber
    ? `National Cybercrime Reporting Portal (1930 / cybercrime.gov.in) Ack No.: ${input.cybercrimeAckNumber}`
    : 'NCRP Ack: Pending registration / logged via 1930 Helpline.'

  const policeStationText = input.policeStation || 'Cyber Crime Police Station / Local Police Station'

  const formattedText = `
TO,
THE STATION HOUSE OFFICER / OFFICER-IN-CHARGE,
${policeStationText.toUpperCase()},
${input.cityState.toUpperCase()}.

DATE: ${dateFormatted}

SUBJECT: ${subjectLine}

RESPECTED SIR / MADAM,

I, the undersigned complainant, wish to bring to your immediate official notice an incident of serious cybercrime, deceit, and financial fraud committed against me. The details of the incident and parties involved are submitted hereunder for appropriate criminal action:

1. PARTICULARS OF THE COMPLAINANT:
--------------------------------------------------------------------------------
Name               : ${input.victimName}
Contact Number     : ${input.victimPhone}
Email Address      : ${input.victimEmail}
Residential Address: ${input.victimAddress}, ${input.cityState}

2. INCIDENT & TRANSACTION PARTICULARS:
--------------------------------------------------------------------------------
Category of Crime  : ${vectorTitle}
Date & Time        : ${input.incidentDate} at approximately ${input.incidentTime}
${lossText}
Bank Name          : ${input.bankName ?? 'N/A'}
Debited Account    : ${input.accountNumberLast4 ? `Account ending in ${input.accountNumberLast4}` : 'As attached in bank statement'}
Transaction Ref/UTR: ${input.transactionIdUtr ?? 'N/A'}
Accused Details    : ${input.accusedIdentifier ?? 'Unidentified cyber fraudster(s) operating through digital channels / mule accounts'}
${ackText}

3. CHRONOLOGICAL STATEMENT OF FACTS:
--------------------------------------------------------------------------------
${input.incidentChronology}

4. APPLICABLE LEGAL PROVISIONS:
--------------------------------------------------------------------------------
The aforementioned fraudulent conduct prima facie constitutes cognizable criminal offences under:
${applicableSections.map((sec, idx) => `  ${idx + 1}. ${sec}`).join('\n')}
along with other relevant provisions of the Bharatiya Nyaya Sanhita, 2023 (or Indian Penal Code) and Information Technology Act, 2000.

5. PRAYER / RELIEF SOUGHT:
--------------------------------------------------------------------------------
In light of the substantiated facts and documentary evidence presented, it is most respectfully prayed that this Hon'ble Authority may be pleased to:
${reliefSought.map((relief, idx) => `  (${String.fromCharCode(97 + idx)}) ${relief}`).join('\n')}

6. LIST OF ENCLOSURES / ANNEXURES:
--------------------------------------------------------------------------------
${input.evidenceList.map((item, idx) => `  [Annexure ${idx + 1}] ${item}`).join('\n')}

VERIFICATION:
I, ${input.victimName}, do hereby solemnly verify and declare that the facts stated above are true and correct to the best of my knowledge, belief, and digital records, and nothing material has been concealed therein.

Yours faithfully,


___________________________________
(Signature of Complainant)
Name: ${input.victimName}
Phone: ${input.victimPhone}
  `.trim()

  return {
    formattedText,
    subjectLine,
    applicableSections,
    reliefSought,
    annexures: input.evidenceList,
    generatedAt: new Date().toISOString(),
  }
}

export async function fetchRecoveryVectors(): Promise<VectorSummary[]> {
  if (API_BASE_URL) {
    try {
      return await requestJson<VectorSummary[]>('/api/recovery/vectors')
    } catch {
      // Graceful fallback to verified built-in Indian fraud vectors
    }
  }
  return getLocalVectorSummaries()
}

export async function fetchRecoveryVector(id: string): Promise<FraudVector> {
  if (API_BASE_URL) {
    try {
      return await requestJson<FraudVector>(`/api/recovery/vectors/${encodeURIComponent(id)}`)
    } catch {
      // Graceful fallback to verified built-in vector details
    }
  }
  const local = FRAUD_VECTORS[id]
  if (!local) {
    throw new RecoveryApiError('Fraud vector not found. Please select a valid category.', 404)
  }
  return local
}

export async function fetchEmergencyDirectory(): Promise<EmergencyDirectory> {
  if (API_BASE_URL) {
    try {
      return await requestJson<EmergencyDirectory>('/api/recovery/contacts')
    } catch {
      // Graceful fallback to emergency directory
    }
  }
  return getLocalEmergencyDirectory()
}

export async function draftPoliceComplaint(input: ComplaintInput): Promise<ComplaintDraftResult> {
  if (API_BASE_URL) {
    try {
      return await requestJson<ComplaintDraftResult>('/api/recovery/draft-complaint', {
        method: 'POST',
        body: input,
      })
    } catch {
      // Graceful fallback to local complaint compiler
    }
  }
  return generateLocalPoliceComplaint(input)
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
