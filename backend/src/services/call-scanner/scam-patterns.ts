/**
 * CyberSaathi AI — Scam Call Pattern Catalog & Multilingual Knowledge Base
 * Covers India-specific cyber fraud vectors: Digital Arrest, Courier Narcotics, TRAI, Electricity, and Bank KYC.
 * Supports English, Hindi (Devanagari + Hinglish), and Telugu (Telugu script + Teluglish).
 */

export type CallScamCategory =
  | 'DIGITAL_ARREST_LAW_ENFORCEMENT'
  | 'COURIER_NARCOTICS_CUSTOMS'
  | 'TRAI_TELECOM_DISCONNECTION'
  | 'ELECTRICITY_POWER_DISCONNECTION'
  | 'BANK_KYC_ACCOUNT_FREEZE'
  | 'REMOTE_ACCESS_TOOL_COERCION'
  | 'LOTTERY_TASK_SCAM'
  | 'GENERAL_SUSPICIOUS';

export type TacticType =
  | 'IMPERSONATION'
  | 'URGENCY_THREAT'
  | 'FINANCIAL_DEMAND'
  | 'ISOLATION_SECRECY'
  | 'REMOTE_CONTROL'
  | 'CREDENTIAL_HARVESTING';

export interface ScamCallPattern {
  id: string;
  category: CallScamCategory;
  tactic: TacticType;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  weight: number;
  description: string;
  advice: string;
  // Regexes matching English, Hindi, and Telugu variations
  keywords: RegExp[];
}

