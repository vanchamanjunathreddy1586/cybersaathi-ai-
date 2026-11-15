import { z } from 'zod';
import {
  FRAUD_VECTORS,
  BANK_EMERGENCY_CONTACTS,
  EMERGENCY_HELPLINES,
  type FraudVector,
  type BankEmergencyContact,
} from './fraud-recovery.data.js';
import { createInvestigation, addInvestigationNote } from '../investigations/investigation.service.js';

export const complaintInputSchema = z.object({
  victimName: z.string().trim().min(2).max(100),
  victimPhone: z.string().trim().regex(/^[0-9+ -]{10,15}$/, 'Invalid phone number format.'),
  victimEmail: z.string().trim().email(),
  victimAddress: z.string().trim().min(5).max(300),
  incidentDate: z.string().trim().min(4).max(50),
  incidentTime: z.string().trim().min(2).max(30),
  vectorId: z.string().trim().min(1).max(50),
  policeStation: z.string().trim().max(100).default('Cyber Crime Police Station / Local Police Station'),
  cityState: z.string().trim().min(2).max(100),
  lossAmountInr: z.number().nonnegative().optional(),
  bankName: z.string().trim().max(100).optional(),
  accountNumberLast4: z.string().trim().max(20).optional(),
  transactionIdUtr: z.string().trim().max(100).optional(),
  accusedIdentifier: z.string().trim().max(200).optional(),
  cybercrimeAckNumber: z.string().trim().max(50).optional(),
  incidentChronology: z.string().trim().min(20).max(5_000),
  evidenceList: z.array(z.string().trim().min(1).max(200)).min(1).max(20),
});

export type ComplaintInput = z.infer<typeof complaintInputSchema>;

export interface ComplaintDraftResult {
  formattedText: string;
  subjectLine: string;
  applicableSections: string[];
  reliefSought: string[];
  annexures: string[];
  generatedAt: string;
}

export interface VectorSummary {
  id: string;
  title: string;
  category: string;
  urgencyLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  shortDescription: string;
  goldenHourMinutes: number;
  totalChecklistSteps: number;
}

export class FraudRecoveryService {
  /**
   * Retrieves summary list of all supported Indian cyber fraud vectors.
   */
  public listVectors(): VectorSummary[] {
    return Object.values(FRAUD_VECTORS).map((vector) => ({
      id: vector.id,
      title: vector.title,
      category: vector.category,
      urgencyLevel: vector.urgencyLevel,
      shortDescription: vector.shortDescription,
      goldenHourMinutes: vector.goldenHourMinutes,
      totalChecklistSteps: vector.goldenHourChecklist.length,
    }));
  }

  /**
   * Retrieves comprehensive guidance, checklists, legal sections, and portals for a vector.
   */
  public getVector(vectorId: string): FraudVector | null {
    return FRAUD_VECTORS[vectorId] ?? null;
  }

  /**
   * Retrieves emergency directory of national helplines and 24x7 bank fraud desks.
   */
  public getEmergencyDirectory(): {
    helplines: typeof EMERGENCY_HELPLINES;
    bankContacts: BankEmergencyContact[];
  } {
    return {
      helplines: EMERGENCY_HELPLINES,
      bankContacts: BANK_EMERGENCY_CONTACTS,
    };
  }

