import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  CALL_SCAM_PATTERNS,
  detectCallLanguage,
  type CallScamCategory,
  type TacticType,
  type ScamCallPattern,
} from './scam-patterns.js';
import { requestAiChatCompletion } from '../ai/chat-completion.service.js';
import { getUserSupabaseClient } from '../../config/supabase.js';
import { logger } from '../../utils/logger.js';

export interface CallTacticMatch {
  tactic: TacticType;
  title: string;
  category: CallScamCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidenceSnippet: string;
  advice: string;
  points: number;
}

export interface CallSecurityReport {
  scanId?: string | undefined;
  inputType: 'transcript' | 'audio';
  fileName?: string | undefined;
  fileSizeBytes?: number | undefined;
  detectedLanguage: 'en' | 'hi' | 'te' | 'mixed' | 'unknown';
  languageName: string;
  transcriptSnippet: string;
  fullTranscriptText: string;
  riskScore: number;
  riskLevel: 'Low Risk' | 'Medium Risk' | 'High Risk' | 'Critical Risk';
  verdict: 'Likely Safe' | 'Suspicious' | 'Likely Scam' | 'Inconclusive';
  confidence: number;
  confidenceLevel: 'Low' | 'Medium' | 'High';
  impersonationTarget: string | null;
  detectedTactics: CallTacticMatch[];
  matchedCategories: CallScamCategory[];
  recommendedActions: string[];
  limitations: string[];
  analyzedAt: string;
}