export const CALL_SCAM_PATTERNS: ScamCallPattern[] = [
  // 1. Digital Arrest & Virtual Interrogation
  {
    id: 'digital_arrest_interrogation',
    category: 'DIGITAL_ARREST_LAW_ENFORCEMENT',
    tactic: 'URGENCY_THREAT',
    title: 'Digital Arrest / Fake Virtual Police Interrogation',
    severity: 'critical',
    weight: 40,
    description:
      'Scammers impersonate police or CBI and falsely claim you are under "digital arrest" via Skype or video call, ordering you not to disconnect.',
    advice:
      'Indian law enforcement NEVER executes arrests over Skype or video calls. Hang up immediately and dial 1930.',
    keywords: [
      /\b(?:digital\s+arrest|virtual\s+arrest|stay\s+on\s+(?:camera|video|skype|call))\b/i,
      /\b(?:skype\s+(?:call|interrogation|id)|video\s+conf(?:erence)?\s+interrogation)\b/i,
      /(?:डिजिटल\s*अरेस्ट|कैमरा\s*बंद\s*मत\s*करना|स्काइप|वीडियो\s*कॉल\s*पर\s*रहिए)/i,
      /(?:డిజిటల్\s*అరెస్ట్|కెమెరా\s*ఆన్|స్కైప్\s*కాల్|వీడియో\s*కాల్\s*నుంచి\s*వెళ్లొద్దు)/i,
      /\b(?:camera\s*off\s*mat\s*karna|video\s*call\s*pe\s*raho|arrest\s*warrant\s*online)\b/i,
      /\b(?:camera\s*lo\s*undali|call\s*cut\s*cheyoddu|video\s*arrest)\b/i,
    ],
  },

  // 2. Law Enforcement / CBI / Crime Branch Impersonation
  {
    id: 'law_enforcement_impersonation',
    category: 'DIGITAL_ARREST_LAW_ENFORCEMENT',
    tactic: 'IMPERSONATION',
    title: 'CBI / Police / ED / NIA Impersonation',
    severity: 'critical',
    weight: 35,
    description:
      'Caller falsely claims to be from CBI, Mumbai Police, Delhi Police, ED, NIA, or Supreme Court regarding money laundering or terror financing.',
    advice:
      'Police officers never demand immediate online funds transfers or secret interrogations over WhatsApp/Skype.',
    keywords: [
      /\b(?:cbi\s+officer|central\s+bureau\s+of\s+investigation|crime\s+branch|cyber\s+crime\s+cell)\b/i,
      /\b(?:enforcement\s+directorate|\bed\s+officer|narcotics\s+control\s+bureau|\bncb\b|supreme\s+court\s+order)\b/i,
      /\b(?:mumbai\s+police|delhi\s+police|hyderabad\s+police|bengaluru\s+police)\b/i,
      /\b(?:money\s+laundering|hawala\s+racket|terror\s+financing|arrest\s+warrant)\b/i,
      /(?:सीबीआई|क्राइम\s*ब्रांच|साइबर\s*सेल|मनी\s*लॉन्ड्रिंग|हवाला|गिरफ्तारी\s*वारंट)/i,
      /(?:సిబిఐ|క్రైమ్\s*బ్రాంచ్|సైబర్\s*క్రైమ్|పోలీస్\s*స్టేషన్|మనీ\s*లాండరింగ్|అరెస్ట్\s*వారెంట్)/i,
      /\b(?:cbi\s*se\s*bol\s*raha|police\s*case\s*hai|money\s*laundering\s*case)\b/i,
      /\b(?:cbi\s*nunchi\s*matladutunna|police\s*case\s*aipoindi)\b/i,
    ],
  },

  // 3. Courier / FedEx / Narcotics Parcel Seizure
  {
    id: 'courier_narcotics_parcel',
    category: 'COURIER_NARCOTICS_CUSTOMS',
    tactic: 'IMPERSONATION',
    title: 'Customs / Courier Illegal Parcel Seizure (FedEx / DHL / India Post)',
    severity: 'critical',
    weight: 35,
    description:
      'Claims a parcel sent under your Aadhaar/passport to Taiwan/Cambodia/Dubai contains passports, credit cards, or narcotics (MDMA/contraband).',
    advice:
      'FedEx and Customs never demand remote money transfers or instant clearance fines. Call FedEx customer support directly.',
    keywords: [
      /\b(?:fedex|dhl|india\s+post|bluedart)\b.*\b(?:parcel|package|consignment)\b/i,
      /\b(?:parcel|package)\b.*\b(?:seized|detained|intercepted|narcotics|drugs|mdma|contraband)\b/i,
      /\b(?:taiwan|cambodia|thailand|dubai)\b.*\b(?:parcel|illegal|drugs)\b/i,
      /\b(?:customs\s+department|customs\s+clearance|customs\s+officer)\b/i,
      /(?:पार्सल|ड्रग्स|नशीली\s*दवाएं|कस्टम\s*विभाग|फेडेक्स)/i,
      /(?:పార్సిల్|డ్రగ్స్|కస్టమ్స్|నార్కోటిక్స్|ఫెడెక్స్)/i,
      /\b(?:parcel\s*me\s*drugs|fedex\s*parcel\s*pakda\s*gaya|customs\s*ne\s*rok\s*liya)\b/i,
      /\b(?:parcel\s*lo\s*drugs\s*dorikayi|customs\s*officer\s*matladutunna)\b/i,
    ],
  },

  // 4. TRAI / Telecom Threat of SIM Deactivation
  {
    id: 'trai_telecom_disconnection',
    category: 'TRAI_TELECOM_DISCONNECTION',
    tactic: 'URGENCY_THREAT',
    title: 'TRAI / DoT Telecom Disconnection Threat',
    severity: 'high',
    weight: 30,
    description:
      'Claims your phone number or all Aadhaar-linked SIM cards will be permanently disconnected within 2 hours due to illegal advertisements or harassment complaints.',
    advice:
      'TRAI never calls individual citizens threatening 2-hour disconnection. Report the caller to Chakshu portal (sancharsaathi.gov.in).',
    keywords: [
      /\b(?:trai|telecom\s+regulatory|department\s+of\s+telecom|dot)\b.*\b(?:disconnect|block|terminate)\b/i,
      /\b(?:all\s+numbers|mobile\s+number)\b.*\b(?:disconnected\s+in\s+2\s+hours|blocked\s+today)\b/i,
      /\b(?:illegal\s+advertising|obscene\s+messages|harassment\s+complaint)\b/i,
      /(?:ट्राई|दूरसंचार\s*विभाग|2\s*घंटे\s*में\s*सिम\s*बंद|नंबर\s*ब्लॉक)/i,
      /(?:టెలికాం|రెండు\s*గంటల్లో\s*సిమ్\s*కట్|నెంబర్\s*బ్లాక్|ట్రాయ్)/i,
      /\b(?:2\s*ghante\s*me\s*sim\s*band|trai\s*se\s*call|aadhaar\s*par\s*fake\s*sim)\b/i,
      /\b(?:2\s*hours\s*lo\s*sim\s*block|phone\s*cut\s*aipotundi)\b/i,
    ],
  },

  // 5. Electricity Board Disconnection Scams
  {
    id: 'electricity_power_disconnection',
    category: 'ELECTRICITY_POWER_DISCONNECTION',
    tactic: 'URGENCY_THREAT',
    title: 'Urgent Electricity / Power Disconnection Threat',
    severity: 'high',
    weight: 30,
    description:
      'Claims electricity power supply will be cut tonight at 9:30 PM due to unpaid bill or un-updated meter software, demanding immediate call to an officer.',
    advice:
      'Power utilities do not send personal mobile numbers for bill payments or disconnect supply without formal written notice. Check your official electricity DISCOM app.',
    keywords: [
      /\b(?:electricity\s+bill|power\s+supply|power\s+disconnection)\b.*\b(?:9:?30|tonight|immediately)\b/i,
      /\b(?:electricity\s+officer|contact\s+our\s+power\s+officer|update\s+meter)\b/i,
      /\b(?:bijli\s+bill|power\s+cut)\b/i,
      /(?:बिजली\s*बिल|बिजली\s*कट\s*जाएगी|रात\s*9:?30\s*बजे|अधिकारी\s*से\s*संपर्क)/i,
      /(?:కరెంట్\s*బిల్లు|రాత్రి\s*కరెంట్\s*కట్|కరెంట్\s*ఆఫీసర్)/i,
      /\b(?:bijli\s*connection\s*kat\s*jayega|aaj\s*raat\s*9:?30\s*baje)\b/i,
      /\b(?:current\s*bill\s*kattaledu|current\s*cut\s*chestaru)\b/i,
    ],
  },

  // 6. Demands for "Verification Account" / Safe RBI Deposit
  {
    id: 'safe_rbi_verification_account',
    category: 'DIGITAL_ARREST_LAW_ENFORCEMENT',
    tactic: 'FINANCIAL_DEMAND',
    title: 'Fund Transfer to "RBI Verification / Supreme Court Clearing Account"',
    severity: 'critical',
    weight: 45,
    description:
      'Scammers instruct the victim to liquidate savings, mutual funds, or FDs and transfer funds to a "government safe account" or "RBI verification account" that will allegedly be refunded after clearance.',
    advice:
      'CRITICAL DANGER: The RBI or Police NEVER have "clearing" or "verification accounts". Never transfer money under duress. Any transferred funds will be instantly stolen.',
    keywords: [
      /\b(?:rbi\s+verification\s+account|supreme\s+court\s+account|government\s+safe\s+account)\b/i,
      /\b(?:secret\s+verification\s+account|security\s+deposit|refundable\s+bond)\b/i,
      /\b(?:transfer\s+all\s+(?:your\s+)?(?:funds|money|balance|fd))\b/i,
      /\b(?:clear\s+your\s+name|innocence\s+verification)\b/i,
      /(?:आरबीआई\s*वेरिफिकेशन\s*अकाउंट|सरकारी\s*खाते\s*में\s*पैसे\s*भेजो|सुरक्षित\s*अकाउंट)/i,
      /(?:ఆర్బీఐ\s*అకౌంట్|డబ్బులు\s*ట్రాన్స్ఫర్\s*చేయండి|వెరిఫికేషన్\s*కోసం\s*డబ్బులు)/i,
      /\b(?:rbi\s*ke\s*account\s*me\s*transfer|paise\s*bhejo\s*verify\s*hoga)\b/i,
      /\b(?:verification\s*account\s*lo\s*transfer\s*cheyandi)\b/i,
    ],
  },

  // 7. Remote Access Tool (RAT) Coercion (AnyDesk / RustDesk / TeamViewer)
  {
    id: 'remote_access_tool_coercion',
    category: 'REMOTE_ACCESS_TOOL_COERCION',
    tactic: 'REMOTE_CONTROL',
    title: 'Screen Sharing & Remote Access Tool Coercion',
    severity: 'critical',
    weight: 40,
    description:
      'Instructing victim to install AnyDesk, RustDesk, TeamViewer, QuickSupport, or dial MMI codes (`*401*<phone>#`) to inspect device or forward OTPs.',
    advice:
      'Never install AnyDesk or screen sharing tools instructed by a phone caller. Never dial *401* codes—this forwards all your SMS and calls to fraudsters.',
    keywords: [
      /\b(?:anydesk|teamviewer|rustdesk|quicksupport|zoho\s+assist|airdroid)\b/i,
      /\b(?:\*401\*|\*21\*|call\s+forwarding\s+code)\b/i,
      /\b(?:share\s+your\s+screen|give\s+access\s+to\s+your\s+phone)\b/i,
      /(?:एनीडेस्क|टीमव्यूअर|स्क्रीन\s*शेयर|कॉल\s*फॉरवर्डिंग)/i,
      /(?:యానిడెస్క్|స్క్రీన్\s*షేర్|కాల్\s*ఫార్వర్డింగ్)/i,
      /\b(?:anydesk\s*download\s*karo|screen\s*share\s*karo)\b/i,
      /\b(?:app\s*download\s*chesi\s*code\s*cheppandi)\b/i,
    ],
  },

  // 8. Secrecy & Isolation Coercion
  {
    id: 'isolation_and_secrecy',
    category: 'GENERAL_SUSPICIOUS',
    tactic: 'ISOLATION_SECRECY',
    title: 'Isolation & Secrecy Pressure',
    severity: 'high',
    weight: 25,
    description:
      'Warning victim not to disclose the conversation to family, lawyers, bank officials, or friends, citing "national security" or "Official Secrets Act".',
    advice:
      'Scammers enforce secrecy so family members cannot intervene. Always consult someone you trust immediately.',
    keywords: [
      /\b(?:don'?t\s+tell\s+(?:anyone|family|lawyer|bank)|keep\s+it\s+(?:strictly\s+)?confidential)\b/i,
      /\b(?:official\s+secrets\s+act|national\s+security\s+matter|confidential\s+investigation)\b/i,
      /\b(?:go\s+to\s+a\s+closed\s+room|isolate\s+yourself)\b/i,
      /(?:किसी\s*को\s*मत\s*बताना|परिवार\s*से\s*छुपाकर|अकेले\s*कमरे\s*में\s*जाओ|सीक्रेट\s*जांच)/i,
      /(?:ఎవరికీ\s*చెప్పవద్దు|గదిలో\s*ఒంటరిగా\s*ఉండండి|రహస్య\s*విచారణ)/i,
      /\b(?:kisi\s*ko\s*mat\s*batana|family\s*ko\s*mat\s*bolo|room\s*band\s*karo)\b/i,
      /\b(?:evarki\s*cheppakandi|okkare\s*undandi)\b/i,
    ],
  },

  // 9. OTP / PIN / Banking Password Requests
  {
    id: 'otp_pin_credential_harvesting',
    category: 'BANK_KYC_ACCOUNT_FREEZE',
    tactic: 'CREDENTIAL_HARVESTING',
    title: 'Urgent OTP, PIN, or Card CVV Request',
    severity: 'critical',
    weight: 35,
    description:
      'Requesting OTP, ATM PIN, UPI PIN, or CVV under the pretext of KYC verification, refund processing, or stopping an unauthorized transaction.',
    advice:
      'Banks and RBI NEVER ask for OTPs or UPI PINs over a phone call. Entering a UPI PIN always debits money from your account.',
    keywords: [
      /\b(?:otp|one\s+time\s+password|upi\s+pin|atm\s+pin|cvv\s+number)\b/i,
      /\b(?:tell\s+me\s+the\s+6\s*digit\s+code|share\s+the\s+sms\s+code)\b/i,
      /(?:ओटीपी|पिन|सीवीवी|6\s*डिजिट\s*कोड)/i,
      /(?:ఓటిపి|పిన్|సివివి|6\s*అంకెల\s*కోడ్)/i,
      /\b(?:otp\s*batao|pin\s*batao|code\s*share\s*karo)\b/i,
      /\b(?:otp\s*cheppandi|pin\s*enter\s*cheyandi)\b/i,
    ],
  },
];

/**
 * Detects language from input transcript (English, Hindi, Telugu, or Mixed).
 */
export function detectCallLanguage(text: string): 'en' | 'hi' | 'te' | 'mixed' {
  // Telugu Unicode range: \u0C00-\u0C7F
  const teluguMatches = (text.match(/[\u0C00-\u0C7F]/g) || []).length;
  // Devanagari (Hindi) Unicode range: \u0900-\u097F
  const hindiMatches = (text.match(/[\u0900-\u097F]/g) || []).length;

  if (teluguMatches > 15 && hindiMatches < 5) return 'te';
  if (hindiMatches > 15 && teluguMatches < 5) return 'hi';
  if (teluguMatches > 10 && hindiMatches > 10) return 'mixed';

  // Check Romanized keywords
  const teluguRoman = /\b(?:nunchi|matladutunna|cheyandi|undi|unnayi|aipoindi|kattaledu|cheppandi)\b/i.test(text);
  const hindiRoman = /\b(?:bol\s+raha|karo|bhejo|kat\s+jayega|hai|hoga|batao|batana)\b/i.test(text);

  if (teluguRoman && !hindiRoman) return 'te';
  if (hindiRoman && !teluguRoman) return 'hi';
  if (teluguRoman && hindiRoman) return 'mixed';

  return 'en';
}