  /**
   * Dynamically drafts a formal legal complaint / FIR representation
   * for submission to the Cyber Crime Police Station or cybercrime.gov.in.
   */
  public generateComplaintLetter(rawInput: unknown): ComplaintDraftResult {
    const input = complaintInputSchema.parse(rawInput);
    const vector = FRAUD_VECTORS[input.vectorId];
    const vectorTitle = vector ? vector.title : 'Cyber Crime & Financial Fraud';
    const applicableSections = vector
      ? vector.legalSections.map((sec) => `${sec.code} (${sec.act})`)
      : ['Section 66D, Information Technology Act, 2000', 'Section 318(4), Bharatiya Nyaya Sanhita, 2023 / Section 420 IPC'];

    const dateFormatted = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const subjectLine = `FORMAL COMPLAINT REGARDING ${vectorTitle.toUpperCase()} & FRAUDULENT MISAPPROPRIATION OF FUNDS UNDER ${applicableSections.slice(0, 2).join(' & ')}`;

    const reliefSought = [
      'Registration of a formal First Information Report (FIR) / Cyber Crime Complaint under the cited sections of the Information Technology Act and Bharatiya Nyaya Sanhita.',
      'Immediate issuance of an electronic preservation & debit-freeze order under Section 106 of the Bharatiya Nagarik Suraksha Sanhita (BNSS) / Section 102 of CrPC to the beneficiary bank(s) and intermediaries to secure the defrauded amount.',
      'Requisition of IP login logs, MAC addresses, device fingerprints, IMEI, and call detail records (CDR) from telecom service providers and intermediaries under Section 94 BNSS / Section 91 CrPC.',
      'Facilitation of lawful recovery and restitution of defrauded funds to the complainant in accordance with RBI and regulatory guidelines.',
    ];

    const lossText = input.lossAmountInr !== undefined && input.lossAmountInr > 0
      ? `Total Defrauded Amount: ₹${input.lossAmountInr.toLocaleString('en-IN')}/- (Indian Rupees)`
      : 'Financial Loss: As detailed in bank debit records.';

    const ackText = input.cybercrimeAckNumber
      ? `National Cybercrime Reporting Portal (1930 / cybercrime.gov.in) Ack No.: ${input.cybercrimeAckNumber}`
      : 'NCRP Ack: Pending registration / logged via 1930 Helpline.';

    const formattedText = `
TO,
THE STATION HOUSE OFFICER / OFFICER-IN-CHARGE,
${input.policeStation.toUpperCase()},
${input.cityState.toUpperCase()}.

DATE: ${dateFormatted}

SUBJECT: ${subjectLine}

RESPECTED SIR / MADAM,

I, the undersigned complainant, wish to bring to your immediate official notice an incident of serious cybercrime, deceit, and financial fraud committed against me. The details of the incident and parties involved are submitted hereunder for appropriate criminal action:

1. PARTICULARS OF THE COMPLAINANT:
--------------------------------------------------------------------------------
Name               : ${input.victimName}
Contact Number     : ${input.victimPhone}
Email Address      : ${input.victimEmail}
Residential Address: ${input.victimAddress}, ${input.cityState}

2. INCIDENT & TRANSACTION PARTICULARS:
--------------------------------------------------------------------------------
Category of Crime  : ${vectorTitle}
Date & Time        : ${input.incidentDate} at approximately ${input.incidentTime}
${lossText}
Bank Name          : ${input.bankName ?? 'N/A'}
Debited Account    : ${input.accountNumberLast4 ? `Account ending in ${input.accountNumberLast4}` : 'As attached in bank statement'}
Transaction Ref/UTR: ${input.transactionIdUtr ?? 'N/A'}
Accused Details    : ${input.accusedIdentifier ?? 'Unidentified cyber fraudster(s) operating through digital channels / mule accounts'}
${ackText}

3. CHRONOLOGICAL STATEMENT OF FACTS:
--------------------------------------------------------------------------------
${input.incidentChronology}

4. APPLICABLE LEGAL PROVISIONS:
--------------------------------------------------------------------------------
The aforementioned fraudulent conduct prima facie constitutes cognizable criminal offences under:
${applicableSections.map((sec, idx) => `  ${idx + 1}. ${sec}`).join('\n')}
along with other relevant provisions of the Bharatiya Nyaya Sanhita, 2023 (or Indian Penal Code) and Information Technology Act, 2000.

5. PRAYER / RELIEF SOUGHT:
--------------------------------------------------------------------------------
In light of the substantiated facts and documentary evidence presented, it is most respectfully prayed that this Hon'ble Authority may be pleased to:
${reliefSought.map((relief, idx) => `  (${String.fromCharCode(97 + idx)}) ${relief}`).join('\n')}

6. LIST OF ENCLOSURES / ANNEXURES:
--------------------------------------------------------------------------------
${input.evidenceList.map((item, idx) => `  [Annexure ${idx + 1}] ${item}`).join('\n')}

VERIFICATION:
I, ${input.victimName}, do hereby solemnly verify and declare that the facts stated above are true and correct to the best of my knowledge, belief, and digital records, and nothing material has been concealed therein.

Yours faithfully,


___________________________________
(Signature of Complainant)
Name: ${input.victimName}
Phone: ${input.victimPhone}
    `.trim();

    return {
      formattedText,
      subjectLine,
      applicableSections,
      reliefSought,
      annexures: input.evidenceList,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Bridges a fraud incident directly into an active CyberSaathi Investigation room.
   */
  public async bridgeToInvestigation(
    accessToken: string,
    userId: string,
    input: {
      vectorId: string;
      lossAmountInr?: number | undefined;
      complaintText: string;
      transactionIdUtr?: string | undefined;
      evidenceCount: number;
    },
  ) {
    const vector = FRAUD_VECTORS[input.vectorId];
    const vectorTitle = vector ? vector.title : 'Cyber Fraud Incident';
    const title = `Fraud Case: ${vectorTitle}`;
    const description = `Incident reported under ${vectorTitle}. Loss: ₹${input.lossAmountInr?.toLocaleString('en-IN') ?? '0'}. UTR: ${input.transactionIdUtr ?? 'N/A'}. Ready for evidence preservation and law enforcement follow-up.`;

    const investigation = await createInvestigation(accessToken, userId, {
      title,
      description,
    });

    // Append initial structured note with the drafted legal complaint and evidence checklist
    await addInvestigationNote(
      accessToken,
      userId,
      investigation.id,
      `--- RECOVERY ACTION PLAN & COMPLAINT RECORD ---\n\n${input.complaintText}\n\nEvidence items identified: ${input.evidenceCount}.`,
    );

    return investigation;
  }
}

export const fraudRecoveryService = new FraudRecoveryService();
