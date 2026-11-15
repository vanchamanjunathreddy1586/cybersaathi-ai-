import type { ScanFinding, ScanType } from './scanner.schema.js';
import { extractUrls } from './url-scanner.service.js';

export type MessageAnalysisInput = {
  type: Extract<ScanType, 'sms' | 'email'>;
  content: string;
  metadata?: {
    sender?: string;
    replyTo?: string;
    subject?: string;
    headers?: string;
  };
};

export interface MessageSignalPattern {
  id: string;
  title: string;
  pattern: RegExp;
  whyItMatters: string;
  severity: ScanFinding['severity'];
  points: number;
}

export const signalPatterns: MessageSignalPattern[] = [
  {
    id: 'message-credential-harvesting',
    title: 'Request for credentials or sensitive account details',
    pattern: /\b(?:provide|submit|enter|reply with|send|share|confirm|verify|disclose|fill in|input|update)\b.{0,40}\b(?:password|passcode|login credentials?|account credentials?|account details?|banking details?|bank details?|card details?|credit card|debit card|cvv|cvc|security code|pin number|atm pin|ssn|social security|aadhaar|pan number)\b|\b(?:password|passcode|login credentials?|account details?|banking details?|card details?|cvv|pin)\b.{0,40}\b(?:is required|must be provided|must be submitted|must be verified|needed to proceed|to restore access)\b/is,
    whyItMatters: 'Legitimate organizations will not ask you to disclose passwords, banking credentials, or card security details via email or unsecured messages. Providing these details can lead to immediate account takeover or financial loss.',
    severity: 'high',
    points: 35,
  },
  {
    id: 'message-urgent-account-threat',
    title: 'Urgent account suspension or restriction threat',
    pattern: /\b(?:account|card|upi|bank|service|profile|access|wallet)\b.{0,40}\b(?:blocked|suspended|suspension|will be closed|closed|deactivated|deactivation|terminated|termination|disabled|locked|restricted|frozen|put on hold)\b|\b(?:immediately|urgent|urgently|within \d+ (?:hours?|mins?|minutes?|days?)|final notice|action required|immediate attention)\b.{0,50}\b(?:verify|update|click|account|restore|reactivate|avoid suspension|avoid closure|avoid deactivation)\b|\b(?:suspended|blocked|deactivated|closed|restricted|terminated)\b.{0,40}\b(?:within \d+ (?:hours?|days?)|immediately|without delay)\b/is,
    whyItMatters: 'Attackers create artificial urgency and threaten immediate account loss to trigger panic so recipients comply before independently verifying the claim.',
    severity: 'high',
    points: 25,
  },
  {
    id: 'message-fake-security-alert',
    title: 'Unverified security alert or suspicious activity claim',
    pattern: /\b(?:unauthorized|unrecognized|suspicious|unusual|illegal|fraudulent)\b.{0,40}\b(?:activity|login|sign-in|access|transaction|attempt|device|location|charge)\b|\b(?:security alert|security warning|account alert|compromised)\b.{0,50}\b(?:detected|flagged|reported|blocked|action required|unauthorized)\b/is,
    whyItMatters: 'Phishing campaigns often simulate security warnings about unauthorized logins to frighten victims into following fraudulent remediation links.',
    severity: 'medium',
    points: 20,
  },
  {
    id: 'message-verification-pressure',
    title: 'Identity verification or re-authentication pressure',
    pattern: /\b(?:verify|re-verify|confirm|validate|authenticate)\b.{0,35}\b(?:your identity|identity|account identity|identity details|personal details|profile information)\b|\b(?:identity verification|account verification|mandatory verification|re-authentication)\b.{0,40}\b(?:required|mandatory|immediately|pending|urgent|needed|promptly|within \d+ hours?)\b|\b(?:restore|regain|maintain|continue|unlock)\b.{0,30}\b(?:access|account|services?)\b.{0,40}\b(?:verify|verification)\b/is,
    whyItMatters: 'Fraudulent verification demands coerce recipients into submitting sensitive identity documents and personal information to phishing websites.',
    severity: 'medium',
    points: 20,
  },
  {
    id: 'message-otp-request',
    title: 'Request for a one-time password or verification code',
    pattern: /\b(?:share|send|tell|reply with|provide|confirm|enter|disclose)\b.{0,35}\b(?:otp|one[- ]time password|verification code|security code)\b|\b(?:otp|one[- ]time password|verification code)\b.{0,35}\b(?:share|send|tell|reply|provide|disclose|is required)\b/is,
    whyItMatters: 'One-time passwords grant direct authentication access. Legitimate services will never ask you to disclose, send, or reply with your OTP.',
    severity: 'high',
    points: 30,
  },
  {
    id: 'message-kyc',
    title: 'KYC update pressure or restriction threat',
    pattern: /\b(?:kyc|know your customer)\b.{0,50}\b(?:update|expire|expiring|suspend|suspension|blocked|mandatory|penalty|immediate)\b|\b(?:update|complete|verify)\b.{0,30}\b(?:kyc|know your customer)\b.{0,40}\b(?:immediately|urgent|within \d+ hours?|to avoid|or your account|at)\b/is,
    whyItMatters: 'Scammers impersonate regulatory or banking mandates with threatening KYC deadlines to extract personal identity documents.',
    severity: 'medium',
    points: 20,
  },
  {
    id: 'message-upi-collect',
    title: 'UPI payment or collect-request language',
    pattern: /\b(?:upi|collect request|payment request|scan.{0,10}qr)\b.{0,60}\b(?:approve|accept|pay|receive|refund|collect)\b|\b(?:approve|accept)\b.{0,40}\b(?:upi|collect request)\b/is,
    whyItMatters: 'A payment request or UPI collect action is mentioned. Approving a collect request transfers money out of your account; you do not need to approve a request to receive funds.',
    severity: 'high',
    points: 30,
  },
  {
    id: 'message-prize',
    title: 'Prize or lottery claim with fee demand',
    pattern: /\b(?:won|winner|lottery|prize|giveaway|reward)\b.{0,80}\b(?:claim|fee|tax|click|pay|transfer)\b|\b(?:claim|pay)\b.{0,50}\b(?:prize|lottery|reward)\b/is,
    whyItMatters: 'Advance-fee scams promise substantial lottery winnings or rewards but require upfront processing fees or taxes that are stolen.',
    severity: 'medium',
    points: 20,
  },
  {
    id: 'message-delivery-fee',
    title: 'Delivery or parcel payment request',
    pattern: /\b(?:parcel|delivery|shipment|courier|package)\b.{0,70}\b(?:fee|address|reschedule|customs|pay|link)\b/is,
    whyItMatters: 'Unsolicited delivery notices use small fake courier fees or address update links to capture credit card numbers and personal details.',
    severity: 'medium',
    points: 20,
  },
  {
    id: 'message-remote-access',
    title: 'Remote-access app installation request',
    pattern: /\b(?:install|download)\b.{0,50}\b(?:anydesk|teamviewer|quicksupport|remote access|screen.?share)\b/is,
    whyItMatters: 'Installing remote-access software grants an attacker complete visibility and control over your device, bypassing multi-factor security protections.',
    severity: 'high',
    points: 30,
  },
  {
    id: 'message-payment-link',
    title: 'Link present in unsolicited message',
    pattern: /(?:https?:\/\/|www\.)[^\s<>"']+/is,
    whyItMatters: 'The message contains a web link. Threat actors embed links leading to spoofed authentication pages or malicious downloads. Verify destination domains independently.',
    severity: 'medium',
    points: 20,
  },
  {
    id: 'message-impersonation',
    title: 'Organization or authority impersonation language',
    pattern: /\b(?:bank|police|government|tax department|income tax|rbi|support team|customer care|helpdesk|security team|fraud department)\b.{0,60}\b(?:verify|urgent|blocked|payment|otp|account|suspended|penalty)\b/is,
    whyItMatters: 'Invoking official authorities or support teams creates false credibility and intimidation, lowering the victim\'s natural skepticism.',
    severity: 'medium',
    points: 20,
  },
];

export function extractEmailAddress(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const angleMatch = raw.match(/<([^<>\s@]+@[^<>\s@]+)>/);
  if (angleMatch?.[1]) {
    return angleMatch[1].trim().toLowerCase();
  }
  const bareMatch = raw.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
  if (bareMatch?.[1]) {
    return bareMatch[1].trim().toLowerCase();
  }
  return null;
}

export function extractDomain(raw: string | undefined): string | null {
  const email = extractEmailAddress(raw);
  if (email) {
    const at = email.lastIndexOf('@');
    if (at !== -1) {
      return email.slice(at + 1).toLowerCase();
    }
  }
  const match = raw?.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  return match?.[1]?.toLowerCase() ?? null;
}

export function extractDisplayName(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const match = raw.match(/^\s*"?([^"<]+)"?\s*<[^>]+>/);
  if (match?.[1]) {
    const name = match[1].trim();
    return name.length > 0 ? name : null;
  }
  return null;
}

