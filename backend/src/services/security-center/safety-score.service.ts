import { getUserSupabaseClient } from '../../config/supabase.js';

export interface ScorePillar {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  status: 'good' | 'fair' | 'needs_improvement';
  signals: string[];
}

export interface ScoreRecommendation {
  id: string;
  title: string;
  pointsPotential: number;
  actionUrl: string;
  actionLabel: string;
  description: string;
  category: string;
}

export interface SafetyScoreResult {
  score: number;
  tier: 'Vulnerable' | 'Moderate' | 'Strong' | 'Fortified';
  grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  summary: string;
  pillars: ScorePillar[];
  recommendations: ScoreRecommendation[];
  stats: {
    totalScans: number;
    appScans: number;
    callScans: number;
    lessonsCompleted: number;
    activeCases: number;
    unresolvedAlerts: number;
  };
  computedAt: string;
}

export async function calculateUserSafetyScore(accessToken: string, userId: string): Promise<SafetyScoreResult> {
  const client = getUserSupabaseClient(accessToken);

  // Collect user's real platform posture data in parallel with safe fallbacks
  const [
    profileRes,
    scansRes,
    appScansRes,
    callScansRes,
    alertsRes,
    lessonsRes,
    investigationsRes,
    preferencesRes,
  ] = await Promise.all([
    client.from('user_profiles').select('id, full_name').eq('id', userId).maybeSingle(),
    client.from('scan_results').select('id', { count: 'exact' }),
    client.from('app_scans').select('id', { count: 'exact', head: true }),
    client.from('call_scans').select('id', { count: 'exact', head: true }),
    client.from('security_alerts').select('id, severity, read_at'),
    client.from('user_lesson_progress').select('lesson_id, completed_at'),
    client.from('investigations').select('id, status'),
    client.from('user_notification_preferences').select('critical_alerts, high_risk_alerts').eq('user_id', userId).maybeSingle(),
  ]);

  const profile = profileRes.data;
  const totalScans = scansRes.count ?? 0;
  const appScans = appScansRes.count ?? 0;
  const callScans = callScansRes.count ?? 0;
  const alerts = alertsRes.data ?? [];
  const lessons = lessonsRes.data ?? [];
  const investigations = investigationsRes.data ?? [];
  const preferences = preferencesRes.data;

  // 1. Pillar: Account & Credential Protection (Max 25 pts)
  let p1Score = 10; // Baseline for authenticated, registered user
  const p1Signals: string[] = ['Account authenticated with Supabase credentials'];

  if (profile?.full_name && profile.full_name.trim().length > 2) {
    p1Score += 5;
    p1Signals.push('Profile identity configured');
  } else {
    p1Signals.push('Profile identity incomplete');
  }

  if (preferences?.critical_alerts !== false) {
    p1Score += 10;
    p1Signals.push('Security alerts enabled');
  } else {
    p1Signals.push('Critical notifications muted');
  }
  p1Score = Math.min(25, p1Score);

  // 2. Pillar: Threat Detection & Vigilance (Max 25 pts)
  let p2Score = 0;
  const p2Signals: string[] = [];

  if (totalScans >= 3) {
    p2Score += 10;
    p2Signals.push(`${totalScans} URL/SMS/QR checks performed`);
  } else if (totalScans >= 1) {
    p2Score += 5;
    p2Signals.push(`${totalScans} URL/SMS checks performed`);
  } else {
    p2Signals.push('No link or SMS scans conducted yet');
  }

  if (appScans >= 1) {
    p2Score += 5;
    p2Signals.push('Mobile APK security audit completed');
  }

  if (callScans >= 1) {
    p2Score += 5;
    p2Signals.push('Telecom/call threat check completed');
  }

  const combinedScans = totalScans + appScans + callScans;
  if (combinedScans >= 5) {
    p2Score += 5;
    p2Signals.push('Regular scanning cadence observed');
  }
  p2Score = Math.min(25, p2Score);

  // 3. Pillar: Threat Resolution & Cyber Hygiene (Max 25 pts)
  let p3Score = 15;
  const p3Signals: string[] = [];

  const unreadCriticalAlerts = alerts.filter(
    (a) => a.severity === 'critical' && a.read_at === null,
  ).length;

  if (unreadCriticalAlerts === 0) {
    p3Score += 10;
    p3Signals.push('Zero unaddressed critical security alerts');
  } else if (unreadCriticalAlerts <= 2) {
    p3Score += 4;
    p3Signals.push(`${unreadCriticalAlerts} unread critical alert(s) pending review`);
  } else {
    p3Score = Math.max(0, p3Score - 10);
    p3Signals.push(`${unreadCriticalAlerts} unread critical alerts need urgent review`);
  }

  const openCases = investigations.filter((i) => i.status === 'open' || i.status === 'in_progress').length;
  if (openCases > 0) {
    p3Signals.push(`${openCases} active incident investigation(s) tracked`);
  } else {
    p3Signals.push('No open unmanaged security incidents');
  }
  p3Score = Math.min(25, Math.max(0, p3Score));

  // 4. Pillar: Cyber Academy & Preparedness (Max 25 pts)
  const uniqueLessons = new Set(lessons.map((l) => l.lesson_id)).size;
  const p4Score = Math.min(25, uniqueLessons * 5);
  const p4Signals: string[] = [];
  if (uniqueLessons >= 5) {
    p4Signals.push(`${uniqueLessons} security training modules completed (Max score)`);
  } else if (uniqueLessons > 0) {
    p4Signals.push(`${uniqueLessons} security modules completed`);
  } else {
    p4Signals.push('No cybersecurity training modules completed yet');
  }

  // Calculate Overall Score
  const totalScore = Math.min(100, p1Score + p2Score + p3Score + p4Score);

  let tier: SafetyScoreResult['tier'] = 'Vulnerable';
  let grade: SafetyScoreResult['grade'] = 'D';
  let summary = 'Your digital defenses have significant exposure. Follow the recommendations below to strengthen your protection.';

  if (totalScore >= 90) {
    tier = 'Fortified';
    grade = 'A+';
    summary = 'Exemplary security posture. Your habits across scam verification, threat monitoring, and education provide strong protection.';
  } else if (totalScore >= 75) {
    tier = 'Strong';
    grade = 'A';
    summary = 'Robust security posture with strong scanning and response habits. A few actions can further harden your defenses.';
  } else if (totalScore >= 50) {
    tier = 'Moderate';
    grade = 'B';
    summary = 'Moderate security posture. While foundational protections are active, completing training and scanning suspicious messages will reduce risk.';
  } else if (totalScore >= 35) {
    tier = 'Vulnerable';
    grade = 'C';
  }

  const pillars: ScorePillar[] = [
    {
      id: 'credentials',
      name: 'Account & Identity Protection',
      score: p1Score,
      maxScore: 25,
      status: p1Score >= 20 ? 'good' : p1Score >= 14 ? 'fair' : 'needs_improvement',
      signals: p1Signals,
    },
    {
      id: 'vigilance',
      name: 'Scam Detection & Vigilance',
      score: p2Score,
      maxScore: 25,
      status: p2Score >= 18 ? 'good' : p2Score >= 10 ? 'fair' : 'needs_improvement',
      signals: p2Signals,
    },
    {
      id: 'hygiene',
      name: 'Threat Resolution & Hygiene',
      score: p3Score,
      maxScore: 25,
      status: p3Score >= 20 ? 'good' : p3Score >= 12 ? 'fair' : 'needs_improvement',
      signals: p3Signals,
    },
    {
      id: 'education',
      name: 'Cyber Academy & Preparedness',
      score: p4Score,
      maxScore: 25,
      status: p4Score >= 20 ? 'good' : p4Score >= 10 ? 'fair' : 'needs_improvement',
      signals: p4Signals,
    },
  ];

  // Dynamic recommendations
  const recommendations: ScoreRecommendation[] = [];

  if (uniqueLessons < 4) {
    recommendations.push({
      id: 'rec-academy',
      title: 'Complete Cyber Defense Modules',
      pointsPotential: Math.min(15, (5 - uniqueLessons) * 5),
      actionUrl: '/academy',
      actionLabel: 'Go to Cyber Academy',
      description: 'Strengthen your scam defense habits by finishing lessons on Phishing, Digital Arrests, and UPI Fraud.',
      category: 'Education',
    });
  }

  if (appScans === 0) {
    recommendations.push({
      id: 'rec-app-scanner',
      title: 'Audit Your Android Applications',
      pointsPotential: 5,
      actionUrl: '/app-security',
      actionLabel: 'Scan an App APK',
      description: 'Verify that third-party APKs or instant loan apps do not harvest sensitive contacts, SMS, or accessibility access.',
      category: 'Mobile Safety',
    });
  }

  if (callScans === 0) {
    recommendations.push({
      id: 'rec-call-scanner',
      title: 'Verify Suspicious Calls & Voice Notes',
      pointsPotential: 5,
      actionUrl: '/call-security',
      actionLabel: 'Open Call Analyzer',
      description: 'Run call dialogues or voicemails through forensic extortion detection to expose fake CBI, Customs, or TRAI intimidation.',
      category: 'Telecom Defense',
    });
  }

  if (unreadCriticalAlerts > 0) {
    recommendations.push({
      id: 'rec-alerts',
      title: 'Address Critical Security Alerts',
      pointsPotential: 10,
      actionUrl: '/security/alerts',
      actionLabel: 'Review Alerts',
      description: `You have ${unreadCriticalAlerts} unread critical alert(s) that require triage or resolution.`,
      category: 'Incident Response',
    });
  }

  if (totalScans < 3) {
    recommendations.push({
      id: 'rec-scans',
      title: 'Check Suspicious Links & SMS Messages',
      pointsPotential: 5,
      actionUrl: '/scanner',
      actionLabel: 'Open Scam Scanner',
      description: 'Scan incoming bank alert SMS or reward links before opening them.',
      category: 'Vigilance',
    });
  }

  return {
    score: totalScore,
    tier,
    grade,
    summary,
    pillars,
    recommendations,
    stats: {
      totalScans,
      appScans,
      callScans,
      lessonsCompleted: uniqueLessons,
      activeCases: openCases,
      unresolvedAlerts: unreadCriticalAlerts,
    },
    computedAt: new Date().toISOString(),
  };
}