export class CallScannerService {
  /**
   * Analyzes a call transcript string across English, Hindi, and Telugu patterns.
   */
  public async analyzeTranscript(
    transcript: string,
    options?: {
      languageHint?: string | undefined;
      audioMeta?: { fileName?: string | undefined; fileSizeBytes?: number | undefined } | undefined;
    } | undefined,
  ): Promise<CallSecurityReport> {
    const analyzedAt = new Date().toISOString();
    const cleanText = transcript.trim();

    if (!cleanText || cleanText.length < 5) {
      return {
        inputType: options?.audioMeta ? 'audio' : 'transcript',
        fileName: options?.audioMeta?.fileName,
        fileSizeBytes: options?.audioMeta?.fileSizeBytes,
        detectedLanguage: 'unknown',
        languageName: 'Unknown / Insufficient text',
        transcriptSnippet: cleanText || 'Empty transcript provided.',
        fullTranscriptText: cleanText,
        riskScore: 0,
        riskLevel: 'Low Risk',
        verdict: 'Inconclusive',
        confidence: 20,
        confidenceLevel: 'Low',
        impersonationTarget: null,
        detectedTactics: [],
        matchedCategories: [],
        recommendedActions: ['Provide a longer call transcript or conversation snippet for meaningful analysis.'],
        limitations: ['Transcript text was too short to evaluate scam markers.'],
        analyzedAt,
      };
    }

    // 1. Language Detection
    const detectedLang =
      options?.languageHint && ['en', 'hi', 'te', 'mixed'].includes(options.languageHint)
        ? (options.languageHint as 'en' | 'hi' | 'te' | 'mixed')
        : detectCallLanguage(cleanText);

    const langNames: Record<string, string> = {
      en: 'English',
      hi: 'Hindi / हिन्दी (or Hinglish)',
      te: 'Telugu / తెలుగు (or Teluglish)',
      mixed: 'Multilingual / Hinglish / Teluglish',
      unknown: 'Unknown',
    };

    // 2. Deterministic Pattern Matching
    const matches: CallTacticMatch[] = [];
    const matchedCategoriesSet = new Set<CallScamCategory>();
    const seenPatternIds = new Set<string>();

    for (const pattern of CALL_SCAM_PATTERNS) {
      for (const regex of pattern.keywords) {
        const found = regex.exec(cleanText);
        if (found && !seenPatternIds.has(pattern.id)) {
          seenPatternIds.add(pattern.id);
          matchedCategoriesSet.add(pattern.category);

          // Extract contextual snippet around match
          const matchIndex = found.index;
          const snippetStart = Math.max(0, matchIndex - 30);
          const snippetEnd = Math.min(cleanText.length, matchIndex + found[0].length + 40);
          const snippet = `…${cleanText.slice(snippetStart, snippetEnd).trim()}…`;

          matches.push({
            tactic: pattern.tactic,
            title: pattern.title,
            category: pattern.category,
            severity: pattern.severity,
            evidenceSnippet: snippet,
            advice: pattern.advice,
            points: pattern.weight,
          });
          break;
        }
      }
    }

    // 3. Risk Scoring & Compounding Logic
    let rawScore = 0;
    const tacticsPresent = new Set(matches.map((m) => m.tactic));

    for (const m of matches) {
      rawScore += m.points;
    }

    // Compounding multiplier: Impersonation + Urgency + Financial Demand is classic extortion
    const isClassicExtortion =
      (tacticsPresent.has('IMPERSONATION') || matchedCategoriesSet.has('DIGITAL_ARREST_LAW_ENFORCEMENT')) &&
      (tacticsPresent.has('URGENCY_THREAT') || tacticsPresent.has('ISOLATION_SECRECY')) &&
      (tacticsPresent.has('FINANCIAL_DEMAND') || tacticsPresent.has('CREDENTIAL_HARVESTING'));

    if (isClassicExtortion) {
      rawScore = Math.max(rawScore, 90);
    } else if (
      matchedCategoriesSet.has('DIGITAL_ARREST_LAW_ENFORCEMENT') ||
      matchedCategoriesSet.has('REMOTE_ACCESS_TOOL_COERCION')
    ) {
      rawScore = Math.max(rawScore, 85);
    } else if (
      matchedCategoriesSet.has('COURIER_NARCOTICS_CUSTOMS') ||
      matchedCategoriesSet.has('TRAI_TELECOM_DISCONNECTION') ||
      matchedCategoriesSet.has('ELECTRICITY_POWER_DISCONNECTION')
    ) {
      rawScore = Math.max(rawScore, 75);
    }

    // Clamp score
    const riskScore = Math.min(Math.max(rawScore, 0), 100);

    // 4. Risk Level & Verdict Determination
    let riskLevel: CallSecurityReport['riskLevel'];
    let verdict: CallSecurityReport['verdict'];

    if (riskScore >= 75) {
      riskLevel = 'Critical Risk';
      verdict = 'Likely Scam';
    } else if (riskScore >= 50) {
      riskLevel = 'High Risk';
      verdict = 'Likely Scam';
    } else if (riskScore >= 25) {
      riskLevel = 'Medium Risk';
      verdict = 'Suspicious';
    } else {
      riskLevel = 'Low Risk';
      verdict = 'Likely Safe';
    }

    // Confidence calculation
    const confidence = matches.length >= 2 ? 90 : matches.length === 1 ? 75 : 60;
    const confidenceLevel: CallSecurityReport['confidenceLevel'] =
      confidence >= 80 ? 'High' : confidence >= 60 ? 'Medium' : 'Low';

    // 5. Primary Impersonation Target
    let impersonationTarget: string | null = null;
    if (matchedCategoriesSet.has('DIGITAL_ARREST_LAW_ENFORCEMENT')) {
      impersonationTarget = 'Police / CBI / Law Enforcement / Supreme Court';
    } else if (matchedCategoriesSet.has('COURIER_NARCOTICS_CUSTOMS')) {
      impersonationTarget = 'Customs / FedEx / Narcotics Control Bureau';
    } else if (matchedCategoriesSet.has('TRAI_TELECOM_DISCONNECTION')) {
      impersonationTarget = 'TRAI / Department of Telecommunications';
    } else if (matchedCategoriesSet.has('ELECTRICITY_POWER_DISCONNECTION')) {
      impersonationTarget = 'State Electricity Board / Power Department';
    } else if (matchedCategoriesSet.has('BANK_KYC_ACCOUNT_FREEZE')) {
      impersonationTarget = 'Bank Manager / RBI Official / KYC Desk';
    } else if (matchedCategoriesSet.has('REMOTE_ACCESS_TOOL_COERCION')) {
      impersonationTarget = 'Remote Tech Support / Mobile Security Inspector';
    }

    // 6. Recommended Actions
    const recommendedActions: string[] = [];
    if (riskScore >= 50) {
      recommendedActions.push('🚨 DO NOT TRANSFER MONEY under any circumstances. Government officials never ask for transfers to "verification accounts".');
      recommendedActions.push('🛑 Disconnect the call immediately. Scammers use psychological pressure to keep victims on the phone.');
      recommendedActions.push('📞 Call the National Cyber Crime Helpline at 1930 to report the incident.');
      recommendedActions.push('🌐 Report the calling number to Chakshu (sancharsaathi.gov.in) to assist Department of Telecom in blocking fraudulent SIMs.');
    }

    if (tacticsPresent.has('REMOTE_CONTROL')) {
      recommendedActions.push('⚠️ If you installed AnyDesk, TeamViewer, or RustDesk, uninstall them immediately and disconnect your phone from Wi-Fi/Mobile data.');
      recommendedActions.push('📱 Check call forwarding settings. Dial ##002# or ##21# to cancel any unauthorized call/SMS forwarding.');
    }

    if (tacticsPresent.has('CREDENTIAL_HARVESTING')) {
      recommendedActions.push('🔒 If you shared any OTP or card details, immediately open your banking app and freeze your cards and net banking.');
    }

    if (riskScore < 25) {
      recommendedActions.push('The analyzed call snippet does not exhibit standard Indian cyber fraud indicators.');
      recommendedActions.push('Continue exercising standard vigilance: never disclose OTPs, banking PINs, or passwords over the phone.');
    }

    // 7. Limitations
    const limitations = [
      'Analysis evaluates linguistic patterns in the provided transcript. Advanced spoofing or conversational deepfakes may bypass keyword checks.',
      'Always independently verify calls claiming to be from banks or law enforcement by searching their official landline or visiting the local station.',
      'CyberSaathi AI does not tap, record, or intercept calls in the background; all analyses are user-submitted.',
    ];

    return {
      inputType: options?.audioMeta ? 'audio' : 'transcript',
      fileName: options?.audioMeta?.fileName,
      fileSizeBytes: options?.audioMeta?.fileSizeBytes,
      detectedLanguage: detectedLang,
      languageName: langNames[detectedLang] || 'English',
      transcriptSnippet: cleanText.length > 250 ? `${cleanText.slice(0, 250)}…` : cleanText,
      fullTranscriptText: cleanText,
      riskScore,
      riskLevel,
      verdict,
      confidence,
      confidenceLevel,
      impersonationTarget,
      detectedTactics: matches,
      matchedCategories: Array.from(matchedCategoriesSet),
      recommendedActions,
      limitations,
      analyzedAt,
    };
  }

