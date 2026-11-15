import { randomUUID } from 'node:crypto';
import type { ScanFinding, ScanRequest, ScanType } from './scanner.schema.js';
import {
  summarizeVerifiedEvidence,
  type AiSummaryResult,
} from './ai-analysis.service.js';
import { analyzeMessage } from './message-scanner.service.js';
import { assessRisk } from './risk-engine.service.js';
import { checkUrlReputation } from './threat-intelligence.service.js';
import { analyzeUrl, extractUrls } from './url-scanner.service.js';

export interface ScanReport {
  scanId: string;
  scanType: ScanType;
  submittedContentRedacted: string;
  riskScore: number;
  riskLevel: ReturnType<typeof assessRisk>['level'];
  verdict: ReturnType<typeof assessRisk>['verdict'];
  confidence: number;
  confidenceLevel: ReturnType<typeof assessRisk>['confidenceLevel'];
  findings: ScanFinding[];
  evidence: Array<{ findingId: string; source: string; detail: string }>;
  urlInfo: Array<{ hostname: string; protocol: string; ipLiteral: boolean }>;
  extractedUrls: string[];
  extractedPhoneNumbers: string[];
  emailAuthentication: ReturnType<typeof analyzeMessage>['emailAuthentication'];
  checksPerformed: string[];
  checksUnavailable: string[];
  explanation: string;
  recommendations: string[];
  aiSummary: AiSummaryResult;
  createdAt: string;
}

