import type { ScanFinding } from './scanner.schema.js';

const suspiciousShorteners = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'is.gd',
  'cutt.ly',
  'rb.gy',
  'shorturl.at',
]);

function isIpv4(value: string): boolean {
  const parts = value.split('.');
  return parts.length === 4 && parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const number = Number(part);
    return number >= 0 && number <= 255;
  });
}

function isIpv6(value: string): boolean {
  return value.includes(':') && /^[\da-f:.]+$/i.test(value);
}

export function analyzeUrl(input: string): {
  normalizedUrl: string;
  hostname: string;
  protocol: 'http:' | 'https:';
  ipLiteral: boolean;
  findings: ScanFinding[];
} {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Enter a complete URL such as https://example.com.');
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    throw new Error('Only credential-free HTTP and HTTPS URLs are supported.');
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const ipLiteral = isIpv4(hostname) || isIpv6(hostname);
  const octets = isIpv4(hostname) ? hostname.split('.').map(Number) : [];
  const firstOctet = octets[0];
  const secondOctet = octets[1];
  const isPrivateIpv4 = firstOctet !== undefined && secondOctet !== undefined && (
    firstOctet === 0 ||
    firstOctet === 10 ||
    firstOctet === 127 ||
    (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) ||
    (firstOctet === 192 && secondOctet === 168) ||
    (firstOctet === 169 && secondOctet === 254)
  );
  const isPrivateIpv6 =
    hostname === '::1' ||
    hostname.startsWith('fc') ||
    hostname.startsWith('fd') ||
    hostname.startsWith('fe8') ||
    hostname.startsWith('fe9') ||
    hostname.startsWith('fea') ||
    hostname.startsWith('feb');
  const findings: ScanFinding[] = [];

  const add = (
    id: string,
    title: string,
    detail: string,
    severity: ScanFinding['severity'],
    points: number,
  ) => findings.push({
    id,
    title,
    detail,
    severity,
    source: 'Local URL pattern analysis',
    verified: false,
    points,
  });

  if (ipLiteral) {
    add(
      'url-ip-literal',
      'IP-address-based destination',
      'The URL uses a numeric IP address instead of a registered domain. This is uncommon for public services and deserves verification.',
      'medium',
      20,
    );
    if (hostname === 'localhost' || isPrivateIpv4 || isPrivateIpv6) {
      add(
        'url-private-address',
        'Private or local network address',
        'The destination resolves to a private, loopback, or link-local address pattern. The scanner does not connect to submitted URLs.',
        'high',
        30,
      );
    }
  }

  if (hostname.startsWith('xn--') || hostname.includes('.xn--')) {
    add(
      'url-punycode',
      'Internationalized domain encoding',
      'The hostname contains punycode. Similar-looking characters can be used to imitate familiar domains; inspect the destination carefully.',
      'medium',
      20,
    );
  }

  if (suspiciousShorteners.has(hostname)) {
    add(
      'url-shortener',
      'URL shortener hides the final destination',
      'The hostname belongs to a URL-shortening service. The final destination was not followed or fetched.',
      'medium',
      20,
    );
  }

  if (url.hostname.split('.').length > 4) {
    add(
      'url-many-subdomains',
      'Unusually nested hostname',
      'The hostname has several subdomain labels, which can make the registered domain harder to notice.',
      'low',
      10,
    );
  }

  if (url.protocol === 'http:') {
    add(
      'url-no-https',
      'HTTPS is not used',
      'The submitted URL uses HTTP. The scanner did not connect to the destination or inspect a certificate.',
      'low',
      10,
    );
  }

  if (/@/.test(url.pathname + url.search)) {
    add(
      'url-at-sign',
      'At-sign in URL path or query',
      'An at-sign appears after the hostname. This can be used to make a URL look misleading; verify the hostname shown by your browser.',
      'medium',
      20,
    );
  }

  if (url.hostname.split('.').some((label) => /^\d+$/.test(label))) {
    add(
      'url-numeric-host-label',
      'Numeric hostname label',
      'A hostname label is entirely numeric. This is not proof of malicious activity, but is unusual and should be checked.',
      'low',
      10,
    );
  }

  return {
    normalizedUrl: url.toString(),
    hostname: url.hostname,
    protocol: url.protocol,
    ipLiteral,
    findings,
  };
}

export function extractUrls(text: string): string[] {
  const candidates = text.match(/(?:https?:\/\/|www\.)[^\s<>"']+/gi) ?? [];
  return [...new Set(candidates.map((candidate) =>
    candidate.replace(/[),.!?;:]+$/, ''),
  ))].slice(0, 20);
}