export const publicFreeMailDomains = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'yahoo.co.uk',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'aol.com',
  'gmx.com',
]);

export function extractPhoneNumbers(text: string): string[] {
  return [...new Set(text.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) ?? [])]
    .map((number) => number.trim())
    .slice(0, 20);
}

function extractSnippet(match: RegExpMatchArray): string {
  const matchedText = (match[0] ?? '').trim().replace(/\s+/g, ' ');
  if (matchedText.length <= 80) {
    return matchedText;
  }
  return `${matchedText.slice(0, 77)}...`;
}

function isSecurityDisclaimer(text: string, matchIndex: number): boolean {
  const start = Math.max(0, matchIndex - 60);
  const preceding = text.slice(start, matchIndex).toLowerCase();
  return /\b(?:never|do not|don't|will not|won't|should not|shouldn't|reminder:?|caution:?)\s+(?:ask|request|share|disclose|send|give|require)\b/i.test(preceding);
}

function isBenignKycNotice(text: string): boolean {
  return /\b(?:kyc|know your customer)\b.{0,40}\b(?:completed|successful|approved|verified|confirmed)\b/is.test(text) &&
    !/\b(?:immediately|urgent|urgently|suspend|blocked|within \d+ hours?)\b/is.test(text);
}

function emailHeaderFindings(headers: string | undefined): ScanFinding[] {
  if (!headers?.trim()) return [];
  const findings: ScanFinding[] = [];
  const authenticationResults = headers.match(/^Authentication-Results:\s*(.+)$/im)?.[1];
  const receivedSpf = headers.match(/^Received-SPF:\s*(.+)$/im)?.[1];
  const dkimSignature = /^DKIM-Signature:\s*.+$/im.test(headers);

  const addHeaderResult = (
    mechanism: string,
    result: string,
    source: string,
  ) => {
    const cleanResult = result.toLowerCase();
    const isFail = cleanResult === 'fail';
    const isSoftfail = cleanResult === 'softfail';
    findings.push({
      id: `email-auth-${source.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${mechanism.toLowerCase()}`,
      title: `${mechanism.toUpperCase()} header result: ${cleanResult}`,
      detail: `Evidence detected: User-supplied ${source} header states ${mechanism.toUpperCase()}=${cleanResult}. Why it matters: SPF, DKIM, and DMARC failures indicate the sending server may not be authorized by the domain owner to send mail, which is a strong indicator of email spoofing. Note that pasted headers are user-provided and cannot be cryptographically verified by this scanner.`,
      severity: isFail ? 'medium' : isSoftfail ? 'low' : 'low',
      source: `User-supplied ${source} header`,
      verified: false,
      points: isFail ? 20 : isSoftfail ? 10 : 0,
    });
  };

  if (authenticationResults) {
    const matches = authenticationResults.matchAll(/\b(spf|dkim|dmarc)=(pass|fail|softfail|neutral|none|temperror|permerror)\b/gi);
    for (const match of matches) {
      const mechanism = match[1];
      const result = match[2];
      if (mechanism && result) {
        addHeaderResult(mechanism, result, 'Authentication-Results');
      }
    }
  }
  if (receivedSpf) {
    const result = receivedSpf.match(/^\s*(pass|fail|softfail|neutral|none|temperror|permerror)\b/i)?.[1];
    if (result) {
      addHeaderResult('spf', result, 'Received-SPF');
    }
  }

  if (dkimSignature && findings.length === 0) {
    findings.push({
      id: 'email-dkim-signature-present',
      title: 'DKIM-Signature header supplied',
      detail: 'Evidence detected: DKIM-Signature header present in pasted text. Why it matters: A DKIM signature header is present, but cryptographic signature validation cannot be performed from pasted header text alone without the original raw message envelope.',
      severity: 'low',
      source: 'User-supplied email headers',
      verified: false,
      points: 0,
    });
  }
  return findings;
}

export function analyzeMessage(input: MessageAnalysisInput): {
  findings: ScanFinding[];
  extractedUrls: string[];
  extractedPhoneNumbers: string[];
  emailAuthentication: {
    supplied: boolean;
    note: string;
  } | null;
} {
  const text = [
    input.metadata?.sender ? `From: ${input.metadata.sender}` : '',
    input.metadata?.replyTo ? `Reply-To: ${input.metadata.replyTo}` : '',
    input.metadata?.subject ? `Subject: ${input.metadata.subject}` : '',
    input.content,
  ].filter(Boolean).join('\n');

  const findings: ScanFinding[] = [];

  for (const signal of signalPatterns) {
    const match = text.match(signal.pattern);
    if (match && match.index !== undefined) {
      if (
        (signal.id === 'message-credential-harvesting' || signal.id === 'message-otp-request') &&
        isSecurityDisclaimer(text, match.index)
      ) {
        continue;
      }
      if (signal.id === 'message-kyc' && isBenignKycNotice(text)) {
        continue;
      }
      const snippet = extractSnippet(match);
      findings.push({
        id: signal.id,
        title: signal.title,
        detail: `Evidence detected: "${snippet}". Why it matters: ${signal.whyItMatters}`,
        severity: signal.severity,
        source: input.type === 'email' ? 'Local message pattern analysis' : 'Local SMS pattern analysis',
        verified: false,
        points: signal.points,
      });
    }
  }

  if (input.type === 'email') {
    findings.push(...emailHeaderFindings(input.metadata?.headers));

    const senderDomain = extractDomain(input.metadata?.sender);
    const replyToDomain = extractDomain(input.metadata?.replyTo);
    const senderEmail = extractEmailAddress(input.metadata?.sender) ?? input.metadata?.sender ?? '';
    const replyToEmail = extractEmailAddress(input.metadata?.replyTo) ?? input.metadata?.replyTo ?? '';

    if (senderDomain && replyToDomain && senderDomain !== replyToDomain) {
      findings.push({
        id: 'email-reply-to-domain-mismatch',
        title: 'Sender and Reply-To domains differ',
        detail: `Evidence detected: Sender domain is "${senderDomain}" (${senderEmail}) while Reply-To domain is "${replyToDomain}" (${replyToEmail}). Why it matters: Attackers often spoof a trusted sender domain while directing replies to an attacker-controlled inbox on a different domain.`,
        severity: 'medium',
        source: 'User-supplied email fields',
        verified: false,
        points: 20,
      });

      if (publicFreeMailDomains.has(replyToDomain) && !publicFreeMailDomains.has(senderDomain)) {
        findings.push({
          id: 'email-reply-to-freemail',
          title: 'Reply-To points to public free webmail',
          detail: `Evidence detected: Sender domain "${senderDomain}" appears to be an organizational domain, but Reply-To is directed to free webmail address "${replyToEmail}". Why it matters: Legitimate organizations communicate through their own registered domains. Diverting responses to a free webmail service is a common phishing and business email compromise (BEC) technique.`,
          severity: 'high',
          source: 'User-supplied email fields',
          verified: false,
          points: 25,
        });
      }
    }

    const displayName = extractDisplayName(input.metadata?.sender);
    if (displayName && senderDomain) {
      const isInstitutionalName = /\b(?:bank|support|security|paypal|microsoft|google|apple|amazon|netflix|helpdesk|account team|fraud division|customer care)\b/i.test(displayName);
      const isDomainFreeMail = publicFreeMailDomains.has(senderDomain);
      if (isInstitutionalName && isDomainFreeMail) {
        findings.push({
          id: 'email-display-name-spoofing',
          title: 'Display name brand or institution impersonation',
          detail: `Evidence detected: Display name claims to be "${displayName}", but the email is sent from free webmail domain "${senderDomain}" (${senderEmail}). Why it matters: Attackers frequently set the display name to a recognizable brand or support team to deceive users whose email clients highlight the display name over the sending address.`,
          severity: 'high',
          source: 'User-supplied email fields',
          verified: false,
          points: 25,
        });
      }
    }
  }

  return {
    findings,
    extractedUrls: extractUrls(text),
    extractedPhoneNumbers: extractPhoneNumbers(text),
    emailAuthentication: input.type === 'email'
      ? {
          supplied: Boolean(input.metadata?.headers?.trim()),
          note: input.metadata?.headers?.trim()
            ? 'Authentication results are shown only when explicit header evidence was supplied; pasted headers cannot be cryptographically verified here.'
            : 'No email headers were supplied. SPF, DKIM, and DMARC were not assessed.',
        }
      : null,
  };
}
