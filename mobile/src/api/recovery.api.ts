import { apiClient } from './client';

export interface FraudVector {
  id: string;
  name: string;
  description: string;
  urgencyLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  containmentChecklist?: string[];
  legalSections?: string[];
}

export interface EmergencyContact {
  name: string;
  number: string;
  type: 'helpline' | 'bank' | 'portal';
  description?: string;
}

export interface EmergencyDirectory {
  helplines: EmergencyContact[];
  banks: EmergencyContact[];
  portals: { name: string; url: string; description: string }[];
}

export interface ComplaintLetterData {
  victimName: string;
  phone: string;
  email: string;
  incidentDate: string;
  fraudType: string;
  suspectDetails?: string;
  financialLoss?: number;
  transactionId?: string;
  bankName?: string;
  incidentSummary: string;
}

export interface ComplaintDraftResult {
  formattedText: string;
  firSummary: string;
  statutoryProvisions: string[];
}

export async function getFraudVectors(): Promise<FraudVector[]> {
  try {
    const res = await apiClient<{ success: boolean; data: FraudVector[] }>('/recovery/vectors', { skipAuth: true });
    return res.data || [];
  } catch (err) {
    console.warn('[RecoveryAPI] getFraudVectors failed, returning local fallback:', err);
    return [
      { id: 'upi-fraud', name: 'UPI & Payment Gateway Fraud', description: 'Unauthorized UPI debit, QR scam, or fraudulent payment link', urgencyLevel: 'CRITICAL' },
      { id: 'identity-theft', name: 'Identity Theft & Impersonation', description: 'Stolen PAN/Aadhaar used for fake SIM or loans', urgencyLevel: 'HIGH' },
      { id: 'investment-scam', name: 'Fake Investment & Part-time Job', description: 'Task fraud, crypto trading app scam, high yield promise', urgencyLevel: 'HIGH' },
      { id: 'sextortion-blackmail', name: 'Cyber Blackmail & Sextortion', description: 'Video call recording, morphing, extortion demands', urgencyLevel: 'CRITICAL' },
      { id: 'sim-swap', name: 'SIM Swap / OTP Interception', description: 'Sudden loss of cell network accompanied by unauthorized bank OTPs', urgencyLevel: 'CRITICAL' },
    ];
  }
}

export async function getVectorDetail(id: string): Promise<FraudVector | null> {
  try {
    const res = await apiClient<{ success: boolean; data: FraudVector }>(`/recovery/vectors/${id}`, { skipAuth: true });
    return res.data;
  } catch (err) {
    console.warn(`[RecoveryAPI] getVectorDetail failed for ${id}:`, err);
    return null;
  }
}

export async function getEmergencyContacts(): Promise<EmergencyDirectory> {
  try {
    const res = await apiClient<{ success: boolean; data: any }>('/recovery/contacts', { skipAuth: true });
    if (res.data) {
      return {
        helplines: res.data.helplines || [],
        banks: res.data.banks || res.data.bankContacts || [],
        portals: res.data.portals || [],
      };
    }
  } catch (err) {
    console.warn('[RecoveryAPI] getEmergencyContacts fallback to standard Indian helplines:', err);
  }

  return {
    helplines: [
      { name: 'National Cyber Crime Reporting Helpline', number: '1930', type: 'helpline', description: 'Citizen Financial Cyber Fraud Reporting Management System' },
      { name: 'Emergency Police Response', number: '112', type: 'helpline', description: 'National All-in-One Emergency Number' },
      { name: 'National Consumer Helpline', number: '1915', type: 'helpline', description: 'Consumer redressal and merchant fraud' },
    ],
    banks: [
      { name: 'State Bank of India (SBI)', number: '1800111109', type: 'bank' },
      { name: 'HDFC Bank', number: '18001600', type: 'bank' },
      { name: 'ICICI Bank', number: '18001080', type: 'bank' },
      { name: 'Axis Bank', number: '18004195959', type: 'bank' },
    ],
    portals: [
      { name: 'National Cyber Crime Reporting Portal', url: 'https://cybercrime.gov.in', description: 'Official Ministry of Home Affairs Portal' },
      { name: 'Chakshu / Sanchar Saathi', url: 'https://sancharsaathi.gov.in', description: 'Report suspected fraudulent calls and SMS' },
    ],
  };
}

export async function draftComplaint(data: ComplaintLetterData): Promise<ComplaintDraftResult> {
  try {
    const res = await apiClient<{ success: boolean; data: ComplaintDraftResult }>('/recovery/draft-complaint', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true,
    });
    return res.data;
  } catch (err) {
    // Generate clean local draft if API is offline
    const formatted = `FORMAL CYBER CRIME COMPLAINT
Date: ${new Date().toLocaleDateString('en-IN')}
To: The Officer-in-Charge / Cyber Crime Cell

Subject: Complaint regarding Cyber Fraud under IT Act, 2000 and Bharatiya Nyaya Sanhita (BNS)

1. Complainant Details:
   Name: ${data.victimName}
   Mobile: ${data.phone}
   Email: ${data.email}

2. Incident Details:
   Category: ${data.fraudType}
   Date/Time: ${data.incidentDate}
   Financial Loss: INR ${data.financialLoss ?? '0'}
   Transaction / UTR ID: ${data.transactionId || 'N/A'}
   Bank / Wallet: ${data.bankName || 'N/A'}

3. Brief Description:
${data.incidentSummary}

4. Relief Requested:
I request immediate freezing of the beneficiary account through the 1930 / I4C system, registration of an FIR, and recovery of funds.

Sincerely,
${data.victimName}`;

    return {
      formattedText: formatted,
      firSummary: `Complaint for ${data.fraudType} involving INR ${data.financialLoss ?? 0}`,
      statutoryProvisions: ['IT Act Section 66D (Cheating by personation)', 'BNS Section 318 (Cheating)'],
    };
  }
}
