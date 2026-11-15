import { API_BASE_URL } from '../services/apiBaseUrl.ts'

export type CallVerdict = 'Likely Safe' | 'Suspicious' | 'Likely Scam' | 'Inconclusive'

export interface ScamTactic {
  id: string
  name: string
  category: string
  description: string
  detectedInLanguage: string
  confidence: number
  evidenceQuotes: string[]
  mitigation: string
  legalReference?: string
}

export interface EmergencyContact {
  title: string
  number: string
  description: string
}

export interface CallScanResult {
  id?: string
  inputType: 'transcript' | 'audio'
  languageDetected: 'en' | 'hi' | 'te' | 'mixed' | 'unknown'
  riskScore: number
  verdict: CallVerdict
  confidenceScore: number
  tacticsDetected: ScamTactic[]
  urgentActionRequired: boolean
  safetyGuidance: string[]
  emergencyContacts: EmergencyContact[]
  summary: string
  audioDurationSeconds?: number
  scannedAt: string
}

export interface CallScanHistoryItem {
  id: string
  input_type: string
  audio_file_name?: string
  language_detected: string
  risk_score: number
  verdict: string
  summary: string
  created_at: string
}

export class CallScannerApiError extends Error {
  readonly status?: number
  readonly code?: string

  constructor(message: string, status?: number, code?: string) {
    super(message)
    this.name = 'CallScannerApiError'
    this.status = status
    this.code = code
  }
}

/**
 * Pre-configured samples representing real-world India phone fraud vectors
 * for instant one-click analysis.
 */
export const SAMPLE_CALL_TRANSCRIPTS = [
  {
    title: 'Digital Arrest / Supreme Court (English)',
    category: 'Extortion / Impersonation',
    language: 'en',
    text: `Good morning. This is Inspector Ramesh Sharma from the Central Bureau of Investigation, New Delhi headquarters. We have issued an arrest warrant against your Aadhaar card number. A suspicious parcel containing 16 passports and 250 grams of MDMA drugs has been seized by Mumbai Customs in your name. You are placed under digital arrest right now. Do not disconnect this Skype video call or inform anyone. To verify your innocence, you must immediately transfer your funds of five lakh rupees to the RBI verified security clearing escrow account for forensic audit.`,
  },
  {
    title: 'CBI & Money Laundering (Hindi)',
    category: 'Digital Arrest / Intimidation',
    language: 'hi',
    text: `नमस्ते। मैं सीबीआई हेडक्वार्टर से डीसीपी वर्मा बात कर रहा हूँ। आपके बैंक खाते से मनी लॉन्ड्रिंग और गैरकानूनी लेन-देन हुआ है। आपके खिलाफ गैर-जमानती अरेस्ट वारंट जारी हुआ है। आप अभी डिजिटल अरेस्ट के तहत हैं। किसी को मत बताइए। अपनी बेगुनाही साबित करने के लिए अपने खाते के सारे पैसे इस सीक्रेट सरकारी वेरीफिकेशन अकाउंट में तुरंत आरटीजीएस या यूपीआई से ट्रांसफर करें। कॉल काटा तो पुलिस आधे घंटे में आपके घर पहुंचेगी।`,
  },
  {
    title: 'FedEx Customs Narcotics (Telugu)',
    category: 'Narcotics Parcel Threat',
    language: 'te',
    text: `నమస్కారం అండి. నేను ఫెడెక్స్ కొరియర్ మరియు ముంబై కస్టమ్స్ డిపార్ట్‌మెంట్ నుండి మాట్లాడుతున్నాను. మీ ఆధార్ కార్డుతో తైవాన్ కి పంపిన ఒక కొరియర్ పార్సిల్ లో 5 పాస్‌పోర్టులు మరియు ఎండిఎంఏ డ్రగ్స్ దొరికాయి. మీ పై మనీ లాండరింగ్ మరియు డ్రగ్స్ కేస్ నమోదైంది. మీరు వెంటనే అరెస్ట్ కాకుండా ఉండాలంటే వెరిఫికేషన్ కోసం మేము ఇచ్చే ఆర్బీఐ సెక్యూర్ ఖాతాకు రెండు లక్షల రూపాయలు ఆర్టీజీఎస్ చేయాలి. వెంటనే డబ్బులు పంపకపోతే ముంబై క్రైమ్ బ్రాంచ్ మిమ్మల్ని అరెస్ట్ చేస్తుంది.`,
  },
  {
    title: 'Electricity Power Cutoff Threat (English)',
    category: 'Urgency / Utility Scam',
    language: 'en',
    text: `Dear consumer, your electricity power supply will be disconnected tonight at 9:30 PM by the electricity board power department because your previous month bill update was not received in our server. Immediately call our electricity officer on this number and download AnyDesk app to verify your bill or send ten rupees via UPI immediately. Failure will lead to immediate permanent disconnection.`,
  },
  {
    title: 'Legitimate Delivery Courier (Safe)',
    category: 'Legitimate Service',
    language: 'en',
    text: `Hello, this is Rahul from BlueDart Express. I have an Amazon parcel for delivery at your apartment. Are you available at home right now to receive it? Please do not share any OTP over the phone; you can simply sign on the delivery handheld device upon receipt. Thank you.`,
  },
]

/**
 * Analyzes call conversation transcript text.
 */