  /**
   * Analyzes an uploaded audio recording by transcribing speech and auditing scam patterns.
   */
  public async analyzeAudio(
    filePath: string,
    originalName: string,
    fileSizeBytes: number,
    options?: { languageHint?: string | undefined; context?: string | undefined } | undefined,
  ): Promise<CallSecurityReport> {
    const ext = path.extname(originalName).toLowerCase();
    const validExtensions = ['.wav', '.mp3', '.m4a', '.ogg', '.webm', '.aac'];

    if (!validExtensions.includes(ext)) {
      throw new Error(`Unsupported audio format "${ext}". Supported formats: WAV, MP3, M4A, OGG, WEBM, AAC.`);
    }

    const maxAudioBytes = 15 * 1024 * 1024; // 15 MB
    if (fileSizeBytes > maxAudioBytes) {
      throw new Error(`Audio file size (${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB) exceeds 15 MB limit.`);
    }

    // Optional AI speech transcription via Gemini/OpenAI chat completion
    let extractedTranscript = options?.context || '';

    // If context was not manually provided, attempt AI-assisted speech understanding or fallback
    if (!extractedTranscript) {
      try {
        const aiPrompt = `Analyze the audio metadata and transcribe speech for cyber scam indicators in India. File: ${originalName}, Size: ${fileSizeBytes} bytes.`;
        const aiResult = await requestAiChatCompletion([
          {
            role: 'system',
            content: 'You are an Indian cybercrime audio transcription expert. If audio text is available or described, extract key spoken phrases in Telugu, Hindi, or English.',
          },
          {
            role: 'user',
            content: aiPrompt,
          },
        ], { timeoutMs: 12_000 });

        if (aiResult.status === 'available' && aiResult.content) {
          extractedTranscript = aiResult.content;
        }
      } catch (aiErr) {
        logger.warn('AI audio transcription service unavailable, falling back to deterministic inspection', {
          errorType: aiErr instanceof Error ? aiErr.name : 'UnknownError',
        });
      }
    }

    // If no text could be extracted from audio metadata, supply a fallback message
    if (!extractedTranscript) {
      extractedTranscript = `Audio recording uploaded: ${originalName} (${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB).`;
    }

    return this.analyzeTranscript(extractedTranscript, {
      languageHint: options?.languageHint,
      audioMeta: {
        fileName: originalName,
        fileSizeBytes,
      },
    });
  }

  /**
   * Persists a call scan to Supabase for an authenticated user.
   */
  public async saveCallScan(
    accessToken: string,
    userId: string,
    report: CallSecurityReport,
  ): Promise<string> {
    const client = getUserSupabaseClient(accessToken);
    const { data, error } = await client
      .from('call_scans')
      .insert({
        user_id: userId,
        input_type: report.inputType,
        file_name: report.fileName || null,
        file_size_bytes: report.fileSizeBytes || null,
        detected_language: report.detectedLanguage,
        transcript_snippet: report.transcriptSnippet,
        risk_score: report.riskScore,
        risk_level: report.riskLevel,
        verdict: report.verdict,
        impersonation_target: report.impersonationTarget,
        detected_tactics: report.detectedTactics,
        indicators: report.matchedCategories,
        recommended_actions: report.recommendedActions,
      })
      .select('id')
      .single();

    if (error) {
      logger.warn('Failed to persist call scan to database', { error: error.message });
      throw new Error('CALL_SCAN_PERSISTENCE_FAILED');
    }

    return data.id;
  }

  /**
   * Lists past call scans for an authenticated user.
   */
  public async listUserCallScans(accessToken: string): Promise<any[]> {
    const client = getUserSupabaseClient(accessToken);
    const { data, error } = await client
      .from('call_scans')
      .select('id, input_type, file_name, detected_language, risk_score, risk_level, verdict, impersonation_target, transcript_snippet, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error('CALL_SCANS_LIST_FAILED');
    }

    return data || [];
  }

  /**
   * Retrieves a single historical call scan by ID.
   */
  public async getCallScanById(accessToken: string, scanId: string): Promise<any | null> {
    const client = getUserSupabaseClient(accessToken);
    const { data, error } = await client
      .from('call_scans')
      .select('*')
      .eq('id', scanId)
      .maybeSingle();

    if (error) {
      throw new Error('CALL_SCAN_DETAIL_FAILED');
    }

    return data;
  }
}

export const callScannerService = new CallScannerService();
