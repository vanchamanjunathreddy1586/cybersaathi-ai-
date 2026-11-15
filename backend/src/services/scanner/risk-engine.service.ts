import type { ScanFinding } from './scanner.schema.js';

export type RiskLevel = 'Low Risk' | 'Medium Risk' | 'High Risk' | 'Critical Risk';
export type ScanVerdict = 'Likely Safe' | 'Suspicious' | 'Likely Malicious' | 'Inconclusive';

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  confidence: number;
  confidenceLevel: 'Low' | 'Medium' | 'High';
  verdict: ScanVerdict;
  explanation: string;
}

export function assessRisk(
  findings: ScanFinding[],
  cleanProviderCount: number,
): RiskAssessment {
  const score = Math.min(
    100,
    findings.reduce((total, finding) => total + finding.points, 0),
  );
  const level: RiskLevel = score < 30
    ? 'Low Risk'
    : score < 60
      ? 'Medium Risk'
      : score < 80
        ? 'High Risk'
        : 'Critical Risk';
  const verifiedThreat = findings.some((finding) =>
    finding.verified && finding.points >= 80,
  );
  const heuristicCount = findings.filter((finding) => finding.points > 0).length;
  const confidence = verifiedThreat
    ? 95
    : cleanProviderCount > 0
      ? Math.min(90, 65 + cleanProviderCount * 8)
      : heuristicCount > 0
        ? Math.min(75, 45 + heuristicCount * 5)
        : 30;
  const confidenceLevel = confidence >= 75
    ? 'High'
    : confidence >= 50
      ? 'Medium'
      : 'Low';

  let verdict: ScanVerdict;
  if (verifiedThreat || score >= 60) {
    verdict = 'Likely Malicious';
  } else if (score >= 30) {
    verdict = 'Suspicious';
  } else if (findings.length === 0 && cleanProviderCount > 0) {
    verdict = 'Likely Safe';
  } else if (findings.length > 0 && cleanProviderCount > 0) {
    verdict = score === 0 ? 'Likely Safe' : 'Suspicious';
  } else {
    verdict = 'Inconclusive';
  }

  const explanation = verdict === 'Likely Safe'
    ? 'No suspicious indicators were found in the checks that ran. This is not a guarantee of safety.'
    : verdict === 'Inconclusive'
      ? 'Available local checks did not establish a clear result. Missing or unavailable checks do not mean the content is safe.'
      : verdict === 'Suspicious'
        ? 'One or more suspicious indicators were found. Verify the sender and destination through an independent channel.'
        : 'Strong or multiple indicators were found. Avoid interacting with the content and verify through an independently trusted channel.';

  return { score, level, confidence, confidenceLevel, verdict, explanation };
}