export async function analyzeTranscript(
  transcript: string,
  languageHint?: string,
  accessToken?: string,
): Promise<CallScanResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 20_000)

  try {
    const response = await fetch(`${API_BASE_URL}/api/call-scanner/analyze-transcript`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        transcript,
        languageHint: languageHint || undefined,
      }),
      signal: controller.signal,
      credentials: 'omit',
    })

    let json: unknown
    try {
      json = await response.json()
    } catch {
      throw new CallScannerApiError('Analyzer service returned an unreadable response.', response.status)
    }

    if (!response.ok) {
      const err = json as { message?: string; code?: string }
      throw new CallScannerApiError(err?.message || `Analysis failed with HTTP ${response.status}`, response.status, err?.code)
    }

    const payload = json as { success: boolean; data: CallScanResult }
    return payload.data
  } catch (err) {
    if (err instanceof CallScannerApiError) throw err
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new CallScannerApiError('Analysis timed out. Please try again.', 408, 'TIMEOUT')
    }
    throw new CallScannerApiError(err instanceof Error ? err.message : 'Network error during transcript analysis.')
  } finally {
    window.clearTimeout(timeout)
  }
}

/**
 * Uploads an audio recording for voice scam analysis.
 */
export async function analyzeAudio(
  file: File,
  languageHint?: string,
  accessToken?: string,
): Promise<CallScanResult> {
  const formData = new FormData()
  formData.append('audio', file, file.name)
  if (languageHint) {
    formData.append('languageHint', languageHint)
  }

  const headers: Record<string, string> = {}
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 35_000)

  try {
    const response = await fetch(`${API_BASE_URL}/api/call-scanner/analyze-audio`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
      credentials: 'omit',
    })

    let json: unknown
    try {
      json = await response.json()
    } catch {
      throw new CallScannerApiError('Audio analyzer returned an unreadable response.', response.status)
    }

    if (!response.ok) {
      const err = json as { message?: string; code?: string }
      throw new CallScannerApiError(err?.message || `Audio analysis failed with HTTP ${response.status}`, response.status, err?.code)
    }

    const payload = json as { success: boolean; data: CallScanResult }
    return payload.data
  } catch (err) {
    if (err instanceof CallScannerApiError) throw err
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new CallScannerApiError('Audio analysis timed out.', 408, 'TIMEOUT')
    }
    throw new CallScannerApiError(err instanceof Error ? err.message : 'Network error during audio analysis.')
  } finally {
    window.clearTimeout(timeout)
  }
}

/**
 * Fetches recent call scan history for an authenticated user.
 */
export async function fetchCallScanHistory(accessToken: string): Promise<CallScanHistoryItem[]> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(`${API_BASE_URL}/api/call-scanner/history`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
      credentials: 'omit',
    })

    if (!response.ok) {
      throw new CallScannerApiError('Failed to fetch call scan history.', response.status)
    }

    const json = (await response.json()) as { success: boolean; data: CallScanHistoryItem[] }
    return json.data || []
  } finally {
    window.clearTimeout(timeout)
  }
}

/**
 * Generates an executive Markdown incident report suitable for filing with 1930 or local police.
 */
export function generateCallReportMarkdown(report: CallScanResult): string {
  const tacticsList = report.tacticsDetected.length === 0
    ? '_No predatory scam tactics identified in this sample._'
    : report.tacticsDetected
        .map(
          (t, idx) =>
            `### ${idx + 1}. ${t.name} (${t.category})\n` +
            `- **Confidence:** ${t.confidence}%\n` +
            `- **Language Detected:** ${t.detectedInLanguage.toUpperCase()}\n` +
            `- **Modus Operandi:** ${t.description}\n` +
            `- **Evidence Phrases Detected:** ${t.evidenceQuotes.map((q) => `"${q}"`).join(', ')}\n` +
            `- **Recommended Action:** ${t.mitigation}\n` +
            (t.legalReference ? `- **Applicable Law:** ${t.legalReference}\n` : ''),
        )
        .join('\n\n')

  return `# CYBERSAATHI AI — TELECOM & VOICE SCAM FORENSIC REPORT
Generated: ${new Date(report.scannedAt).toUTCString()}

## EXECUTIVE THREAT ASSESSMENT
- **Risk Score:** ${report.riskScore} / 100
- **Verdict:** ${report.verdict.toUpperCase()}
- **Urgent Action Required:** ${report.urgentActionRequired ? 'YES — IMMEDIATE RISK' : 'No'}
- **Input Type Analyzed:** ${report.inputType.toUpperCase()}
- **Language Detected:** ${report.languageDetected.toUpperCase()}
- **Summary:** ${report.summary}

---

## DETECTED SCAM PATTERNS & TACTICS (${report.tacticsDetected.length})
${tacticsList}

---

## IMMEDIATE ACTION GUIDANCE
${report.safetyGuidance.map((g) => `- ${g}`).join('\n')}

---

## OFFICIAL EMERGENCY CONTACTS (INDIA)
${report.emergencyContacts.map((c) => `- **${c.title} (${c.number}):** ${c.description}`).join('\n')}

---

## OFFICIAL NOTICE REGARDING "DIGITAL ARREST"
Under the Indian Code of Criminal Procedure (CrPC) and Bharatiya Nagarik Suraksha Sanhita (BNSS), **THERE IS NO LEGAL PROVISION FOR "DIGITAL ARREST" OR ARREST OVER VIDEO CALLS**. Neither the Supreme Court of India, CBI, ED, Police, nor Customs ever demands monetary transfers to "RBI verified accounts" or "clearing accounts" to prove innocence. Any such demand is 100% fraudulent extortion.
`
}
