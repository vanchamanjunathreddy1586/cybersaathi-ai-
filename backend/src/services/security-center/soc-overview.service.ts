import { env } from '../../config/env.js';
import { verifySupabaseConnectivity } from '../../config/supabase.js';
import { getWebPushConfiguration } from './web-push.service.js';
import { metrics, geminiCircuitBreaker, virusTotalCircuitBreaker } from '../resilience/resilience.service.js';

export interface ProviderHealthItem {
  id: string;
  name: string;
  status: 'operational' | 'degraded' | 'unconfigured' | 'offline';
  configured: boolean;
  circuitState?: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  description: string;
  latencyMs?: number;
}

export interface IndiaThreatVector {
  id: string;
  name: string;
  severity: 'critical' | 'high' | 'medium';
  trend: 'rising' | 'stable' | 'monitoring';
  activeModusOperandi: string;
  commonTargetPlatforms: string[];
  recommendedDefense: string;
  advisoryReference?: string;
}

export interface SocOverviewData {
  timestamp: string;
  uptimeSeconds: number;
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'ATTENTION_REQUIRED';
  providers: ProviderHealthItem[];
  threatTelemetry: IndiaThreatVector[];
  systemMetrics: {
    totalRequests: number;
    totalRateLimitBlocks: number;
    activeQueues: Array<{
      name: string;
      activeWorkers: number;
      queueDepth: number;
      totalProcessed: number;
    }>;
  };
}

export async function getSocOverview(): Promise<SocOverviewData> {
  const [supabaseStatus] = await Promise.all([
    verifySupabaseConnectivity().catch(() => ({ connected: false })),
  ]);

  const webPushConfig = getWebPushConfiguration();
  const metricsSnapshot = metrics.getMetricsSnapshot();

  const providers: ProviderHealthItem[] = [
    {
      id: 'supabase_db',
      name: 'Supabase PostgreSQL (RLS Protected)',
      configured: Boolean(env.supabaseUrl && env.supabasePublishableKey),
      status: supabaseStatus.connected ? 'operational' : 'offline',
      description: 'Primary multi-tenant data store enforcing Row-Level Security policies.',
    },
    {
      id: 'google_safe_browsing',
      name: 'Google Safe Browsing API v4',
      configured: Boolean(env.googleSafeBrowsingApiKey),
      status: env.googleSafeBrowsingApiKey ? 'operational' : 'unconfigured',
      description: 'Global cloud threat intelligence for verified phishing and malware URLs.',
    },
    {
      id: 'virustotal',
      name: 'VirusTotal Intelligence Feeds',
      configured: Boolean(env.virusTotalApiKey),
      status: env.virusTotalApiKey ? (virusTotalCircuitBreaker.getState() === 'OPEN' ? 'degraded' : 'operational') : 'unconfigured',
      circuitState: virusTotalCircuitBreaker.getState(),
      description: 'Multi-engine antivirus verification for file hashes and suspicious URLs.',
    },
    {
      id: 'web_push',
      name: 'Web Push Notification Gateway (VAPID)',
      configured: webPushConfig.configured,
      status: webPushConfig.configured ? 'operational' : 'unconfigured',
      description: 'Encrypted browser push notification delivery for critical fraud alerts.',
    },
    {
      id: 'gemini_ai',
      name: 'Gemini AI Assistant Engine',
      configured: Boolean(env.aiApiKey),
      status: env.aiApiKey ? (geminiCircuitBreaker.getState() === 'OPEN' ? 'degraded' : 'operational') : 'unconfigured',
      circuitState: geminiCircuitBreaker.getState(),
      description: 'AI-guided recovery workflows and multilingual scam analysis.',
    },
  ];

  // India-specific threat vectors tracked by CyberSaathi SOC
  const threatTelemetry: IndiaThreatVector[] = [
    {
      id: 'digital_arrest',
      name: 'Digital Arrest & Supreme Court Extortion',
      severity: 'critical',
      trend: 'rising',
      activeModusOperandi: 'Impersonation of CBI, Mumbai Crime Branch, or ED demanding Skype video confinement and immediate fund transfer to "clearing accounts".',
      commonTargetPlatforms: ['WhatsApp Video', 'Skype', 'Voice Calls'],
      recommendedDefense: 'Hang up immediately. No legal provision for digital arrest exists in India. Call 1930.',
      advisoryReference: 'MHA / I4C Advisory 2024-DA',
    },
    {
      id: 'apk_rat_loan',
      name: 'Predatory Loan APKs & Screen-Sharing Trojans',
      severity: 'critical',
      trend: 'rising',
      activeModusOperandi: 'Unofficial APKs harvesting Contacts and Media for blackmail, or AnyDesk/TeamViewer coercion via fake customer support.',
      commonTargetPlatforms: ['Sideloaded APKs', 'Telegram Groups', 'SMS Links'],
      recommendedDefense: 'Never grant Accessibility or Contacts permission to loan apps; install solely from Google Play.',
      advisoryReference: 'RBI Digital Lending Guidelines',
    },
    {
      id: 'fedex_narcotics',
      name: 'FedEx / Customs Narcotics Parcel Scam',
      severity: 'high',
      trend: 'rising',
      activeModusOperandi: 'Claims that a courier in victim name contains narcotics/passports and demands legal fee transfer to avoid airport police custody.',
      commonTargetPlatforms: ['Telecom Calls', 'VoIP Spoofed Numbers'],
      recommendedDefense: 'Verify directly via courier official tracking. Customs never demands UPI transfer.',
      advisoryReference: 'DoT Chakshu Telecommunications Alert',
    },
    {
      id: 'upi_qr_reverse',
      name: 'UPI Reverse Charge & Fake Payment QR',
      severity: 'high',
      trend: 'stable',
      activeModusOperandi: 'Victim asked to scan QR code or enter UPI PIN to "receive" funds for marketplace listings or refunds.',
      commonTargetPlatforms: ['Google Pay', 'PhonePe', 'Paytm', 'OLX'],
      recommendedDefense: 'UPI PIN is ONLY required to send money, NEVER to receive money.',
      advisoryReference: 'NPCI UPI Safety Directive',
    },
    {
      id: 'electricity_cutoff',
      name: 'Electricity Bill Disconnection Panic Scam',
      severity: 'medium',
      trend: 'stable',
      activeModusOperandi: 'Urgent SMS threatening power cutoff at 9:30 PM unless a small fee is paid or an APK utility app is installed.',
      commonTargetPlatforms: ['SMS', 'WhatsApp'],
      recommendedDefense: 'Verify exclusively via official state discom web portals or electricity bills.',
    },
  ];

  // Active queues snapshot
  const activeQueues = Object.entries(metricsSnapshot.queues).map(([name, q]) => ({
    name,
    activeWorkers: q.activeWorkers,
    queueDepth: q.queueDepth,
    totalProcessed: q.totalProcessed,
  }));

  const anyCircuitOpen = providers.some((p) => p.circuitState === 'OPEN');
  const dbOffline = !supabaseStatus.connected;
  const overallStatus = dbOffline
    ? 'DEGRADED'
    : anyCircuitOpen
      ? 'ATTENTION_REQUIRED'
      : 'HEALTHY';

  return {
    timestamp: new Date().toISOString(),
    uptimeSeconds: metricsSnapshot.uptimeSeconds,
    overallStatus,
    providers,
    threatTelemetry,
    systemMetrics: {
      totalRequests: metricsSnapshot.totalRequests,
      totalRateLimitBlocks: metricsSnapshot.totalRateLimitBlocks,
      activeQueues,
    },
  };
}
