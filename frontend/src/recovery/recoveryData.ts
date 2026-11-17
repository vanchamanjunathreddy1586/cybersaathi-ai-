export interface GoldenHourStep {
  id: string;
  order: number;
  action: string;
  detail: string;
  isImmediate: boolean;
  authority: string;
  tip?: string;
}

export interface LegalSection {
  code: string;
  act: string;
  title: string;
  description: string;
  penalty: string;
  equivalentSections?: string;
}

export interface OfficialPortal {
  name: string;
  url: string;
  purpose: string;
  contact?: string;
}

export interface FraudVector {
  id: string;
  title: string;
  category: string;
  urgencyLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  shortDescription: string;
  commonScenarios: string[];
  goldenHourMinutes: number;
  goldenHourChecklist: GoldenHourStep[];
  evidenceToCollect: string[];
  legalSections: LegalSection[];
  officialPortals: OfficialPortal[];
  recoveryTips: string[];
}

export interface BankEmergencyContact {
  bankName: string;
  tollFree: string;
  alternateNumber?: string;
  smsBlockCommand?: string;
  smsBlockNumber?: string;
  portalUrl?: string;
}

export const EMERGENCY_HELPLINES = [
  {
    name: 'National Cyber Crime Reporting Helpline',
    number: '1930',
    timing: '24x7 Toll-Free',
    scope: 'Financial Cyber Fraud fund freezing across banks via I4C Citizen Financial Cyber Fraud Reporting System (CFCFRMS).',
    portal: 'https://cybercrime.gov.in',
  },
  {
    name: 'National Consumer Helpline (NCH)',
    number: '1915',
    timing: '24x7',
    scope: 'E-commerce disputes, counterfeit goods, unfair trade practices, and refund failures.',
    portal: 'https://consumerhelpline.gov.in',
  },
  {
    name: 'RBI Banking Ombudsman Helpline',
    number: '14448',
    timing: '9:30 AM - 5:15 PM (Working Days)',
    scope: 'Banking disputes, unauthorized electronic fund transfers, and unresolved bank grievances under CMS.',
    portal: 'https://cms.rbi.org.in',
  },
  {
    name: 'National Emergency Response Support System (ERSS)',
    number: '112',
    timing: '24x7 Emergency',
    scope: 'Immediate police intervention, local law enforcement coordination, and distress response.',
    portal: 'https://112.gov.in',
  },
  {
    name: 'Chakshu (DoT Suspected Fraud Communication)',
    number: 'sancharsaathi.gov.in',
    timing: 'Online Portal',
    scope: 'Report fraudulent WhatsApp/SMS senders, international spoofed calls, and disconnected telecom connections.',
    portal: 'https://sancharsaathi.gov.in/sfc/',
  },
  {
    name: 'StopNCII.org (Non-Consensual Intimate Image Hash Vault)',
    number: 'stopncii.org',
    timing: '24x7 Self-Service',
    scope: 'Generate on-device privacy-preserving cryptographic hashes to prevent intimate images from being uploaded or shared across tech platforms.',
    portal: 'https://stopncii.org',
  },
];

export const BANK_EMERGENCY_CONTACTS: BankEmergencyContact[] = [
  {
    bankName: 'State Bank of India (SBI)',
    tollFree: '1800 1234 / 1800 2100 / 1800 11 1109',
    alternateNumber: '080-26599990',
    smsBlockCommand: 'BLOCK <Last 4 digits of Card>',
    smsBlockNumber: '567676',
    portalUrl: 'https://bank.sbi',
  },
  {
    bankName: 'HDFC Bank',
    tollFree: '1800 1600 / 1800 2600',
    alternateNumber: '022-68461208',
    smsBlockCommand: 'BLOCK <Card Number> or call 1800 2586 161',
    portalUrl: 'https://www.hdfcbank.com',
  },
  {
    bankName: 'ICICI Bank',
    tollFree: '1800 1080 / 1800 200 3344',
    alternateNumber: '022-33667777',
    smsBlockCommand: 'IBLOCK <Last 4 digits of Account>',
    smsBlockNumber: '5676766 / 9215676766',
    portalUrl: 'https://www.icicibank.com',
  },
  {
    bankName: 'Axis Bank',
    tollFree: '1860 419 5555 / 1860 500 5555',
    alternateNumber: '022-67987700',
    smsBlockCommand: 'BLOCK <Last 4 digits of Debit Card>',
    smsBlockNumber: '56161600',
    portalUrl: 'https://www.axisbank.com',
  },
  {
    bankName: 'Punjab National Bank (PNB)',
    tollFree: '1800 1800 / 1800 2021',
    alternateNumber: '0120-2490000',
    smsBlockCommand: 'HOT <Debit Card Number>',
    smsBlockNumber: '5607040',
    portalUrl: 'https://www.pnbindia.in',
  },
  {
    bankName: 'Bank of Baroda (BoB)',
    tollFree: '1800 5700 / 1800 5000',
    alternateNumber: '022-66985000',
    smsBlockCommand: 'BLOCK <Last 4 digits of Card>',
    smsBlockNumber: '8422009988',
    portalUrl: 'https://www.bankofbaroda.in',
  },
  {
    bankName: 'Canara Bank',
    tollFree: '1800 425 0018 / 1800 103 0018',
    alternateNumber: '080-25584040',
    smsBlockCommand: 'CAN <HOTLIST> <Card Number>',
    smsBlockNumber: '9266623333',
    portalUrl: 'https://canarabank.com',
  },
  {
    bankName: 'Kotak Mahindra Bank',
    tollFree: '1860 266 2666',
    alternateNumber: '022-66006022',
    portalUrl: 'https://www.kotak.com',
  },
  {
    bankName: 'IndusInd Bank',
    tollFree: '1860 267 7777 / 1800 209 0061',
    portalUrl: 'https://www.indusind.com',
  },
  {
    bankName: 'Union Bank of India',
    tollFree: '1800 22 22 44 / 1800 208 2244',
    smsBlockCommand: 'UBLOCK <Account Number>',
    smsBlockNumber: '09223008486',
    portalUrl: 'https://www.unionbankofindia.co.in',
  },
  {
    bankName: 'Federal Bank',
    tollFree: '1800 420 1199 / 1800 425 1199',
    portalUrl: 'https://www.federalbank.co.in',
  },
];

