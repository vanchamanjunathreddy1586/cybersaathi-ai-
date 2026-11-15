import { z } from 'zod';
import { env } from '../../config/env.js';
import { readJsonLimited } from '../../utils/readJsonLimited.js';
import type { ScanFinding } from './scanner.schema.js';

const REQUEST_TIMEOUT_MS = 6_000;

export interface ThreatIntelligenceResult {
  findings: ScanFinding[];
  checksPerformed: string[];
  checksUnavailable: string[];
  cleanProviderCount: number;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
): Promise<{ response: Response; body: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(input, {
      ...init,
      redirect: 'error',
      signal: controller.signal,
    });
    const body = response.ok ? await readJsonLimited(response, 1_000_000) : null;
    return { response, body };
  } finally {
    clearTimeout(timeout);
  }
}

const googleResponseSchema = z.object({
  matches: z.array(z.object({
    threatType: z.enum([
      'MALWARE',
      'SOCIAL_ENGINEERING',
      'UNWANTED_SOFTWARE',
      'POTENTIALLY_HARMFUL_APPLICATION',
    ]),
  })).optional(),
}).passthrough();

const virusTotalResponseSchema = z.object({
  data: z.object({
    attributes: z.object({
      last_analysis_stats: z.object({
        malicious: z.number().int().nonnegative(),
        suspicious: z.number().int().nonnegative(),
        harmless: z.number().int().nonnegative().optional(),
        undetected: z.number().int().nonnegative().optional(),
      }),
    }),
  }),
}).passthrough();

function providerFinding(
  id: string,
  title: string,
  detail: string,
  severity: ScanFinding['severity'],
  points: number,
  source: string,
): ScanFinding {
  return { id, title, detail, severity, source, verified: points >= 80, points };
}

async function checkGoogleSafeBrowsing(url: string): Promise<{
  findings: ScanFinding[];
  clean: boolean;
}> {
  const key = env.googleSafeBrowsingApiKey;
  if (!key) throw new Error('not_configured');
  const endpoint = new URL('https://safebrowsing.googleapis.com/v4/threatMatches:find');
  endpoint.searchParams.set('key', key);
  const { response, body } = await fetchWithTimeout(endpoint.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client: { clientId: 'cybersaathi-ai', clientVersion: '1.0' },
      threatInfo: {
        threatTypes: [
          'MALWARE',
          'SOCIAL_ENGINEERING',
          'UNWANTED_SOFTWARE',
          'POTENTIALLY_HARMFUL_APPLICATION',
        ],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: [{ url }],
      },
    }),
  });
  if (!response.ok) throw new Error('provider_error');
  const parsed = googleResponseSchema.safeParse(body);
  if (!parsed.success) throw new Error('invalid_response');
  const matches = parsed.data.matches ?? [];
  return {
    findings: matches.map((match, index) => providerFinding(
      `google-safe-browsing-${index + 1}`,
      `Google Safe Browsing reported ${match.threatType}`,
      'The configured Google Safe Browsing service matched this URL against its threat lists.',
      'critical',
      100,
      'Google Safe Browsing',
    )),
    clean: matches.length === 0,
  };
}

function virusTotalUrlId(url: string): string {
  return Buffer.from(url).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function checkVirusTotal(url: string): Promise<{
  findings: ScanFinding[];
  clean: boolean;
}> {
  const key = env.virusTotalApiKey;
  if (!key) throw new Error('not_configured');
  const { response, body } = await fetchWithTimeout(
    `https://www.virustotal.com/api/v3/urls/${virusTotalUrlId(url)}`,
    { headers: { 'x-apikey': key, Accept: 'application/json' } },
  );
  if (!response.ok) throw new Error(response.status === 404 ? 'no_existing_report' : 'provider_error');
  const parsed = virusTotalResponseSchema.safeParse(body);
  if (!parsed.success) throw new Error('invalid_response');
  const stats = parsed.data.data.attributes.last_analysis_stats;
  if (
    stats.malicious === 0 &&
    stats.suspicious === 0 &&
    (stats.harmless ?? 0) === 0
  ) {
    throw new Error('no_determinate_report');
  }
  const findings = stats.malicious > 0
    ? [providerFinding(
        'virustotal-malicious',
        'VirusTotal reports malicious detections',
        `${stats.malicious} configured VirusTotal engines marked the URL as malicious.`,
        'critical',
        100,
        'VirusTotal',
      )]
    : stats.suspicious > 0
      ? [providerFinding(
          'virustotal-suspicious',
          'VirusTotal reports suspicious detections',
          `${stats.suspicious} configured VirusTotal engines marked the URL as suspicious. This is an aggregate report, not a proof of malicious activity.`,
          'high',
          30,
          'VirusTotal',
        )]
      : [];
  return {
      findings,
      clean: stats.malicious === 0 &&
        stats.suspicious === 0 &&
        (stats.harmless ?? 0) > 0,
  };
}

export async function checkUrlReputation(
  url: string,
  allowExternalChecks: boolean,
): Promise<ThreatIntelligenceResult> {
  if (!allowExternalChecks) {
    return {
      findings: [],
      checksPerformed: [],
      checksUnavailable: ['External reputation checks skipped: explicit sharing consent was not given.'],
      cleanProviderCount: 0,
    };
  }

  const providers = [
    { name: 'Google Safe Browsing', configured: Boolean(env.googleSafeBrowsingApiKey), check: checkGoogleSafeBrowsing },
    { name: 'VirusTotal', configured: Boolean(env.virusTotalApiKey), check: checkVirusTotal },
  ];
  const findings: ScanFinding[] = [];
  const checksPerformed: string[] = [];
  const checksUnavailable: string[] = [];
  let cleanProviderCount = 0;
  const results = await Promise.allSettled(
    providers.filter((provider) => provider.configured)
      .map(async (provider) => ({ provider, result: await provider.check(url) })),
  );
  const configured = providers.filter((provider) => provider.configured);

  for (const provider of providers.filter((item) => !item.configured)) {
    checksUnavailable.push(`${provider.name}: not configured.`);
  }
  results.forEach((result, index) => {
    const provider = configured[index];
    if (!provider) return;
    if (result.status === 'fulfilled') {
      findings.push(...result.value.result.findings);
      checksPerformed.push(provider.name);
      if (result.value.result.clean) cleanProviderCount += 1;
    } else {
      const error = result.reason instanceof Error ? result.reason.message : '';
      checksUnavailable.push(
        error === 'no_existing_report'
          ? `${provider.name}: no existing report was available; no scan was submitted.`
          : error === 'no_determinate_report'
            ? `${provider.name}: the existing report had no determinate clean or threat verdict.`
            : `${provider.name}: request failed, timed out, or returned an invalid response.`,
      );
    }
  });

  return { findings, checksPerformed, checksUnavailable, cleanProviderCount };
}
