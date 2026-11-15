import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateUrlHeuristics } from '../heuristics.js'

test('allows legitimate Indian bank and government portals with Likely Safe verdict', () => {
  const legitUrls = [
    'https://www.onlinesbi.sbi/sbijava/osbi_retail_login.html',
    'https://sbi.co.in/web/personal-banking',
    'https://www.hdfcbank.com/personal',
    'https://www.icicibank.com/personal-banking',
    'https://incometax.gov.in/iec/foportal/',
    'https://myaadhaar.uidai.gov.in/',
    'https://sancharsaathi.gov.in/Chakshu/',
    'https://cybercrime.gov.in/',
  ]

  for (const url of legitUrls) {
    const res = evaluateUrlHeuristics(url)
    assert.equal(res.verdict, 'Likely Safe', `Expected Likely Safe for ${url}`)
    assert.ok(res.riskScore <= 15, `Expected score <= 15 for ${url}, got ${res.riskScore}`)
    assert.equal(res.indicators.length, 0, `Expected 0 indicators for ${url}`)
  }
})

test('detects deceptive Indian bank brand spoofing on rogue domains', () => {
  const spoofedUrls = [
    'http://onlinesbi.verify-security-login.xyz/kyc-update',
    'https://hdfc.banking-auth-portal.top/pan-freeze',
    'http://icici.reward-points-cash.buzz/claim',
    'https://sbi-instant-loan.click/apply.html',
    'http://incometax-refund-verification.work/login',
    'https://myaadhaar-update.online/aadhaar-pan-link',
  ]

  for (const url of spoofedUrls) {
    const res = evaluateUrlHeuristics(url)
    assert.equal(res.verdict, 'Likely Malicious', `Expected Likely Malicious for ${url}`)
    assert.ok(res.riskScore >= 75, `Expected score >= 75 for ${url}, got ${res.riskScore}`)
    assert.ok(
      res.indicators.some((ind) => ind.includes('Deceptive brand impersonation')),
      `Must flag brand impersonation for ${url}`
    )
  }
})

test('detects raw numerical IP literal hosts', () => {
  const ipUrl = 'http://192.168.1.55/admin/login'
  const res = evaluateUrlHeuristics(ipUrl)

  assert.ok(res.riskScore >= 45)
  assert.ok(res.indicators.some((ind) => ind.includes('numerical IP address')))
})

test('detects Punycode IDN homograph attack domains', () => {
  const punycodeUrl = 'https://xn--sbi-7oa.com/secure-banking'
  const res = evaluateUrlHeuristics(punycodeUrl)

  assert.ok(res.indicators.some((ind) => ind.includes('Punycode')))
})

test('detects direct executable and APK links', () => {
  const apkUrl = 'https://fast-cash-easy-loan.com/downloads/instant_loan.apk'
  const res = evaluateUrlHeuristics(apkUrl)

  assert.ok(res.indicators.some((ind) => ind.includes('hazardous executable file (.apk)')))
})

test('handles malformed URLs gracefully without throwing exceptions', () => {
  const malformed = 'not-a-valid-protocol://foo'
  const res = evaluateUrlHeuristics(malformed)

  assert.equal(res.isValid, false)
  assert.equal(res.verdict, 'Suspicious')
})
