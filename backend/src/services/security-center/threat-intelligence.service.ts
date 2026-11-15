import { z } from 'zod';
import { env } from '../../config/env.js';
import { readJsonLimited } from '../../utils/readJsonLimited.js';
import { analyzeUrl } from '../scanner/url-scanner.service.js';
import { checkUrlReputation } from '../scanner/threat-intelligence.service.js';
import { virusTotalCircuitBreaker, virusTotalQuota } from '../resilience/resilience.service.js';


const domainReportSchema = z.object({
  data: z.object({
    attributes: z.object({
      last_analysis_stats: z.object({
        malicious: z.number().int().nonnegative(),
        suspicious: z.number().int().nonnegative(),
        harmless: z.number().int().nonnegative().optional(),
        undetected: z.number().int().nonnegative().optional(),
      }),
      last_analysis_date: z.number().int().optional(),
      categories: z.record(z.string(), z.string()).optional(),
    }),
  }),
}).passthrough();

const fileReportSchema = z.object({
  data: z.object({
    attributes: z.object({
      last_analysis_stats: z.object({
        malicious: z.number().int().nonnegative(),
        suspicious: z.number().int().nonnegative(),
        harmless: z.number().int().nonnegative().optional(),
        undetected: z.number().int().nonnegative().optional(),
      }),
      last_analysis_date: z.number().int().optional(),
      meaningful_name: z.string().max(512).optional(),
      type_description: z.string().max(128).optional(),
    }),
  }),
}).passthrough();

export type ReputationProviderResult = {
  name: string;
  status: 'threat_found' | 'no_match' | 'unavailable';
  detail: string;
};

type VirusTotalResult = ReputationProviderResult & {
  evidence: string[];
  malicious: number;
  suspicious: number;
};

function unavailableVirusTotalResult(detail: string): VirusTotalResult {
  return {
    name: 'VirusTotal',
    status: 'unavailable',
    detail,
    evidence: [],
    malicious: 0,
    suspicious: 0,
  };
}

function virusTotalStatus(
  malicious: number,
  suspicious: number,
  harmless: number | undefined,
): ReputationProviderResult['status'] {
  if (malicious > 0 || suspicious > 0) return 'threat_found';
  return (harmless ?? 0) > 0 ? 'no_match' : 'unavailable';
}