function redactContent(content: string): string {
  return content
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email redacted]')
    .replace(/(?:https?:\/\/|www\.)[^\s<>"']+/gi, '[URL redacted]')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[phone redacted]')
    .slice(0, 500);
}

function redactUrl(urlValue: string): string {
  try {
    const url = new URL(urlValue);
    return `${url.origin}${url.pathname === '/' ? '' : '/[path redacted]'}`;
  } catch {
    return '[URL redacted]';
  }
}

function recommendationsFor(
  type: ScanType,
  findings: ScanFinding[],
  verdict: ReturnType<typeof assessRisk>['verdict'],
): string[] {
  const actions = new Set<string>();
  if (verdict === 'Likely Malicious' || verdict === 'Suspicious') {
    actions.add('Do not click links, reply, share verification codes, or approve payment requests in the submitted content.');
    actions.add('Contact the organization using a phone number or website you already trust.');
  } else if (verdict === 'Inconclusive') {
    actions.add('Treat the result as unverified. Check the sender and destination through an independent, trusted channel.');
  } else {
    actions.add('No suspicious indicators were found in the checks that ran; continue to verify unexpected requests before acting.');
  }
  if (findings.some((finding) => finding.id === 'message-otp-request')) {
    actions.add('Never share an OTP or one-time verification code with another person.');
  }
  if (findings.some((finding) => finding.id === 'message-remote-access')) {
    actions.add('Do not install remote-access software at the request of an unsolicited caller or message.');
  }
  if (type === 'qr') {
    actions.add('Review the decoded destination before opening it; this scanner never opens it automatically.');
  }
  if (type === 'email') {
    actions.add('Do not treat pasted SPF, DKIM, or DMARC headers as verified cryptographic results.');
  }
  return [...actions].slice(0, 5);
}

function isUrlLike(value: string): boolean {
  return /^(?:https?:\/\/|www\.)/i.test(value.trim());
}

export async function analyzeScan(request: ScanRequest): Promise<ScanReport> {
  const findings: ScanFinding[] = [];
  const checksPerformed: string[] = [];
  const checksUnavailable: string[] = [];
  let extractedUrls: string[] = [];
  const urlInfo: ScanReport['urlInfo'] = [];
  let extractedPhoneNumbers: string[] = [];
  let emailAuthentication: ScanReport['emailAuthentication'] = null;
  let cleanProviderCount = 0;

  if (request.type === 'url' || (request.type === 'qr' && isUrlLike(request.content))) {
    const urlAnalysis = analyzeUrl(
      request.type === 'qr' && /^www\./i.test(request.content)
        ? `https://${request.content}`
        : request.content,
    );
    findings.push(...urlAnalysis.findings);
    urlInfo.push({
      hostname: urlAnalysis.hostname,
      protocol: urlAnalysis.protocol,
      ipLiteral: urlAnalysis.ipLiteral,
    });
    extractedUrls = [urlAnalysis.normalizedUrl];
    checksPerformed.push('URL syntax and local pattern analysis');
    checksUnavailable.push(
      'Destination fetching, DNS resolution, redirect following, and TLS certificate inspection are not performed to prevent server-side request forgery.',
    );

    const reputation = await checkUrlReputation(
      urlAnalysis.normalizedUrl,
      request.allowExternalChecks,
    );
    findings.push(...reputation.findings);
    checksPerformed.push(...reputation.checksPerformed);
    checksUnavailable.push(...reputation.checksUnavailable);
    cleanProviderCount += reputation.cleanProviderCount;
  } else {
    const message = analyzeMessage({
      type: request.type === 'email' ? 'email' : 'sms',
      content: request.content,
      ...(request.metadata
        ? {
            metadata: {
              ...(request.metadata.sender ? { sender: request.metadata.sender } : {}),
              ...(request.metadata.replyTo ? { replyTo: request.metadata.replyTo } : {}),
              ...(request.metadata.subject ? { subject: request.metadata.subject } : {}),
              ...(request.metadata.headers ? { headers: request.metadata.headers } : {}),
            },
          }
        : {}),
    });
    findings.push(...message.findings);
    extractedUrls = message.extractedUrls;
    extractedPhoneNumbers = message.extractedPhoneNumbers;
    emailAuthentication = message.emailAuthentication;
    checksPerformed.push('Local message and link-pattern analysis');
    if (request.type === 'email') {
      checksPerformed.push(
        request.metadata?.headers?.trim()
          ? 'User-supplied email authentication header review'
          : 'Email authentication headers not supplied',
      );
      if (message.emailAuthentication) {
        checksUnavailable.push(message.emailAuthentication.note);
      }
    }

    for (const [index, extractedUrl] of extractedUrls.slice(0, 5).entries()) {
      try {
        const urlAnalysis = analyzeUrl(
          /^www\./i.test(extractedUrl) ? `https://${extractedUrl}` : extractedUrl,
        );
        urlInfo.push({
          hostname: urlAnalysis.hostname,
          protocol: urlAnalysis.protocol,
          ipLiteral: urlAnalysis.ipLiteral,
        });
        findings.push(...urlAnalysis.findings.map((finding) => ({
          ...finding,
          id: `message-url-${index + 1}-${finding.id}`,
        })));
      } catch {
        findings.push({
          id: `message-url-${index + 1}-invalid`,
          title: 'Link could not be parsed as a complete URL',
          detail: 'A link-like string was extracted, but its destination could not be normalized.',
          severity: 'medium',
          source: 'Local URL pattern analysis',
          verified: false,
          points: 15,
        });
      }
    }
    if (extractedUrls.length > 0) {
      checksPerformed.push('Local analysis of extracted URLs');
    }

    if (request.allowExternalChecks && extractedUrls.length > 0) {
      const urlsForExternalCheck = extractedUrls.slice(0, 3);
      const reputationResults = await Promise.all(urlsForExternalCheck.map(async (extractedUrl) => {
        try {
          const normalized = analyzeUrl(
            /^www\./i.test(extractedUrl) ? `https://${extractedUrl}` : extractedUrl,
          ).normalizedUrl;
          return await checkUrlReputation(normalized, true);
        } catch {
          return null;
        }
      }));
      reputationResults.forEach((reputation, index) => {
        if (!reputation) {
          checksUnavailable.push('An extracted link could not be checked by configured reputation providers.');
          return;
        }
        const prefix = `message-url-${index + 1}-`;
        findings.push(...reputation.findings.map((finding) => ({
          ...finding,
          id: `${prefix}${finding.id}`,
        })));
        checksPerformed.push(...reputation.checksPerformed);
        checksUnavailable.push(...reputation.checksUnavailable);
        cleanProviderCount += reputation.cleanProviderCount;
      });
      if (extractedUrls.length > urlsForExternalCheck.length) {
        checksUnavailable.push('Only the first three extracted URLs were shared with configured reputation providers.');
      }
    } else if (extractedUrls.length > 0) {
      checksUnavailable.push(
        'Extracted URL reputation checks skipped: explicit sharing consent was not given.',
      );
    }
  }

  if (request.type === 'qr' && !isUrlLike(request.content)) {
    checksPerformed.push('Locally decoded QR text pattern analysis');
  }
  const assessment = assessRisk(findings, cleanProviderCount);
  const aiSummary = await summarizeVerifiedEvidence(findings);
  const extractedUrl = extractedUrls[0];
  const contentLabel = request.type === 'url' && extractedUrl
    ? extractedUrl
    : request.type === 'qr' && extractedUrl
      ? extractedUrl
      : request.content;

  return {
    scanId: randomUUID(),
    scanType: request.type,
    submittedContentRedacted: redactContent(contentLabel),
    riskScore: assessment.score,
    riskLevel: assessment.level,
    verdict: assessment.verdict,
    confidence: assessment.confidence,
    confidenceLevel: assessment.confidenceLevel,
    findings,
    evidence: findings.map((finding) => ({
      findingId: finding.id,
      source: finding.source,
      detail: finding.detail,
    })),
    urlInfo,
    extractedUrls: extractedUrls.map(redactUrl),
    extractedPhoneNumbers,
    emailAuthentication,
    checksPerformed: [...new Set(checksPerformed)],
    checksUnavailable: [...new Set(checksUnavailable)],
    explanation: assessment.explanation,
    recommendations: recommendationsFor(request.type, findings, assessment.verdict),
    aiSummary,
    createdAt: new Date().toISOString(),
  };
}

export function extractSubmittedUrls(type: ScanType, content: string): string[] {
  return type === 'url' ? [content] : extractUrls(content);
}
