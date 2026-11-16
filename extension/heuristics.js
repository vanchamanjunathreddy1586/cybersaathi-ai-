/**
 * CyberSaathi AI — Deterministic Web Scam & Phishing Heuristic Engine
 * Pure offline evaluation without sending browsing history to external servers.
 */

export const LEGITIMATE_INDIAN_DOMAINS = new Set([
  'onlinesbi.sbi',
  'sbi.co.in',
  'hdfcbank.com',
  'icicibank.com',
  'axisbank.com',
  'pnbindia.in',
  'bankofbaroda.in',
  'canarabank.com',
  'unionbankofindia.co.in',
  'paytm.com',
  'phonepe.com',
  'google.com',
  'pay.google.com',
  'incometax.gov.in',
  'uidai.gov.in',
  'epfindia.gov.in',
  'indiapost.gov.in',
  'sancharsaathi.gov.in',
  'cybercrime.gov.in',
  'npci.org.in',
  'rbi.org.in',
])

export const SENSITIVE_BRANDS = [
  { name: 'State Bank of India (SBI)', match: /sbi|onlinesbi/i, legitRoot: /(?:^|\.)(?:sbi\.co\.in|onlinesbi\.sbi)$/i },
  { name: 'HDFC Bank', match: /hdfc/i, legitRoot: /(?:^|\.)hdfcbank\.com$/i },
  { name: 'ICICI Bank', match: /icici/i, legitRoot: /(?:^|\.)icicibank\.com$/i },
  { name: 'Axis Bank', match: /axisbank/i, legitRoot: /(?:^|\.)axisbank\.com$/i },
  { name: 'Punjab National Bank (PNB)', match: /pnbindia|pnbbank/i, legitRoot: /(?:^|\.)pnbindia\.in$/i },
  { name: 'Paytm', match: /paytm/i, legitRoot: /(?:^|\.)paytm\.com$/i },
  { name: 'PhonePe', match: /phonepe/i, legitRoot: /(?:^|\.)phonepe\.com$/i },
  { name: 'Income Tax Department (India)', match: /incometax/i, legitRoot: /(?:^|\.)incometax\.gov\.in$/i },
  { name: 'Aadhaar / UIDAI', match: /uidai|aadhaar|myaadhaar/i, legitRoot: /(?:^|\.)uidai\.gov\.in$/i },
  { name: 'EPFO India', match: /epfindia|epfo/i, legitRoot: /(?:^|\.)epfindia\.gov\.in$/i },
  { name: 'India Post', match: /indiapost/i, legitRoot: /(?:^|\.)indiapost\.gov\.in$/i },
]

export const SUSPICIOUS_TLDS = new Set([
  '.xyz',
  '.top',
  '.click',
  '.loan',
  '.zip',
  '.buzz',
  '.work',
  '.country',
  '.gq',
  '.cf',
  '.tk',
  '.ml',
  '.live',
])

export const URGENT_PHISHING_KEYWORDS = [
  'kyc',
  'pan',
  'update',
  'verify',
  'verification',
  'reward',
  'lottery',
  'blocked',
  'freeze',
  'suspended',
  'electricity',
  'cutoff',
  'digital-arrest',
  'police-warrant',
  'refund',
]

/**
 * Evaluates an input URL deterministically against offline indicators.
 */
export function evaluateUrlHeuristics(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return {
      isValid: false,
      riskScore: 60,
      verdict: 'Suspicious',
      indicators: ['Empty or non-string URL input.'],
      recommendation: 'Provide a valid URL.',
    }
  }

  const rawLower = rawUrl.toLowerCase().trim()
  const indicators = []
  let score = 0

  // 0. Pre-parse check for Punycode in raw input
  if (rawLower.includes('xn--')) {
    score += 45
    indicators.push('Hostname contains Punycode (xn--) which may spoof legitimate Latin characters.')
  }

  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    return {
      isValid: false,
      riskScore: score > 0 ? Math.min(100, score + 30) : 60,
      verdict: 'Suspicious',
      indicators: indicators.length > 0 ? indicators : ['Malformed or invalid URL structure.'],
      recommendation: 'Do not open malformed URLs.',
    }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      riskScore: 50,
      verdict: 'Suspicious',
      indicators: [`Unsupported protocol (${parsed.protocol}). Only HTTP and HTTPS are checked.`],
      recommendation: 'Exercise caution with non-standard protocols.',
    }
  }

  const hostname = parsed.hostname.toLowerCase()
  const pathname = parsed.pathname.toLowerCase()
  const fullHref = parsed.href.toLowerCase()

  // 1. Check IP literal in hostname
  const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)
  const isIpv6 = hostname.startsWith('[') && hostname.endsWith(']')
  if (isIpv4 || isIpv6) {
    score += 45
    indicators.push(`Host is a raw numerical IP address (${hostname}) instead of a registered domain name.`)
  }

  // 2. Embedded user credentials
  if (parsed.username || parsed.password) {
    score += 40
    indicators.push('URL embeds user credentials in the authority segment to deceive users.')
  }

  // 3. Excessive subdomain depth (> 3 parts, e.g. a.b.c.d.com)
  const parts = hostname.split('.')
  if (parts.length > 4 && !isIpv4) {
    score += 15
    indicators.push(`Excessive subdomain depth (${parts.length} segments), often used in nested phishing links.`)
  }

  // 4. Sensitive Brand Spoofing (Indian Banking & Govt)
  for (const brand of SENSITIVE_BRANDS) {
    const isBrandMentioned = brand.match.test(hostname) || brand.match.test(pathname)
    if (isBrandMentioned) {
      const isLegit = brand.legitRoot.test(hostname)
      if (!isLegit) {
        score += 75
        indicators.push(
          `Deceptive brand impersonation: Contains reference to "${brand.name}", but the registered host "${hostname}" is NOT official.`
        )
      }
    }
  }

  // 6. Suspicious TLD combined with urgent phishing keywords
  const tld = '.' + parts.slice(-1)[0]
  if (SUSPICIOUS_TLDS.has(tld)) {
    score += 20
    indicators.push(`Uses high-risk low-reputation top-level domain (${tld}).`)

    const hasUrgentKeyword = URGENT_PHISHING_KEYWORDS.some((kw) => fullHref.includes(kw))
    if (hasUrgentKeyword) {
      score += 25
      indicators.push('High-risk TLD combined with urgency/KYC/account-freeze keywords.')
    }
  }

  // 7. Dangerous file extension directly in download link
  const dangerousExts = ['.apk', '.exe', '.scr', '.vbs', '.bat']
  for (const ext of dangerousExts) {
    if (pathname.endsWith(ext)) {
      score += 30
      indicators.push(`Direct link to potentially hazardous executable file (${ext}).`)
      break
    }
  }

  // Normalize score between 0 and 100
  const finalScore = Math.min(100, Math.max(0, score))

  let verdict = 'Likely Safe'
  if (finalScore >= 75) {
    verdict = 'Likely Malicious'
  } else if (finalScore >= 35) {
    verdict = 'Suspicious'
  }

  let recommendation = 'No conspicuous phishing patterns detected in this domain structure.'
  if (verdict === 'Likely Malicious') {
    recommendation = 'DO NOT PROCEED. This link exhibits brand spoofing, numerical IP host, or phishing indicators.'
  } else if (verdict === 'Suspicious') {
    recommendation = 'Exercise caution. Verify the sender and never enter OTP, passwords, or banking credentials.'
  }

  return {
    isValid: true,
    hostname,
    riskScore: finalScore,
    verdict,
    indicators,
    recommendation,
  }
}