async function checkVirusTotalDomain(domain: string): Promise<ReputationProviderResult & {
  evidence: string[];
  malicious: number;
  suspicious: number;
}> {
  if (!env.virusTotalApiKey) {
    return unavailableVirusTotalResult('The provider is not configured.');
  }
  const apiKey = env.virusTotalApiKey;
  if (!virusTotalQuota.tryAcquire()) {
    return unavailableVirusTotalResult('VirusTotal rate limit quota reached. Try again in a few seconds.');
  }
  const endpoint = new URL(
    `/api/v3/domains/${encodeURIComponent(domain)}`,
    'https://www.virustotal.com',
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  try {
    return await virusTotalCircuitBreaker.execute(async () => {
      const response = await fetch(endpoint, {
        method: 'GET',
        redirect: 'error',
        signal: controller.signal,
        headers: { 'x-apikey': apiKey, Accept: 'application/json' },
      });
      if (response.status === 404) {
        return {
          name: 'VirusTotal',
          status: 'unavailable',
          detail: 'No existing domain report is available; no scan was submitted.',
          evidence: [],
          malicious: 0,
          suspicious: 0,
        };
      }
      if (response.status === 429) {
        return unavailableVirusTotalResult('VirusTotal rate limit reached. Try again later.');
      }
      if (!response.ok) throw new Error('provider_error');
      const parsed = domainReportSchema.safeParse(await readJsonLimited(response, 1_000_000));
      if (!parsed.success) throw new Error('invalid_response');
      const attributes = parsed.data.data.attributes;
      const { malicious, suspicious } = attributes.last_analysis_stats;
      const status = virusTotalStatus(
        malicious,
        suspicious,
        attributes.last_analysis_stats.harmless,
      );
      return {
        name: 'VirusTotal',
        status,
        detail: status === 'threat_found'
          ? `${malicious} malicious and ${suspicious} suspicious engine detections were recorded in the existing domain report.`
          : status === 'no_match'
            ? 'The existing report recorded no malicious or suspicious detections. This does not establish that the domain is safe.'
            : 'The existing report did not contain enough information for a determinate result.',
        evidence: attributes.categories
          ? Object.entries(attributes.categories).slice(0, 10).map(([source, category]) => `${source}: ${category}`)
          : [],
        malicious,
        suspicious,
      };
    });
  } catch {
    return unavailableVirusTotalResult(
      'The provider timed out, could not be reached, or returned an invalid response.',
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function checkVirusTotalFileHash(hash: string): Promise<VirusTotalResult> {
  if (!env.virusTotalApiKey) {
    return unavailableVirusTotalResult('The provider is not configured.');
  }
  const fileApiKey = env.virusTotalApiKey;
  if (!virusTotalQuota.tryAcquire()) {
    return unavailableVirusTotalResult('VirusTotal rate limit quota reached. Try again in a few seconds.');
  }
  const endpoint = new URL(
    `/api/v3/files/${encodeURIComponent(hash)}`,
    'https://www.virustotal.com',
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  try {
    return await virusTotalCircuitBreaker.execute(async () => {
      const response = await fetch(endpoint, {
        method: 'GET',
        redirect: 'error',
        signal: controller.signal,
        headers: { 'x-apikey': fileApiKey, Accept: 'application/json' },
      });

      if (response.status === 404) {
        return unavailableVirusTotalResult(
          'No existing file report is available; no file was uploaded.',
        );
      }
      if (response.status === 429) {
        return unavailableVirusTotalResult('VirusTotal rate limit reached. Try again later.');
      }
      if (!response.ok) throw new Error('provider_error');

      const parsed = fileReportSchema.safeParse(await readJsonLimited(response, 1_000_000));
      if (!parsed.success) throw new Error('invalid_response');
      const attributes = parsed.data.data.attributes;
      const { malicious, suspicious, harmless } = attributes.last_analysis_stats;
      const status = virusTotalStatus(malicious, suspicious, harmless);
      return {
        name: 'VirusTotal',
        status,
        detail: status === 'threat_found'
          ? `The existing file report records ${malicious} malicious and ${suspicious} suspicious engine detections.`
          : status === 'no_match'
            ? 'The existing report recorded no malicious or suspicious detections. This does not establish that the file is safe.'
            : 'The existing report did not contain enough information for a determinate result.',
        evidence: [
          ...(attributes.meaningful_name ? [`Reported name: ${attributes.meaningful_name}`] : []),
          ...(attributes.type_description ? [`Reported type: ${attributes.type_description}`] : []),
        ],
        malicious,
        suspicious,
      };
    });
  } catch {
    return unavailableVirusTotalResult(
      'The provider timed out, could not be reached, or returned an invalid response.',
    );
  } finally {
    clearTimeout(timeout);
  }
}


function providerStatusFromUrlCheck(
  name: string,
  checksPerformed: string[],
  checksUnavailable: string[],
  findings: Array<{ source: string; detail: string }>,
): ReputationProviderResult {
  const matchingFailure = checksUnavailable.find((message) => message.startsWith(`${name}:`));
  if (matchingFailure) {
    return { name, status: 'unavailable', detail: matchingFailure.slice(name.length + 1).trim() };
  }
  if (checksPerformed.includes(name)) {
    const evidence = findings.filter((finding) => finding.source === name);
    return evidence.length
      ? { name, status: 'threat_found', detail: evidence.map((item) => item.detail).join(' ') }
      : {
          name,
          status: 'no_match',
          detail: 'The provider returned no threat match. This does not establish that the URL is safe.',
        };
  }
  return {
    name,
    status: 'unavailable',
    detail: 'No determinate provider result was available.',
  };
}

export async function checkThreatReputation(type: 'url' | 'domain' | 'hash', input: string) {
  if (type === 'hash') {
    if (!/^(?:[a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64})$/i.test(input)) {
      throw new Error('Provide a valid MD5, SHA-1, or SHA-256 file hash.');
    }
    const virusTotalResult = await checkVirusTotalFileHash(input.toLowerCase());
    const providers: ReputationProviderResult[] = [
      {
        name: 'Google Safe Browsing',
        status: 'unavailable',
        detail: 'Google Safe Browsing does not provide file-hash reputation lookups.',
      },
      virusTotalResult,
    ];
    const determination = virusTotalResult.status === 'threat_found'
      ? 'threat_found' as const
      : virusTotalResult.status === 'no_match'
        ? 'no_match' as const
        : 'inconclusive' as const;
    return {
      indicator: input.toLowerCase(),
      type,
      checkedAt: new Date().toISOString(),
      determination,
      confidence: determination === 'threat_found'
        ? 'VirusTotal reported detections in an existing file report.'
        : determination === 'no_match'
          ? 'VirusTotal reported no detections in an existing file report; this is not a safety guarantee.'
          : 'No configured provider returned a determinate file-hash result.',
      providers,
      findings: [],
    };
  }

  const url = type === 'url' ? input : `https://${input}/`;
  const localAnalysis = analyzeUrl(url);
  if (type === 'domain' && localAnalysis.ipLiteral) {
    throw new Error('A domain name is required; IP-address indicators are not accepted here.');
  }
  const checkedAt = new Date().toISOString();
  const urlResult = await checkUrlReputation(localAnalysis.normalizedUrl, true);
  const providers: ReputationProviderResult[] = [
    providerStatusFromUrlCheck(
      'Google Safe Browsing',
      urlResult.checksPerformed,
      urlResult.checksUnavailable,
      urlResult.findings,
    ),
    providerStatusFromUrlCheck(
      'VirusTotal',
      urlResult.checksPerformed,
      urlResult.checksUnavailable,
      urlResult.findings,
    ),
  ];

  if (type === 'domain') {
    const domainResult = await checkVirusTotalDomain(localAnalysis.hostname);
    const index = providers.findIndex((provider) => provider.name === 'VirusTotal');
    if (index >= 0) providers[index] = domainResult;
    else providers.push(domainResult);
  }

  const threatSources = providers.filter((provider) => provider.status === 'threat_found');
  const availableProviders = providers.filter((provider) => provider.status !== 'unavailable').length;
  return {
    indicator: type === 'url'
      ? `${localAnalysis.protocol}//${localAnalysis.hostname}${new URL(localAnalysis.normalizedUrl).pathname === '/' ? '' : '/[path omitted]'}`
      : localAnalysis.hostname,
    type,
    checkedAt,
    determination: threatSources.length
      ? 'threat_found' as const
      : availableProviders > 0
        ? 'no_match' as const
        : 'inconclusive' as const,
    confidence: threatSources.length > 1
      ? 'Multiple configured providers reported a match.'
      : threatSources.length === 1
        ? 'A configured provider reported a match; corroboration may be limited.'
        : availableProviders > 0
          ? 'One or more providers returned no match; this is not a safety guarantee.'
          : 'No configured provider returned a determinate result.',
    providers,
    findings: [
      ...localAnalysis.findings.map((finding) => ({
        title: finding.title,
        detail: finding.detail,
        source: finding.source,
        severity: finding.severity,
        verified: false,
      })),
      ...urlResult.findings.map((finding) => ({
        title: finding.title,
        detail: finding.detail,
        source: finding.source,
        severity: finding.severity,
        verified: finding.verified,
      })),
    ],
  };
}
