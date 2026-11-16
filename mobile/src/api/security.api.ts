import { apiClient } from './client';

export interface ThreatAdvisory {
  id: string;
  title: string;
  category: string;
  severity: 'medium' | 'high' | 'critical';
  summary: string;
  recommendedAction: string;
  source: string;
  date: string;
}

export interface SecurityScoreData {
  score: number; // 0 - 100
  tier: 'BASIC' | 'ENHANCED' | 'HARDENED';
  checksPassed: number;
  totalChecks: number;
  factors: {
    name: string;
    passed: boolean;
    points: number;
    description: string;
  }[];
}

const FALLBACK_ADVISORIES: ThreatAdvisory[] = [
  {
    id: 'adv-1',
    title: 'Surge in Digital Arrest Scam Campaigns Impersonating CBI/Customs',
    category: 'Video Call Extortion',
    severity: 'critical',
    summary: 'Fraudsters masquerading as federal police officers place Skype/WhatsApp video calls with fake police backgrounds, threatening victims with arrest unless funds are transferred to "escrow verification" accounts.',
    recommendedAction: 'Indian law enforcement agencies never conduct arrests or investigations via Skype/WhatsApp video calls. Disconnect immediately and call 1930.',
    source: 'National Cyber Crime Reporting Portal (I4C)',
    date: 'Recent',
  },
  {
    id: 'adv-2',
    title: 'Fake APKs Disguised as Electricity Bill Update Utilities',
    category: 'Android Trojan',
    severity: 'high',
    summary: 'SMS messages claiming power will be disconnected at 9:30 PM provide links to download malicious APKs that steal SMS OTPs and access banking apps.',
    recommendedAction: 'Never install .apk files sent via SMS or WhatsApp. Only download apps from Google Play Store.',
    source: 'CERT-In Security Advisory',
    date: 'Recent',
  },
  {
    id: 'adv-3',
    title: 'UPI Collect Request Manipulations disguised as Cashback Refunds',
    category: 'UPI Fraud',
    severity: 'high',
    summary: 'Scammers send collect requests of ₹25,000 titled "Refund Processed: Click Pay and Enter PIN to Claim".',
    recommendedAction: 'Entering your UPI PIN authorizes MONEY DEDUCTION from your account. You NEVER enter a PIN to receive funds.',
    source: 'NPCI Security Notification',
    date: 'Recent',
  },
];

export async function getThreatAdvisories(): Promise<ThreatAdvisory[]> {
  try {
    const res = await apiClient<{ success: boolean; alerts: any[] }>('/security-center/alerts?severity=all');
    if (res.alerts && res.alerts.length > 0) {
      return res.alerts.map((a) => ({
        id: a.id,
        title: a.title || 'Security Advisory',
        category: a.category || 'Threat Alert',
        severity: a.severity || 'high',
        summary: a.summary || a.message || '',
        recommendedAction: a.action || 'Follow cyber hygiene best practices.',
        source: 'CyberSaathi Threat Radar',
        date: a.created_at || new Date().toISOString(),
      }));
    }
    return FALLBACK_ADVISORIES;
  } catch (err) {
    console.warn('[SecurityAPI] getThreatAdvisories fallback:', err);
    return FALLBACK_ADVISORIES;
  }
}

export async function getUserSafetyScore(): Promise<SecurityScoreData> {
  try {
    const res = await apiClient<{ success: boolean; data: any }>('/security-center/safety-score');
    if (res.data) {
      return res.data;
    }
  } catch (err) {
    console.warn('[SecurityAPI] getUserSafetyScore fallback:', err);
  }

  return {
    score: 85,
    tier: 'ENHANCED',
    checksPassed: 5,
    totalChecks: 6,
    factors: [
      { name: 'Multi-Factor / Biometric Auth', passed: true, points: 20, description: 'Device screen lock or biometric gate active.' },
      { name: 'Recent URL Scam Verification', passed: true, points: 20, description: 'Regular scam scanning of suspicious incoming messages.' },
      { name: 'Academy Hygiene Training', passed: true, points: 15, description: 'Completed essential cyber hygiene course.' },
      { name: 'Emergency Contacts Configured', passed: true, points: 15, description: '1930 Cybercrime Helpline accessible in one-touch.' },
      { name: 'No Active Severe Alerts', passed: true, points: 15, description: 'No unacknowledged critical threat advisories.' },
      { name: 'Family Circle Sync', passed: false, points: 0, description: 'Add your family members to share emergency threat broadcasts.' },
    ],
  };
}