export const FRAUD_VECTORS: Record<string, FraudVector> = {
  'upi-fraud': {
    id: 'upi-fraud',
    title: 'UPI & QR Code Payment Fraud',
    category: 'Financial Cybercrime',
    urgencyLevel: 'CRITICAL',
    shortDescription:
      'Unauthorized UPI debit, fake QR payment received illusion, fraudulent collect requests, or merchant impersonation on PhonePe, Google Pay, Paytm, or BHIM.',
    commonScenarios: [
      'Scammer sent a QR code claiming "Scan this QR to receive cashback or payment" (Scanning a QR code ALWAYS debits money, never credits).',
      'Approve a UPI "Collect Request" disguise where user thought they were receiving prize money or second-hand OLX buyer payment.',
      'Fake customer care number found on Google Search or Google Maps claiming to refund failed UPI transaction.',
      'Remote access screen-sharing app (AnyDesk, RustDesk, TeamViewer) installed under pretext of UPI KYC update.',
    ],
    goldenHourMinutes: 120,
    goldenHourChecklist: [
      {
        id: 'upi-step-1',
        order: 1,
        action: 'Dial 1930 Immediately',
        detail:
          'Call National Cyber Crime Reporting Helpline 1930. Provide the 12-digit UPI UTR number, debited bank name, beneficiary VPA/account, and debit timestamp. This triggers CFCFRMS to send an automated freeze lien to the recipient bank before cash is withdrawn at an ATM.',
        isImmediate: true,
        authority: 'Ministry of Home Affairs / I4C CFCFRMS',
        tip: 'Keep your bank statement or SMS showing the 12-digit UTR ready before dialing.',
      },
      {
        id: 'upi-step-2',
        order: 2,
        action: 'Notify Bank 24x7 Fraud Desk & Block UPI ID',
        detail:
          'Call your bank\'s emergency fraud helpline. Request an immediate block on your UPI profile, disable mobile banking, and raise an unauthorized electronic transaction dispute under RBI Zero Liability rules.',
        isImmediate: true,
        authority: 'Issuing Bank Fraud Cell',
      },
      {
        id: 'upi-step-3',
        order: 3,
        action: 'Report Dispute in UPI App & NPCI Portal',
        detail:
          'Open your UPI application (Google Pay / PhonePe / Paytm / BHIM) -> Go to Transaction History -> Select Fraudulent Transaction -> Tap "Report a Problem / Raise Dispute". Also log a complaint on the official NPCI portal at npci.org.in/what-we-do/upi/dispute-redressal-mechanism.',
        isImmediate: true,
        authority: 'NPCI & App Provider',
      },
      {
        id: 'upi-step-4',
        order: 4,
        action: 'Register Complaint on cybercrime.gov.in',
        detail:
          'Visit https://cybercrime.gov.in, select "Report Financial Cyber Fraud", and register an official complaint. Note down the Citizen Complaint Acknowledgment Number for police & banking follow-ups.',
        isImmediate: false,
        authority: 'National Cyber Crime Reporting Portal',
      },
      {
        id: 'upi-step-5',
        order: 5,
        action: 'Preserve Complete Digital Evidence',
        detail:
          'Take full screenshots of the transaction page showing 12-digit UTR/Ref No, Beneficiary VPA (e.g. name@okhdfcbank), sender UPI ID, WhatsApp/call logs, and SMS receipts. Do not delete any messages or chat threads.',
        isImmediate: false,
        authority: 'Investigation Evidence Vault',
      },
    ],
    evidenceToCollect: [
      '12-digit UPI Reference Number / UTR (Transaction ID from bank SMS or app)',
      'Beneficiary Virtual Payment Address (VPA) and recipient display name',
      'Exact timestamp and amount debited in Indian Rupees (INR)',
      'Screenshot of the UPI app transaction receipt showing payment breakdown',
      'Bank account statement showing debited entry with date and time',
      'Chat screenshots / Call logs / SMS history with the fraudster',
      'QR code image if fraud originated from scanning a QR code',
    ],
    legalSections: [
      {
        code: 'Section 66D',
        act: 'Information Technology Act, 2000',
        title: 'Punishment for cheating by personation by using computer resource',
        description:
          'Whoever, by means of any communication device or computer resource, cheats by personation, is liable to face criminal prosecution.',
        penalty: 'Imprisonment up to 3 years and fine up to ₹1,00,000.',
        equivalentSections: 'Section 319(2) Bharatiya Nyaya Sanhita, 2023 / Section 419 Indian Penal Code',
      },
      {
        code: 'Section 318(4)',
        act: 'Bharatiya Nyaya Sanhita (BNS), 2023',
        title: 'Cheating and dishonestly inducing delivery of property',
        description:
          'Fraudulent deception inducing the victim to transfer money or consent to retain property.',
        penalty: 'Imprisonment up to 7 years and mandatory fine.',
        equivalentSections: 'Section 420 Indian Penal Code (IPC)',
      },
      {
        code: 'Section 43 read with Section 66',
        act: 'Information Technology Act, 2000',
        title: 'Penalty and compensation for damage to computer systems & hacking',
        description:
          'Unauthorized access, extraction of data, or alteration of digital payment systems.',
        penalty: 'Imprisonment up to 3 years or fine up to ₹5,00,000, or both.',
      },
    ],
    officialPortals: [
      {
        name: 'National Cybercrime Reporting Portal (NCRP)',
        url: 'https://cybercrime.gov.in',
        purpose: 'Official Ministry of Home Affairs portal for financial fraud reporting.',
        contact: 'Helpline: 1930',
      },
      {
        name: 'NPCI UPI Dispute Redressal Mechanism',
        url: 'https://www.npci.org.in/what-we-do/upi/dispute-redressal-mechanism',
        purpose: 'Direct dispute filing with National Payments Corporation of India.',
      },
      {
        name: 'RBI Complaint Management System (CMS)',
        url: 'https://cms.rbi.org.in',
        purpose: 'Escalate to Banking Ombudsman if bank does not resolve dispute within 30 days.',
        contact: 'Helpline: 14448',
      },
    ],
    recoveryTips: [
      'Remember: You NEVER need to enter your UPI PIN or scan a QR code to receive money.',
      'RBI Circular DBR.No.Leg.BC.78/09.07.005/2017-18 provides Zero Liability for customers if unauthorized electronic fraud is reported to the bank within 3 working days.',
      'When speaking with 1930, ask them for the "Complaint ID" and the "Recipient Bank Lien Status".',
    ],
  },

  'net-banking': {
    id: 'net-banking',
    title: 'Net Banking & Unauthorized Wire Transfer',
    category: 'Financial Cybercrime',
    urgencyLevel: 'CRITICAL',
    shortDescription:
      'Unauthorized IMPS, NEFT, RTGS, or third-party transfer from bank savings/current account via compromised credentials, phishing login, or remote access Trojan.',
    commonScenarios: [
      'Fake bank login website mimicking SBI, HDFC, ICICI, etc. entered through a sponsored search result.',
      'Remote access screen sharing software (AnyDesk, TeamViewer) installed after a caller impersonated bank security.',
      'SIM swap attack where victim’s mobile network goes dead and fraudster intercepts SMS OTPs.',
      'Malicious APK downloaded on Android phone that steals Net Banking username, password, and forward SMS OTPs.',
    ],
    goldenHourMinutes: 120,
    goldenHourChecklist: [
      {
        id: 'nb-step-1',
        order: 1,
        action: 'Emergency Call to Bank Fraud Cell — Total Debit Freeze',
        detail:
          'Immediately contact your bank’s 24x7 emergency helpline. Instruct the representative to place an immediate "Debit Freeze" on all linked savings/current accounts and completely suspend Net Banking and Mobile Banking access.',
        isImmediate: true,
        authority: 'Bank Emergency Hotline',
        tip: 'Ask the executive for an Incident Ticket / Service Request number before ending the call.',
      },
      {
        id: 'nb-step-2',
        order: 2,
        action: 'Dial 1930 with Transfer UTR & Beneficiary Account Details',
        detail:
          'Call 1930 to trigger a national inter-bank freeze. State the debited account number, amount, transaction timestamp, transfer mode (IMPS/NEFT/RTGS), and destination beneficiary bank name and account number.',
        isImmediate: true,
        authority: 'National Cyber Fraud Helpline 1930',
      },
      {
        id: 'nb-step-3',
        order: 3,
        action: 'File Formal Dispute with Bank Branch in Writing',
        detail:
          'Submit a signed written representation to your home branch manager within 24 hours citing RBI Circular DBR.No.Leg.BC.78/09.07.005/2017-18 for zero customer liability. Obtain an official dated acknowledgment stamp on a photocopy.',
        isImmediate: true,
        authority: 'Home Branch Manager',
      },
      {
        id: 'nb-step-4',
        order: 4,
        action: 'Isolate & Scan Infected Devices',
        detail:
          'If you installed any APK or remote software, disconnect Wi-Fi and mobile data immediately, remove all unknown device management profiles, and factory reset the smartphone or format PC before entering any credentials.',
        isImmediate: false,
        authority: 'Device Security',
      },
      {
        id: 'nb-step-5',
        order: 5,
        action: 'Lodge NCRP Complaint at cybercrime.gov.in',
        detail:
          'Submit an online complaint on cybercrime.gov.in attaching bank statement PDF, transaction SMS, and incident description.',
        isImmediate: false,
        authority: 'National Cyber Crime Reporting Portal',
      },
    ],
    evidenceToCollect: [
      'Official bank statement PDF highlighting the unauthorized debit transactions',
      '16-digit or 22-digit UTR/RRN numbers for all IMPS/NEFT/RTGS transfers',
      'Beneficiary account number, beneficiary name, and IFSC code if visible',
      'SMS alerts received from the bank regarding payee addition and OTPs',
      'Browser history URL of any phishing login page visited',
      'Device details and app installation logs if remote access was involved',
    ],
    legalSections: [
      {
        code: 'Section 43 & Section 66',
        act: 'Information Technology Act, 2000',
        title: 'Penalty for damage to computer system and computer related offences',
        description: 'Unauthorized access, extraction of credentials, or altering banking sessions.',
        penalty: 'Imprisonment up to 3 years or fine up to ₹5,00,000, or both.',
      },
      {
        code: 'Section 66C',
        act: 'Information Technology Act, 2000',
        title: 'Punishment for identity theft',
        description: 'Fraudulent use of electronic signature, password, or unique identification feature.',
        penalty: 'Imprisonment up to 3 years and fine up to ₹1,00,000.',
      },
      {
        code: 'Section 316(2) & 318(4)',
        act: 'Bharatiya Nyaya Sanhita (BNS), 2023',
        title: 'Criminal breach of trust and Cheating',
        description: 'Dishonest misappropriation of funds entrusted through electronic banking.',
        penalty: 'Imprisonment up to 7 years and fine.',
        equivalentSections: 'Section 406 & 420 Indian Penal Code (IPC)',
      },
    ],
    officialPortals: [
      {
        name: 'National Cybercrime Reporting Portal',
        url: 'https://cybercrime.gov.in',
        purpose: 'File formal financial cybercrime complaint.',
      },
      {
        name: 'RBI Complaint Management System (CMS)',
        url: 'https://cms.rbi.org.in',
        purpose: 'Direct complaint to RBI Ombudsman under Reserve Bank - Integrated Ombudsman Scheme, 2021.',
        contact: 'Toll-Free: 14448',
      },
    ],
    recoveryTips: [
      'Under RBI rules, if the fraud occurred due to third-party breach where neither the customer nor the bank is at fault, customer liability is ZERO if reported within 3 working days.',
      'Always obtain an acknowledgment receipt with an official round stamp and date from your bank branch.',
      'Check if any unauthorized standing instructions or auto-debit mandates were set up in your Net Banking profile.',
    ],
  },

  'card-fraud': {
    id: 'card-fraud',
    title: 'Credit & Debit Card Unauthorized Transactions',
    category: 'Financial Cybercrime',
    urgencyLevel: 'CRITICAL',
    shortDescription:
      'Unauthorized domestic or international Card-Not-Present (CNP) transactions, cloned card ATM withdrawals, or fraudulent e-commerce charges.',
    commonScenarios: [
      'International transaction charged without OTP (international websites do not require RBI two-factor SMS OTP).',
      'Card skimmed or cloned at a compromised ATM or restaurant POS terminal.',
      'Card details stolen from a data breach of an online merchant or delivery app.',
      'Subscription trap where a "free trial" charged a recurring heavy amount without consent.',
    ],
    goldenHourMinutes: 120,
    goldenHourChecklist: [
      {
        id: 'card-step-1',
        order: 1,
        action: 'Instantly Hotlist & Block Card via Mobile App or SMS',
        detail:
          'Open your bank mobile app -> Cards -> Card Controls -> Toggle OFF "International Transactions", "Online Transactions", and "ATM Withdrawals", then tap "Block / Hotlist Card Permanently". Or send the bank emergency SMS block command.',
        isImmediate: true,
        authority: 'Card Issuing Bank App',
      },
      {
        id: 'card-step-2',
        order: 2,
        action: 'File Chargeback / Dispute with Issuing Bank',
        detail:
          'Call bank customer care immediately to raise a formal Chargeback Request under Visa / Mastercard / RuPay dispute rules. State clearly whether OTP was received or bypassed (e.g. international transaction).',
        isImmediate: true,
        authority: 'Bank Chargeback Department',
        tip: 'Insist on a Chargeback Reference Number. Banks have 30 to 45 days under payment network rules to reverse unauthorized international charges.',
      },
      {
        id: 'card-step-3',
        order: 3,
        action: 'Submit Cardholder Dispute Form (CDF)',
        detail:
          'Download and complete your bank’s Cardholder Dispute Form (CDF). Sign it and email it to the bank’s chargeback desk along with a copy of your bank statement and transaction alert SMS.',
        isImmediate: false,
        authority: 'Card Operations Department',
      },
      {
        id: 'card-step-4',
        order: 4,
        action: 'Report to cybercrime.gov.in',
        detail:
          'Lodge a complaint under "Financial Fraud -> Credit/Debit Card Fraud" on cybercrime.gov.in.',
        isImmediate: false,
        authority: 'National Cyber Crime Reporting Portal',
      },
    ],
    evidenceToCollect: [
      'Transaction alert SMS and email notification from the card issuer',
      'Last 4 digits of the card (NEVER disclose or write full 16 digits, CVV, or expiry date)',
      'Merchant name and location shown on the transaction statement (e.g., "AMZN Mktp UK", "FACEBK ADS")',
      'Completed and signed Cardholder Dispute Form (CDF)',
      'Proof of physical card possession at the time of unauthorized transaction (e.g. passport copy showing you were in India if international fraud occurred)',
    ],
    legalSections: [
      {
        code: 'Section 66C & 66D',
        act: 'Information Technology Act, 2000',
        title: 'Identity theft and cheating by personation',
        description: 'Compromise of card credentials, electronic tokens, or CVV to fraudulently extract funds.',
        penalty: 'Imprisonment up to 3 years and fine up to ₹1,00,000.',
      },
      {
        code: 'Section 318(4)',
        act: 'Bharatiya Nyaya Sanhita, 2023',
        title: 'Cheating and dishonestly inducing delivery of property',
        description: 'Unauthorized charge and misappropriation of credit facility.',
        penalty: 'Imprisonment up to 7 years and fine.',
        equivalentSections: 'Section 420 Indian Penal Code (IPC)',
      },
    ],
    officialPortals: [
      {
        name: 'National Cybercrime Reporting Portal',
        url: 'https://cybercrime.gov.in',
        purpose: 'Official online police complaint for card fraud.',
      },
      {
        name: 'RBI Complaint Management System',
        url: 'https://cms.rbi.org.in',
        purpose: 'Bank escalation if card dispute is denied unfairly.',
      },
    ],
    recoveryTips: [
      'Under RBI Master Direction on Credit Card and Debit Card Issuance (2022), customers are entitled to zero liability for unauthorized transactions reported within 3 days.',
      'Always keep International Transactions DISABLED in your card settings until the exact moment you travel abroad or make an intentional foreign payment.',
      'Never send photos of your card front and back over WhatsApp or email.',
    ],
  },

  'investment-scams': {
    id: 'investment-scams',
    title: 'Investment, Forex & "Pig Butchering" Scams',
    category: 'Financial Cybercrime & Organized Fraud',
    urgencyLevel: 'CRITICAL',
    shortDescription:
      'Fraudulent stock trading apps, high-return cryptocurrency schemes, fake institutional IPO allocations, and "pig butchering" (Sha Zhu Pan) romance/friendship investment traps.',
    commonScenarios: [
      'Added to WhatsApp or Telegram group claiming to be "Institutional Investors / Foreign Fund Managers" with daily stock tips.',
      'Downloaded an APK or accessed a web portal showing fake trading profits of 300%-800%.',
      'When attempting to withdraw funds, "customer support" demanded 20%-35% upfront payment for "capital gains tax", "clearance fees", or "VIP audit fee".',
      'Romance or friendship initiated on dating apps or LinkedIn leading to recommendations to invest on a customized crypto platform.',
    ],
    goldenHourMinutes: 240,
    goldenHourChecklist: [
      {
        id: 'inv-step-1',
        order: 1,
        action: 'STOP SENDING ANY MORE MONEY (Do Not Pay "Clearance Fees")',
        detail:
          'CRITICAL: Under NO circumstances send any additional money for "taxes", "AML clearance", "account unfreezing", or "VIP tier upgrades". This is an escalation trap designed to extract maximum funds before the scammer shuts down communication.',
        isImmediate: true,
        authority: 'Victim Protection Notice',
      },
      {
        id: 'inv-step-2',
        order: 2,
        action: 'Compile Detailed Transaction Ledger (Mule Accounts & VPAs)',
        detail:
          'Create a chronological spreadsheet of every single deposit made: Date, Time, Amount, Destination Bank Name, Beneficiary Account Number, IFSC Code, or UPI VPA. Investment scammers rotate through dozens of mule accounts across India.',
        isImmediate: true,
        authority: 'Financial Forensics Preparation',
      },
      {
        id: 'inv-step-3',
        order: 3,
        action: 'Dial 1930 & Lodge Incident with Full Mule Account Details',
        detail:
          'Call 1930 and provide all recipient bank accounts and UTR numbers. The Indian Cyber Crime Coordination Centre (I4C) uses this data to freeze downstream mule chains and inter-bank wallets.',
        isImmediate: true,
        authority: 'I4C Cyber Fraud Helpline 1930',
      },
      {
        id: 'inv-step-4',
        order: 4,
        action: 'Export Telegram / WhatsApp Chats & Preserve Group Media',
        detail:
          'Export complete WhatsApp/Telegram chat history with media. Note all admin phone numbers, group member numbers, screenshots of fake profit dashboards, and website domain URLs.',
        isImmediate: true,
        authority: 'Evidence Preservation',
      },
      {
        id: 'inv-step-5',
        order: 5,
        action: 'File Complaints on cybercrime.gov.in & SEBI SCORES Portal',
        detail:
          'Register on cybercrime.gov.in under "Financial Fraud -> Investment Fraud". If the scammers impersonated SEBI registered entities or stock brokers, also file a report on SEBI SCORES at scores.sebi.gov.in.',
        isImmediate: false,
        authority: 'SEBI & Cyber Police',
      },
    ],
    evidenceToCollect: [
      'Complete ledger of all bank debits with 12-digit UTRs and recipient account/IFSC details',
      'Screenshots of fake trading app dashboard, account balance, and deposit instructions',
      'Telegram/WhatsApp chat logs, voice notes, and phone numbers of scam group admins',
      'Website URLs and domain WHOIS details of the fraudulent trading platform',
      'Screenshots of demand letters/messages demanding withdrawal taxes or fees',
    ],
    legalSections: [
      {
        code: 'Section 318(4) & Section 316(2)',
        act: 'Bharatiya Nyaya Sanhita, 2023',
        title: 'Cheating and Criminal Breach of Trust',
        description: 'Inducing victims to part with substantial funds under false promise of investment returns.',
        penalty: 'Imprisonment up to 7 years and fine.',
        equivalentSections: 'Section 420 & 406 Indian Penal Code (IPC)',
      },
      {
        code: 'Banning of Unregulated Deposit Schemes Act (BUDS Act), 2019',
        act: 'BUDS Act, 2019',
        title: 'Prohibition of Unregulated Deposit Schemes',
        description: 'Running illicit pooled deposit schemes without statutory regulator approvals.',
        penalty: 'Imprisonment from 2 to 10 years and fine up to ₹50 Crore.',
      },
      {
        code: 'Section 12A & 24',
        act: 'Securities and Exchange Board of India (SEBI) Act, 1992',
        title: 'Prohibition of manipulative and deceptive devices & fraudulent stock advisory',
        description: 'Offering unauthorized stock tips and fraudulent securities investments.',
        penalty: 'Imprisonment up to 10 years and fine up to ₹25 Crore.',
      },
      {
        code: 'Section 66D',
        act: 'Information Technology Act, 2000',
        title: 'Cheating by personation using computer resource',
        description: 'Impersonating genuine registered brokers, FIIs, or wealth management firms.',
        penalty: 'Imprisonment up to 3 years and fine up to ₹1,00,000.',
      },
    ],
    officialPortals: [
      {
        name: 'National Cybercrime Reporting Portal',
        url: 'https://cybercrime.gov.in',
        purpose: 'File formal cyber complaint for organized financial fraud.',
      },
      {
        name: 'SEBI SCORES Portal',
        url: 'https://scores.sebi.gov.in',
        purpose: 'Report unregistered investment advisors and fake securities intermediaries.',
        contact: 'SEBI Toll-Free: 1800 22 7575 / 1800 266 7575',
      },
      {
        name: 'Chakshu Portal (Department of Telecommunications)',
        url: 'https://sancharsaathi.gov.in/sfc/',
        purpose: 'Report WhatsApp numbers and calling numbers used to solicit fraudulent investments.',
      },
    ],
    recoveryTips: [
      'Legitimate SEBI-registered brokers NEVER ask you to deposit money into random individual personal savings bank accounts or UPI VPAs.',
      'Legitimate Indian stock exchanges (NSE, BSE) do NOT operate via private WhatsApp VIP groups or international crypto wallets.',
      'Beware of secondary "Recovery Scammers" claiming: "We can hack the scammer and get your money back for a 10% fee". Only law enforcement (1930 / Police) can legally seize and freeze bank accounts.',
    ],
  },

  'job-scams': {
    id: 'job-scams',
    title: 'Work-From-Home, Part-Time & Job Offer Scams',
    category: 'Employment Fraud',
    urgencyLevel: 'HIGH',
    shortDescription:
      'Part-time "Telegram task" scams, paid video rating / Google Maps review jobs, fake airline / airport appointment letters, and registration deposit demands.',
    commonScenarios: [
      'Contacted via WhatsApp/Telegram offering ₹2,000–₹5,000/day for liking YouTube videos or writing 5-star Google Maps reviews.',
      'Paid small initial reward (₹150–₹500) to build trust, followed by "Prepaid Merchant Tasks" requiring deposits of ₹5,000, ₹25,000, ₹1,00,000.',
      'Fake interview and offer letter from reputable company (Amazon, Tata, Indigo Airlines) requiring "refundable uniform fee", "gate pass fee", or "training deposit".',
      'Data entry typing job where company threatens legal action for "breach of contract" or non-completion of unreasonable typing quotas.',
    ],
    goldenHourMinutes: 180,
    goldenHourChecklist: [
      {
        id: 'job-step-1',
        order: 1,
        action: 'Discontinue Communication & Do Not Pay Task Deficits',
        detail:
          'Immediately cut off contact with the Telegram "task mentor" or "receptionist". Never send any additional money to "complete the task order" or "unfreeze wallet balance".',
        isImmediate: true,
        authority: 'Victim Protection Notice',
      },
      {
        id: 'job-step-2',
        order: 2,
        action: 'Preserve Full Telegram / WhatsApp Export & Group Records',
        detail:
          'Telegram scammers frequently delete conversations "for both sides". Immediately take screenshots and export chat history on desktop Telegram before you are removed from the group.',
        isImmediate: true,
        authority: 'Evidence Preservation',
      },
      {
        id: 'job-step-3',
        order: 3,
        action: 'Report All Deposit Transactions to 1930 and Your Bank',
        detail:
          'Gather all transaction IDs (UTRs) for task deposits and report them to 1930 and your bank branch fraud cell.',
        isImmediate: true,
        authority: 'National Cyber Fraud Helpline 1930',
      },
      {
        id: 'job-step-4',
        order: 4,
        action: 'Lodge NCRP Complaint under "Financial Fraud -> Part-Time Job Scam"',
        detail:
          'Submit the detailed complaint on cybercrime.gov.in attaching offer letters, task screenshots, and transaction history.',
        isImmediate: false,
        authority: 'National Cyber Crime Reporting Portal',
      },
    ],
    evidenceToCollect: [
      'Initial WhatsApp/SMS message offering the job opportunity',
      'Telegram handle of the "HR manager", "tutor", or "group admin"',
      'Screenshots of task instructions, website portal, and fake task dashboard',
      'Bank statement and UTR receipts for all deposits made to merchant accounts',
      'Fake offer letter PDF, agreement, or forged corporate letterheads',
    ],
    legalSections: [
      {
        code: 'Section 66D',
        act: 'Information Technology Act, 2000',
        title: 'Cheating by personation by using computer resource',
        description: 'Impersonating legitimate corporate employers, HR personnel, or job portals.',
        penalty: 'Imprisonment up to 3 years and fine up to ₹1,00,000.',
      },
      {
        code: 'Section 318(4) & Section 319',
        act: 'Bharatiya Nyaya Sanhita, 2023',
        title: 'Cheating and Cheating by personation',
        description: 'Deceitfully inducing job seekers to make advance payments.',
        penalty: 'Imprisonment up to 7 years and fine.',
        equivalentSections: 'Section 420 & 419 Indian Penal Code (IPC)',
      },
    ],
    officialPortals: [
      {
        name: 'National Cybercrime Reporting Portal',
        url: 'https://cybercrime.gov.in',
        purpose: 'File cyber fraud complaint for fake job rackets.',
      },
      {
        name: 'Chakshu Portal',
        url: 'https://sancharsaathi.gov.in/sfc/',
        purpose: 'Report mobile numbers sending unsolicited job scam messages.',
      },
    ],
    recoveryTips: [
      'No legitimate employer or global enterprise asks job candidates to pay a "security deposit", "training fee", or "task prepayment" to work.',
      'If scammers threaten you with "legal notices" for quitting a data entry typing job, do NOT panic. These fake legal notices are hollow scare tactics; report them to the police.',
    ],
  },

  'social-media-hacked': {
    id: 'social-media-hacked',
    title: 'Social Media Account Compromise & Sextortion / Blackmail',
    category: 'Identity & Cyber Harassment',
    urgencyLevel: 'CRITICAL',
    shortDescription:
      'Instagram, Facebook, X, WhatsApp account takeover, unauthorized email/phone changes, impersonation of victim to extort friends/family, or video call sextortion blackmail.',
    commonScenarios: [
      'Account compromised after entering login details on a fake "Instagram Copyright Infringement Notice" or "Blue Verification Badge" link.',
      'Compromised account used to send emergency UPI money requests to victim’s followers and friends list.',
      'Sextortion trap: Video call on WhatsApp/Instagram where caller records screen with morphed or real intimate footage, threatening to blast it to family members unless money is paid.',
      'WhatsApp account hijacked after victim was tricked into sharing a 6-digit WhatsApp registration SMS code.',
    ],
    goldenHourMinutes: 60,
    goldenHourChecklist: [
      {
        id: 'sm-step-1',
        order: 1,
        action: 'IF SEXTORTION / BLACKMAIL: DO NOT PAY MONEY (Paying Guarantees Escalation)',
        detail:
          'DO NOT SEND MONEY. Paying does not delete the video; it flags you as a compliant victim and invites higher demands. Deactivate or lock your social media privacy settings immediately, preserve chat screenshots, and do not delete the blackmailer’s account handle.',
        isImmediate: true,
        authority: 'Critical Emergency Advisory',
      },
      {
        id: 'sm-step-2',
        order: 2,
        action: 'Submit Hashes to StopNCII.org',
        detail:
          'If intimate images or video threats are involved, visit https://stopncii.org. It generates non-reversible SHA-256 hashes directly on your browser without uploading your photos. Partner platforms (Meta, TikTok, OnlyFans, etc.) use these hashes to block the media from being uploaded.',
        isImmediate: true,
        authority: 'StopNCII Global Consortium',
      },
      {
        id: 'sm-step-3',
        order: 3,
        action: 'Initiate Official Platform Compromised Account Recovery',
        detail:
          'Use platform hacked recovery tools: For Instagram: instagram.com/hacked (request selfie video verification). For Facebook: facebook.com/hacked. For WhatsApp: Reinstall app, enter your phone number, and enter 6-digit SMS verification code to disconnect active session.',
        isImmediate: true,
        authority: 'Social Media Platforms',
      },
      {
        id: 'sm-step-4',
        order: 4,
        action: 'Warn Friends & Contacts on Alternative Channels',
        detail:
          'Post a status on WhatsApp or notify close family members from an alternate phone: "My Instagram/Facebook account has been compromised. Do not send any money or click any links sent from my profile."',
        isImmediate: true,
        authority: 'Community Alert',
      },
      {
        id: 'sm-step-5',
        order: 5,
        action: 'Report to cybercrime.gov.in under "Women/Child Related Crime" or "Cyber Harassment"',
        detail:
          'Lodge a complaint on cybercrime.gov.in. You can report anonymously if preferred for harassment or intimate image extortion.',
        isImmediate: false,
        authority: 'National Cyber Crime Reporting Portal',
      },
    ],
    evidenceToCollect: [
      'Exact URL / username handle of the compromised social media account',
      'Username / handle / phone number of the blackmailer / hacker',
      'Screenshots of blackmail messages, threats, extortion payment demands, or UPI VPAs given',
      'Email alerts received from Instagram/Meta stating: "Your email/password was changed"',
      'URL of any phishing page visited prior to account takeover',
    ],
    legalSections: [
      {
        code: 'Section 66E',
        act: 'Information Technology Act, 2000',
        title: 'Punishment for violation of privacy',
        description: 'Intentionally capturing, publishing, or transmitting images of private area without consent.',
        penalty: 'Imprisonment up to 3 years or fine up to ₹2,00,000, or both.',
      },
      {
        code: 'Section 67 & Section 67A',
        act: 'Information Technology Act, 2000',
        title: 'Punishment for publishing or transmitting obscene material / sexually explicit act',
        description: 'Transmitting obscene or sexually explicit electronic records.',
        penalty: 'Imprisonment up to 5 years (first conviction) and fine up to ₹10,00,000.',
      },
      {
        code: 'Section 308',
        act: 'Bharatiya Nyaya Sanhita, 2023',
        title: 'Extortion by threat of injury or reputation damage',
        description: 'Intentionally putting any person in fear of injury and inducing delivery of property.',
        penalty: 'Imprisonment up to 7 years and fine.',
        equivalentSections: 'Section 384 & 389 Indian Penal Code (IPC)',
      },
      {
        code: 'Section 66C',
        act: 'Information Technology Act, 2000',
        title: 'Identity theft & unauthorized account takeover',
        description: 'Fraudulent use of victim’s electronic password or credentials.',
        penalty: 'Imprisonment up to 3 years and fine up to ₹1,00,000.',
      },
    ],
    officialPortals: [
      {
        name: 'StopNCII.org',
        url: 'https://stopncii.org',
        purpose: 'Non-consensual intimate image prevention tool using client-side cryptographic hashing.',
      },
      {
        name: 'National Cybercrime Reporting Portal',
        url: 'https://cybercrime.gov.in',
        purpose: 'File cyber harassment, extortion, or account takeover complaint (Anonymous reporting available).',
        contact: 'Helpline: 1930 / Women Helpline: 1090',
      },
      {
        name: 'Instagram Hacked Recovery',
        url: 'https://www.instagram.com/hacked',
        purpose: 'Official Meta identity verification & video selfie account restoration.',
      },
      {
        name: 'Facebook Hacked Recovery',
        url: 'https://www.facebook.com/hacked',
        purpose: 'Official Facebook account security & recovery center.',
      },
    ],
    recoveryTips: [
      'Enable App-based Authenticator 2FA (Google Authenticator, Microsoft Authenticator) instead of SMS OTP.',
      'Check and revoke linked third-party apps in your account settings (Settings -> Security -> Apps and Websites).',
      'Always remember: You are the victim of a calculated crime. Do not suffer in silence; Indian cyber cells treat sextortion with urgent priority and confidentiality.',
    ],
  },

  'identity-theft': {
    id: 'identity-theft',
    title: 'Identity Theft, SIM Swap & Fraudulent Loan Apps',
    category: 'Identity Cybercrime',
    urgencyLevel: 'CRITICAL',
    shortDescription:
      'Unauthorized SIM card duplication (SIM swap), misuse of PAN and Aadhaar copies to open mule accounts or take instant NBFC loans, or synthetic identity fraud.',
    commonScenarios: [
      'Mobile signal suddenly displays "No Service" or "Emergency Calls Only" in an area with good coverage, followed by unauthorized bank debits.',
      'Received legal notices, collection agent calls, or CIBIL score drop for loans taken from instant lending apps you never applied for.',
      'Discovered multiple unauthorized mobile connections issued against your Aadhaar via DoT TAFCOP portal.',
      'Lost wallet or shared unmasked Aadhaar copy that was misused to register shell companies or GST accounts.',
    ],
    goldenHourMinutes: 60,
    goldenHourChecklist: [
      {
        id: 'id-step-1',
        order: 1,
        action: 'IF SIM SWAP: Call Telecom Operator from Another Phone IMMEDIATELY',
        detail:
          'If your SIM card suddenly deactivates without explanation, call your telecom provider immediately (Airtel: 121 / 198, Jio: 199 / 1800 889 9999, Vi: 199). State: "My SIM is experiencing an unauthorized SIM swap. Block the duplicate SIM immediately and freeze all outgoing and incoming SMS services."',
        isImmediate: true,
        authority: 'Mobile Telecom Operator',
      },
      {
        id: 'id-step-2',
        order: 2,
        action: 'Immediately Lock Aadhaar Biometrics on UIDAI',
        detail:
          'Open the mAadhaar app or visit https://myaadhaar.uidai.gov.in -> Lock/Unlock Biometrics. Locking your biometrics prevents anyone from using fingerprint/iris e-KYC authentication to issue new SIM cards or open bank accounts.',
        isImmediate: true,
        authority: 'UIDAI Official Portal',
      },
      {
        id: 'id-step-3',
        order: 3,
        action: 'Check Active Mobile Connections on DoT TAFCOP Portal',
        detail:
          'Visit https://tafcop.sancharsaathi.gov.in, enter your mobile number, and view all mobile connections registered under your Aadhaar/name. Mark any unknown number as "Not My Number" to initiate immediate disconnection by the Department of Telecommunications.',
        isImmediate: true,
        authority: 'DoT Sanchar Saathi',
      },
      {
        id: 'id-step-4',
        order: 4,
        action: 'Pull Full CIBIL / Experian Credit Report',
        detail:
          'Obtain your official credit report from CIBIL (cibil.com) or Experian. Review all active loans and credit inquiries. Note down any unauthorized loan accounts opened by instant loan apps.',
        isImmediate: false,
        authority: 'Credit Information Companies (CIBIL)',
      },
      {
        id: 'id-step-5',
        order: 5,
        action: 'File Formal Police FIR & Dispute with Lenders',
        detail:
          'File an FIR at your local cyber police station and on cybercrime.gov.in. Send a formal legal notice attaching the FIR to the fraudulent lending NBFCs and CIBIL to dispute and purge the fraudulent loans from your credit history.',
        isImmediate: false,
        authority: 'Cyber Police & NBFC Grievance Cell',
      },
    ],
    evidenceToCollect: [
      'Telecom customer complaint number and written confirmation of SIM swap time',
      'Screenshots of TAFCOP portal showing unauthorized mobile numbers',
      'CIBIL / Experian / CRIF High Mark credit report PDF highlighting fake loan entries',
      'Copies of any fraudulent loan agreements, sanction letters, or collection WhatsApp threats',
      'Original proof of identity showing you are the genuine document holder',
    ],
    legalSections: [
      {
        code: 'Section 66C',
        act: 'Information Technology Act, 2000',
        title: 'Punishment for identity theft',
        description: 'Dishonest use of electronic signature, password, or biometric feature of any other person.',
        penalty: 'Imprisonment up to 3 years and fine up to ₹1,00,000.',
      },
      {
        code: 'Section 336 & Section 340',
        act: 'Bharatiya Nyaya Sanhita, 2023',
        title: 'Forgery and Forged document used as genuine',
        description: 'Fabricating false electronic documents, Aadhaar cards, or loan signatures.',
        penalty: 'Imprisonment up to 7 years and fine.',
        equivalentSections: 'Section 468 & 471 Indian Penal Code (IPC)',
      },
      {
        code: 'Section 38 & Section 40',
        act: 'Aadhaar (Targeted Delivery of Financial and Other Subsidies) Act, 2016',
        title: 'Penalty for unauthorized access to Central Identities Data Repository & impersonation',
        description: 'Impersonating another individual during Aadhaar authentication or e-KYC.',
        penalty: 'Imprisonment up to 3 years and fine up to ₹10,000.',
      },
    ],
    officialPortals: [
      {
        name: 'DoT TAFCOP Portal (Sanchar Saathi)',
        url: 'https://tafcop.sancharsaathi.gov.in',
        purpose: 'Verify and disconnect unauthorized SIM cards issued in your name.',
      },
      {
        name: 'UIDAI Aadhaar Lock / Unlock',
        url: 'https://myaadhaar.uidai.gov.in',
        purpose: 'Lock biometric and Aadhaar authentication permanently.',
      },
      {
        name: 'RBI Complaint Management System',
        url: 'https://cms.rbi.org.in',
        purpose: 'File complaint against predatory loan apps and unregulated digital lenders.',
      },
    ],
    recoveryTips: [
      'Always share "Masked Aadhaar" (which hides the first 8 digits) for routine identity checks. Download Masked Aadhaar from eaadhaar.uidai.gov.in.',
      'Regularly review your free annual credit report from CIBIL and Experian.',
      'If harassed by unauthorized recovery agents from illegal Chinese loan apps, lodge a direct complaint under cybercrime.gov.in and ERSS 112.',
    ],
  },

  'phishing-apk': {
    id: 'phishing-apk',
    title: 'Phishing, Malicious APKs & Social Engineering Smishing',
    category: 'Device & Malware Threat',
    urgencyLevel: 'CRITICAL',
    shortDescription:
      'Malicious APK downloaded from SMS links (Electricity Bill, Bank KYC, India Post parcel customs, Traffic e-challan), credential harvesting, or SMS-forwarding spyware.',
    commonScenarios: [
      'Received urgent SMS: "Dear consumer, your electricity power will be disconnected tonight at 9:30 PM due to unpaid bill. Call officer immediately or download app to update".',
      'Downloaded an `.apk` file (e.g. `SBI_Rewards.apk`, `Electricity_Update.apk`, `PM_Kisan_Yojana.apk`) from an SMS link or WhatsApp.',
      'Granted Accessibility permissions or SMS permissions to an app, which began auto-reading banking OTPs and forwarding them.',
      'Fake India Post or courier message asking to pay ₹5 or ₹10 customs clearance duty through a fake payment gateway.',
    ],
    goldenHourMinutes: 60,
    goldenHourChecklist: [
      {
        id: 'apk-step-1',
        order: 1,
        action: 'Turn On Airplane Mode & Disconnect Wi-Fi IMMEDIATELY',
        detail:
          'Sever the device’s internet connection immediately by toggling Airplane Mode ON and turning Wi-Fi and Bluetooth OFF. This cuts off the remote Command & Control (C2) server from exfiltrating your SMS OTPs or taking remote commands.',
        isImmediate: true,
        authority: 'Critical Device Containment',
      },
      {
        id: 'apk-step-2',
        order: 2,
        action: 'Boot Android into Safe Mode & Uninstall the Malicious APK',
        detail:
          'Long press the Power button -> Touch and hold "Power Off" until "Reboot to safe mode" appears -> Tap OK. In Safe Mode, third-party malware cannot run. Go to Settings -> Apps -> App Management -> Look for recently installed app without an icon or named "Settings", "Update", "Security" -> Tap Uninstall.',
        isImmediate: true,
        authority: 'Device Remediation',
      },
      {
        id: 'apk-step-3',
        order: 3,
        action: 'Check & Cancel Call/SMS Forwarding MMI Codes',
        detail:
          'Open your Phone dialer and dial `*#21#` and `*#62#` to check if calls or SMS are being forwarded to a fraudster number. If forwarding is active, dial `##002#` or `##21#` to cancel all unconditional call and SMS forwarding.',
        isImmediate: true,
        authority: 'Telecom Security',
        tip: 'Dialing ##002# is the universal telecom command to disable all call/SMS forwarding in India.',
      },
      {
        id: 'apk-step-4',
        order: 4,
        action: 'Change All Banking & Email Passwords from a SEPARATE Device',
        detail:
          'DO NOT change passwords from the infected phone. Use a clean computer or family member’s phone to immediately change your Net Banking passwords, email passwords, and UPI PINs.',
        isImmediate: true,
        authority: 'Credential Defense',
      },
      {
        id: 'apk-step-5',
        order: 5,
        action: 'Report Sender Header & Malicious Link to Chakshu & 1930',
        detail:
          'Report the SMS sender header (e.g., `VM-ELCBRD`, `BP-SBIINB`) on the Department of Telecommunications Chakshu portal at sancharsaathi.gov.in/sfc/ to have the sender ID blacklisted nationwide.',
        isImmediate: false,
        authority: 'DoT Sanchar Saathi',
      },
    ],
    evidenceToCollect: [
      'Original SMS text and exact sender header/alphanumeric tag (e.g. `AX-INDPOST`)',
      'Malicious link URL received in the SMS (do NOT click it again)',
      'APK file package name if noted from device settings',
      'Details of any unauthorized banking transactions triggered while the APK was installed',
    ],
    legalSections: [
      {
        code: 'Section 43 & Section 66',
        act: 'Information Technology Act, 2000',
        title: 'Hacking, introduction of computer contaminant, and unauthorized extraction',
        description: 'Introducing malware, trojans, or spyware into any computer or mobile device.',
        penalty: 'Imprisonment up to 3 years and compensation/fine up to ₹5,00,000.',
      },
      {
        code: 'Section 66D',
        act: 'Information Technology Act, 2000',
        title: 'Cheating by personation by using computer resource',
        description: 'Impersonating government electricity boards, India Post, or banks.',
        penalty: 'Imprisonment up to 3 years and fine up to ₹1,00,000.',
      },
      {
        code: 'Section 318(4)',
        act: 'Bharatiya Nyaya Sanhita, 2023',
        title: 'Cheating and dishonestly inducing delivery of property',
        description: 'Inducing victim to transfer funds via fraudulent payment interfaces.',
        penalty: 'Imprisonment up to 7 years and fine.',
      },
    ],
    officialPortals: [
      {
        name: 'Chakshu Portal (DoT)',
        url: 'https://sancharsaathi.gov.in/sfc/',
        purpose: 'Direct citizen reporting of fraudulent SMS and spoofed calls.',
      },
      {
        name: 'National Cybercrime Reporting Portal',
        url: 'https://cybercrime.gov.in',
        purpose: 'Lodge formal cybercrime report.',
      },
    ],
    recoveryTips: [
      'Electricity boards in India NEVER send SMS from random 10-digit mobile numbers threatening disconnection within 2 hours.',
      'Never download APK files sent via WhatsApp or external browser links. Only install applications from Google Play Store or Apple App Store.',
      'Always disable "Install unknown apps" permission in Android settings.',
    ],
  },

  'ecommerce-fraud': {
    id: 'ecommerce-fraud',
    title: 'E-commerce Scams, Fake Shopping Sites & Return Frauds',
    category: 'Consumer & Commercial Cybercrime',
    urgencyLevel: 'HIGH',
    shortDescription:
      'Fake online retail stores advertised on Instagram/Facebook with unrealistic discounts, non-delivery of prepaid orders, counterfeit items, or fake courier customer care refund scams.',
    commonScenarios: [
      'Purchased products from a sponsored social media ad (e.g. ₹999 for branded sneakers or electronics) on a newly registered Shopify/WooCommerce site that vanished.',
      'Order paid via UPI/Card, but seller blocked buyer, provided fake courier tracking number, or never dispatched goods.',
      'Called a fake courier customer care number (Blue Dart, DTDC, Delhivery) found on Google to locate a parcel; agent asked to install AnyDesk or pay ₹5 via UPI.',
      'Received a counterfeit or used product, and the website has no customer service email, physical address, or grievance officer.',
    ],
    goldenHourMinutes: 720,
    goldenHourChecklist: [
      {
        id: 'ecom-step-1',
        order: 1,
        action: 'File Payment Gateway Dispute & Chargeback Request',
        detail:
          'Identify the payment aggregator listed on your bank statement (Razorpay, Cashfree, PayU, CCavenue, Paytm PG). Immediately contact the payment aggregator’s buyer protection / fraud desk with your transaction reference. Payment aggregators can freeze the fraudulent merchant’s settlement account if reported promptly.',
        isImmediate: true,
        authority: 'Payment Aggregator Fraud Desk',
        tip: 'For Razorpay: razorpay.com/support; for Cashfree: cashfree.com/contact-us.',
      },
      {
        id: 'ecom-step-2',
        order: 2,
        action: 'File Card / Net Banking Chargeback with Issuing Bank',
        detail:
          'If paid via Credit or Debit Card, file a dispute under reason code "Goods / Services Not Delivered / Counterfeit Goods". Under Visa/Mastercard rules, merchants must provide valid Proof of Delivery (POD) with recipient signature.',
        isImmediate: true,
        authority: 'Bank Chargeback Cell',
      },
      {
        id: 'ecom-step-3',
        order: 3,
        action: 'Lodge Grievance on National Consumer Helpline (NCH)',
        detail:
          'Call toll-free 1915 or file a complaint on https://consumerhelpline.gov.in under the Department of Consumer Affairs. Mention the seller domain, registered company name, and transaction proof.',
        isImmediate: false,
        authority: 'National Consumer Helpline 1915',
      },
      {
        id: 'ecom-step-4',
        order: 4,
        action: 'Report Fake Domain to Hosting Provider & Registrar',
        detail:
          'Check the website’s domain registrar via WHOIS (e.g. GoDaddy, Namecheap, Hostinger) and file an Abuse / Fraud Complaint to have the malicious e-commerce portal taken offline.',
        isImmediate: false,
        authority: 'Domain Abuse Registrar',
      },
    ],
    evidenceToCollect: [
      'Order confirmation email or invoice showing Order ID, items, and date',
      'Transaction receipt and bank debit SMS showing Payment Gateway merchant name',
      'Screenshots of the website product page, advertised price, and seller contact page',
      'Social media advertisement screenshot and profile link where the product was promoted',
      'All email/WhatsApp communications with seller or courier tracking history',
    ],
    legalSections: [
      {
        code: 'Consumer Protection (E-Commerce) Rules, 2020',
        act: 'Consumer Protection Act, 2019',
        title: 'Duties of e-commerce entities & unfair trade practices',
        description: 'Mandates disclosure of legal seller identity, return policy, and grievance officer.',
        penalty: 'Penalties under Section 88, 89, and 90 of CPA 2019 including product recall and fines.',
      },
      {
        code: 'Section 318(4)',
        act: 'Bharatiya Nyaya Sanhita, 2023',
        title: 'Cheating and dishonestly inducing delivery of property',
        description: 'Accepting money with fraudulent intent without intention to supply goods.',
        penalty: 'Imprisonment up to 7 years and fine.',
        equivalentSections: 'Section 420 Indian Penal Code (IPC)',
      },
      {
        code: 'Section 66D',
        act: 'Information Technology Act, 2000',
        title: 'Cheating by personation by using computer resource',
        description: 'Operating fake clone stores impersonating reputed retail brands.',
        penalty: 'Imprisonment up to 3 years and fine up to ₹1,00,000.',
      },
    ],
    officialPortals: [
      {
        name: 'National Consumer Helpline (NCH)',
        url: 'https://consumerhelpline.gov.in',
        purpose: 'File consumer disputes and retail trade grievance.',
        contact: 'Helpline: 1915',
      },
      {
        name: 'National Cybercrime Reporting Portal',
        url: 'https://cybercrime.gov.in',
        purpose: 'File cyber fraud complaint if fraudulent intent is evident.',
      },
    ],
    recoveryTips: [
      'Never trust sponsored Instagram ads offering 80%-90% discounts on premium brands like Apple, Dyson, or Nike.',
      'Check if the website displays a physical Indian registered address, GSTIN number, and telephone number before ordering.',
      'Prefer Cash-on-Delivery (COD) or reputed marketplaces with established buyer protection policies.',
    ],
  },
};
