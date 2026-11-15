export type PermissionCategory =
  | 'Contacts'
  | 'SMS'
  | 'Call logs'
  | 'Microphone'
  | 'Camera'
  | 'Location'
  | 'Storage and media'
  | 'Accessibility'
  | 'Notification access'
  | 'Device administration'
  | 'Network access'
  | 'Other sensitive permissions';

export type PermissionSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface PermissionDefinition {
  name: string;
  shortName: string;
  category: PermissionCategory;
  severity: PermissionSeverity;
  protectionLevel: 'dangerous' | 'normal' | 'signature' | 'signatureOrSystem' | 'special';
  explanation: string;
  potentialAbuse: string;
  legitimateUseCases: string;
  recommendedAction: string;
}

export const PERMISSION_CATALOG: Record<string, PermissionDefinition> = {
  // --- CONTACTS ---
  'android.permission.READ_CONTACTS': {
    name: 'android.permission.READ_CONTACTS',
    shortName: 'Read Contacts',
    category: 'Contacts',
    severity: 'high',
    protectionLevel: 'dangerous',
    explanation: 'Allows the application to read all contact details, phone numbers, and email addresses stored on the device.',
    potentialAbuse: 'Exfiltration of personal contacts database; frequently abused by predatory loan apps to harvest contacts for social shaming and extortion.',
    legitimateUseCases: 'Messaging apps, contact organizers, email clients, social networking apps.',
    recommendedAction: 'Verify whether the application genuinely needs address book integration. Deny if requested by utility, calculator, or flashlight apps.',
  },
  'android.permission.WRITE_CONTACTS': {
    name: 'android.permission.WRITE_CONTACTS',
    shortName: 'Modify Contacts',
    category: 'Contacts',
    severity: 'medium',
    protectionLevel: 'dangerous',
    explanation: 'Allows the application to create, edit, or delete contacts stored on the device.',
    potentialAbuse: 'Tampering with contact numbers to redirect emergency calls or modify bank helpline entries.',
    legitimateUseCases: 'Sync tools, phone dialers, enterprise directory sync.',
    recommendedAction: 'Grant only if the application manages your address book.',
  },
  'android.permission.GET_ACCOUNTS': {
    name: 'android.permission.GET_ACCOUNTS',
    shortName: 'Get Accounts',
    category: 'Contacts',
    severity: 'medium',
    protectionLevel: 'dangerous',
    explanation: 'Allows access to the list of accounts recognized by the Account Manager (Google, WhatsApp, work accounts).',
    potentialAbuse: 'Account enumeration and targeted user profiling.',
    legitimateUseCases: 'Single Sign-On (SSO) login assistants and synchronizers.',
    recommendedAction: 'Modern Android apps should use Google Play Services sign-in rather than querying all device accounts directly.',
  },

  // --- SMS ---
  'android.permission.RECEIVE_SMS': {
    name: 'android.permission.RECEIVE_SMS',
    shortName: 'Receive SMS',
    category: 'SMS',
    severity: 'critical',
    protectionLevel: 'dangerous',
    explanation: 'Allows the application to intercept and process incoming SMS text messages in real time.',
    potentialAbuse: 'Interception of one-time passwords (OTPs), two-factor authentication codes, and financial transaction alerts.',
    legitimateUseCases: 'Default SMS apps, carrier network configuration tools.',
    recommendedAction: 'Never grant unless this application is your chosen default SMS messenger. Legitimate apps should use the SMS Retriever API instead.',
  },
  'android.permission.READ_SMS': {
    name: 'android.permission.READ_SMS',
    shortName: 'Read SMS',
    category: 'SMS',
    severity: 'critical',
    protectionLevel: 'dangerous',
    explanation: 'Allows the application to read all SMS messages stored on the device inbox.',
    potentialAbuse: 'Harvesting historical banking messages, debit/credit card balances, transaction history, and private conversations.',
    legitimateUseCases: 'Default SMS applications and backup utilities.',
    recommendedAction: 'Extreme caution: financial spyware and banking trojans prioritize this permission to harvest bank statements.',
  },
  'android.permission.SEND_SMS': {
    name: 'android.permission.SEND_SMS',
    shortName: 'Send SMS',
    category: 'SMS',
    severity: 'critical',
    protectionLevel: 'dangerous',
    explanation: 'Allows the application to send SMS messages silently in the background without user confirmation.',
    potentialAbuse: 'Sending unauthorized premium-rate SMS messages incurring high telecom charges or exfiltrating data covertly.',
    legitimateUseCases: 'Default SMS messaging apps.',
    recommendedAction: 'Restricted by Google Play policies. High risk if found in non-messaging APKs.',
  },
  'android.permission.RECEIVE_MMS': {
    name: 'android.permission.RECEIVE_MMS',
    shortName: 'Receive MMS',
    category: 'SMS',
    severity: 'high',
    protectionLevel: 'dangerous',
    explanation: 'Allows the app to monitor incoming MMS messages.',
    potentialAbuse: 'Intercepting multimedia messages containing personal photos or documents.',
    legitimateUseCases: 'Default SMS/MMS apps.',
    recommendedAction: 'Only grant to verified messaging applications.',
  },

  // --- CALL LOGS & PHONE ---
  'android.permission.READ_CALL_LOG': {
    name: 'android.permission.READ_CALL_LOG',
    shortName: 'Read Call Log',
    category: 'Call logs',
    severity: 'critical',
    protectionLevel: 'dangerous',
    explanation: 'Allows the application to read the complete call history, including incoming, outgoing, missed calls, and contact identities.',
    potentialAbuse: 'Surveillance of user communication patterns; commonly paired with contacts by loan shark apps for extortion.',
    legitimateUseCases: 'Default dialer apps, truecaller-style caller ID lookup.',
    recommendedAction: 'Do not grant to casual games, utilities, or instant loan apps.',
  },
  'android.permission.WRITE_CALL_LOG': {
    name: 'android.permission.WRITE_CALL_LOG',
    shortName: 'Modify Call Log',
    category: 'Call logs',
    severity: 'high',
    protectionLevel: 'dangerous',
    explanation: 'Allows the app to write and delete call history records.',
    potentialAbuse: 'Covertly deleting evidence of calls made to premium numbers or fraudster contact attempts.',
    legitimateUseCases: 'Default phone and dialer applications.',
    recommendedAction: 'Restricted; grant only to trusted system phone apps.',
  },
  'android.permission.CALL_PHONE': {
    name: 'android.permission.CALL_PHONE',
    shortName: 'Initiate Phone Calls',
    category: 'Call logs',
    severity: 'high',
    protectionLevel: 'dangerous',
    explanation: 'Allows the application to initiate phone calls without going through the Dialer user interface.',
    potentialAbuse: 'Dialing expensive toll lines or eavesdropping lines silently.',
    legitimateUseCases: 'Assistive tools, speed-dial widgets, emergency calling apps.',
    recommendedAction: 'Apps should use Intent.ACTION_DIAL instead to allow user confirmation.',
  },
  'android.permission.READ_PHONE_STATE': {
    name: 'android.permission.READ_PHONE_STATE',
    shortName: 'Read Phone State',
    category: 'Call logs',
    severity: 'medium',
    protectionLevel: 'dangerous',
    explanation: 'Allows read-only access to phone state, including current cellular network information, phone status, and ongoing call states.',
    potentialAbuse: 'Tracking phone numbers and carrier identifiers across applications.',
    legitimateUseCases: 'Media players (to pause music when a call arrives), telephony management.',
    recommendedAction: 'Verify why the app needs to observe incoming telephony state.',
  },

  // --- MICROPHONE ---
  'android.permission.RECORD_AUDIO': {
    name: 'android.permission.RECORD_AUDIO',
    shortName: 'Record Audio / Microphone',
    category: 'Microphone',
    severity: 'high',
    protectionLevel: 'dangerous',
    explanation: 'Allows the application to access the microphone and record surrounding audio.',
    potentialAbuse: 'Room eavesdropping, recording private phone calls or ambient conversations without physical indication.',
    legitimateUseCases: 'Voice calling, audio recorders, speech-to-text assistants, video recording.',
    recommendedAction: 'Use "While using the app" permission setting in Android 11+ and review the microphone indicator privacy dot in the status bar.',
  },

  // --- CAMERA ---
  'android.permission.CAMERA': {
    name: 'android.permission.CAMERA',
    shortName: 'Take Pictures & Video',
    category: 'Camera',
    severity: 'high',
    protectionLevel: 'dangerous',
    explanation: 'Allows the application to capture photos and videos using device cameras.',
    potentialAbuse: 'Secret photo capture, ambient video surveillance, or extortion via recorded personal space.',
    legitimateUseCases: 'Camera apps, video conferencing, QR code scanners, document capture.',
    recommendedAction: 'Only allow while the app is actively in use; restrict background camera access.',
  },

  // --- LOCATION ---
  'android.permission.ACCESS_FINE_LOCATION': {
    name: 'android.permission.ACCESS_FINE_LOCATION',
    shortName: 'Precise GPS Location',
    category: 'Location',
    severity: 'high',
    protectionLevel: 'dangerous',
    explanation: 'Accesses precise location coordinates using GPS, Wi-Fi, and cellular tower data down to a few meters.',
    potentialAbuse: 'Stalking, physical movement tracking, profiling home and work locations.',
    legitimateUseCases: 'Navigation (Google Maps), ride-hailing (Uber/Ola), fitness tracking.',
    recommendedAction: 'Choose "Approximate location" unless turn-by-turn navigation is explicitly required.',
  },
  'android.permission.ACCESS_COARSE_LOCATION': {
    name: 'android.permission.ACCESS_COARSE_LOCATION',
    shortName: 'Approximate Location',
    category: 'Location',
    severity: 'medium',
    protectionLevel: 'dangerous',
    explanation: 'Accesses approximate device location based on cellular towers and Wi-Fi networks (accurate to ~city block).',
    potentialAbuse: 'General location profiling and targeted advertising tracking.',
    legitimateUseCases: 'Weather apps, regional content personalization, store locators.',
    recommendedAction: 'Sufficient for most non-navigation apps.',
  },
  'android.permission.ACCESS_BACKGROUND_LOCATION': {
    name: 'android.permission.ACCESS_BACKGROUND_LOCATION',
    shortName: 'Continuous Background Location',
    category: 'Location',
    severity: 'critical',
    protectionLevel: 'dangerous',
    explanation: 'Allows the app to track device location 24/7 even when the app is closed or not in active use.',
    potentialAbuse: 'Continuous surveillance, real-time battery drain, and persistent movement logs.',
    legitimateUseCases: 'Family safety locator apps, fitness run tracking, anti-theft tracking.',
    recommendedAction: 'Strictly limit to apps that have a critical need for continuous background tracking.',
  },

  // --- STORAGE & MEDIA ---
  'android.permission.READ_EXTERNAL_STORAGE': {
    name: 'android.permission.READ_EXTERNAL_STORAGE',
    shortName: 'Read Storage / Files',
    category: 'Storage and media',
    severity: 'high',
    protectionLevel: 'dangerous',
    explanation: 'Allows the app to read all files, photos, downloads, and documents stored on device storage.',
    potentialAbuse: 'Theft of personal photos, downloaded PDFs, tax documents, and private files.',
    legitimateUseCases: 'File managers, photo editors, document viewers on Android 12 and below.',
    recommendedAction: 'On Android 13+, apps should use the Photo Picker or specific READ_MEDIA_IMAGES permissions.',
  },
  'android.permission.WRITE_EXTERNAL_STORAGE': {
    name: 'android.permission.WRITE_EXTERNAL_STORAGE',
    shortName: 'Modify / Delete Storage',
    category: 'Storage and media',
    severity: 'high',
    protectionLevel: 'dangerous',
    explanation: 'Allows writing, modifying, and deleting files on shared device storage.',
    potentialAbuse: 'Ransomware file encryption, overwriting legitimate downloads, or deleting files.',
    legitimateUseCases: 'Download managers, photo editing saving.',
    recommendedAction: 'Deprecated in modern Android in favor of Scoped Storage.',
  },
  'android.permission.MANAGE_EXTERNAL_STORAGE': {
    name: 'android.permission.MANAGE_EXTERNAL_STORAGE',
    shortName: 'All Files Access (Broad Storage)',
    category: 'Storage and media',
    severity: 'critical',
    protectionLevel: 'special',
    explanation: 'Provides unrestricted read and write access to all files on the device, bypassing Scoped Storage restrictions.',
    potentialAbuse: 'Complete inspection and extraction of all user files, documents, and other app directories.',
    legitimateUseCases: 'Antivirus scanners, file managers, comprehensive backup tools.',
    recommendedAction: 'Heavy red flag if requested by regular games, calculators, or social media apps.',
  },
  'android.permission.READ_MEDIA_IMAGES': {
    name: 'android.permission.READ_MEDIA_IMAGES',
    shortName: 'Read Media Images',
    category: 'Storage and media',
    severity: 'medium',
    protectionLevel: 'dangerous',
    explanation: 'Allows read access to photos and images on modern Android 13+ devices.',
    potentialAbuse: 'Bulk photo exfiltration.',
    legitimateUseCases: 'Gallery apps, social media post uploaders.',
    recommendedAction: 'Prefer the Android Photo Picker where you only grant access to selected photos.',
  },

  // --- ACCESSIBILITY ---
  'android.permission.BIND_ACCESSIBILITY_SERVICE': {
    name: 'android.permission.BIND_ACCESSIBILITY_SERVICE',
    shortName: 'Accessibility Service Hook',
    category: 'Accessibility',
    severity: 'critical',
    protectionLevel: 'signature',
    explanation: 'Declares an Accessibility Service capable of reading on-screen content, logging keystrokes, and clicking buttons automatically.',
    potentialAbuse: 'The single most abused capability by Android banking malware (Cerberus, Hydra, SharkBot) to read OTPs, passwords, and auto-grant permissions.',
    legitimateUseCases: 'Screen readers for visually impaired users (TalkBack), automation tools (Tasker).',
    recommendedAction: 'Never enable this in Android Accessibility Settings for unverified sideloaded apps.',
  },

  // --- NOTIFICATION ACCESS ---
  'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE': {
    name: 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
    shortName: 'Notification Listener',
    category: 'Notification access',
    severity: 'critical',
    protectionLevel: 'signature',
    explanation: 'Allows the app to intercept and read all notifications posted by all apps, including messaging and banking alerts.',
    potentialAbuse: 'Reading incoming OTPs and 2FA notifications from banking and WhatsApp apps without needing SMS permissions.',
    legitimateUseCases: 'Smartwatch companion apps (Wear OS, Garmin), notification managers.',
    recommendedAction: 'Do not grant to untrusted applications.',
  },
  'android.permission.POST_NOTIFICATIONS': {
    name: 'android.permission.POST_NOTIFICATIONS',
    shortName: 'Post Notifications',
    category: 'Notification access',
    severity: 'low',
    protectionLevel: 'dangerous',
    explanation: 'Allows the app to display notifications in the status bar.',
    potentialAbuse: 'Spamming deceptive adware or fake security alerts.',
    legitimateUseCases: 'Messaging apps, reminders, system status.',
    recommendedAction: 'Safe to grant if notifications are desired.',
  },

  // --- DEVICE ADMINISTRATION ---
  'android.permission.BIND_DEVICE_ADMIN': {
    name: 'android.permission.BIND_DEVICE_ADMIN',
    shortName: 'Device Administrator Hook',
    category: 'Device administration',
    severity: 'critical',
    protectionLevel: 'signature',
    explanation: 'Grants device-level administration rights, allowing remote lock, screen lock bypass, or factory reset commands.',
    potentialAbuse: 'Malware uses Device Admin to prevent the user from uninstalling the app by disabling the "Uninstall" button.',
    legitimateUseCases: 'Enterprise MDM tools, corporate security profiles, Find My Device.',
    recommendedAction: 'Extreme red flag if requested by third-party APKs or video apps.',
  },
  'android.permission.SYSTEM_ALERT_WINDOW': {
    name: 'android.permission.SYSTEM_ALERT_WINDOW',
    shortName: 'Draw Over Other Apps (Screen Overlay)',
    category: 'Device administration',
    severity: 'critical',
    protectionLevel: 'special',
    explanation: 'Allows the app to display floating windows or views on top of all other running applications.',
    potentialAbuse: 'Tapjacking and overlay attacks: displaying a fake bank login screen over the real banking app to steal PINs.',
    legitimateUseCases: 'Chat heads (Messenger), floating screen recorders, assistive bubbles.',
    recommendedAction: 'Disable "Display over other apps" for any suspicious or utility APK.',
  },

  // --- NETWORK ACCESS ---
  'android.permission.INTERNET': {
    name: 'android.permission.INTERNET',
    shortName: 'Full Internet Access',
    category: 'Network access',
    severity: 'low',
    protectionLevel: 'normal',
    explanation: 'Allows the application to open network sockets and send/receive data across the internet.',
    potentialAbuse: 'Data exfiltration and communication with remote Command & Control (C2) servers.',
    legitimateUseCases: 'Almost all modern connected apps (web, media, sync).',
    recommendedAction: 'Standard for connected apps; becomes a concern if paired with sensitive offline permissions (e.g. flashlight app with internet).',
  },
  'android.permission.ACCESS_NETWORK_STATE': {
    name: 'android.permission.ACCESS_NETWORK_STATE',
    shortName: 'View Network Connections',
    category: 'Network access',
    severity: 'low',
    protectionLevel: 'normal',
    explanation: 'Allows viewing connection status (Wi-Fi, Mobile Data, Airplane mode).',
    potentialAbuse: 'Basic device fingerprinting.',
    legitimateUseCases: 'Checking offline status before making requests.',
    recommendedAction: 'Safe normal permission.',
  },

  // --- OTHER SENSITIVE PERMISSIONS ---
  'android.permission.REQUEST_INSTALL_PACKAGES': {
    name: 'android.permission.REQUEST_INSTALL_PACKAGES',
    shortName: 'Install Unknown Apps / Dropper',
    category: 'Other sensitive permissions',
    severity: 'critical',
    protectionLevel: 'special',
    explanation: 'Allows the app to prompt the user to install other secondary APK packages.',
    potentialAbuse: 'Acts as a "Dropper" malware: a seemingly benign app that subsequently downloads and installs malicious payloads.',
    legitimateUseCases: 'Alternative app stores, browser download managers, enterprise update managers.',
    recommendedAction: 'Do not allow apps to install secondary unknown packages unless it is an authorized app marketplace.',
  },
  'android.permission.QUERY_ALL_PACKAGES': {
    name: 'android.permission.QUERY_ALL_PACKAGES',
    shortName: 'Inventory All Installed Apps',
    category: 'Other sensitive permissions',
    severity: 'high',
    protectionLevel: 'normal',
    explanation: 'Allows the app to query the list of all applications installed on the user device.',
    potentialAbuse: 'Detecting installed banking, cryptocurrency, and security apps to customize targeted phishing overlays.',
    legitimateUseCases: 'Launcher apps, antivirus security scanners, backup managers.',
    recommendedAction: 'Google Play strictly restricts this permission. Question why a utility requires full app inventory.',
  },
  'android.permission.ACCESS_SUPERUSER': {
    name: 'android.permission.ACCESS_SUPERUSER',
    shortName: 'Root / Superuser Access',
    category: 'Other sensitive permissions',
    severity: 'critical',
    protectionLevel: 'dangerous',
    explanation: 'Requests root / superuser privileges on rooted Android devices.',
    potentialAbuse: 'Total device takeover, bypassing all Android sandboxing and OS-level security boundaries.',
    legitimateUseCases: 'Advanced developer root utilities.',
    recommendedAction: 'Extreme hazard. Never grant to general consumer apps.',
  },
};

/**
 * Known suspicious permission clusters frequently observed in financial spyware and trojans.
 */
export const SUSPICIOUS_PERMISSION_CLUSTERS = [
  {
    id: 'predatory_loan_shark',
    title: 'Extortion Loan Shark Cluster',
    description: 'Simultaneous request for Contacts, SMS, Call Logs, and GPS location. This specific combination is characteristic of predatory illegal lending apps used to harvest personal networks for aggressive extortion.',
    requiredPermissions: [
      'android.permission.READ_CONTACTS',
      ['android.permission.READ_SMS', 'android.permission.RECEIVE_SMS'],
      'android.permission.READ_CALL_LOG',
      ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION'],
    ],
    severity: 'critical' as PermissionSeverity,
    riskWeight: 25,
  },
  {
    id: 'banking_trojan_overlay',
    title: 'Banking Trojan & Keylogger Cluster',
    description: 'Accessibility Service combined with System Alert Window (Draw Over Other Apps). This combination enables silent screen overlays to steal banking credentials and auto-approve transactions.',
    requiredPermissions: [
      'android.permission.BIND_ACCESSIBILITY_SERVICE',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
    severity: 'critical' as PermissionSeverity,
    riskWeight: 30,
  },
  {
    id: 'sms_interception_bot',
    title: 'SMS OTP Interception & Forwarding',
    description: 'Capability to intercept incoming SMS and open internet sockets. Often deployed in smishing-delivered APKs (such as fake electricity bill or customs updates) to steal banking OTPs.',
    requiredPermissions: [
      ['android.permission.RECEIVE_SMS', 'android.permission.READ_SMS'],
      'android.permission.INTERNET',
    ],
    severity: 'high' as PermissionSeverity,
    riskWeight: 20,
  },
  {
    id: 'dropper_mechanism',
    title: 'Secondary Malware Dropper Cluster',
    description: 'Ability to request package installation paired with broad storage or overlay permissions. Characteristic of dropper apps that download obfuscated malware after installation.',
    requiredPermissions: [
      'android.permission.REQUEST_INSTALL_PACKAGES',
      ['android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.WRITE_EXTERNAL_STORAGE', 'android.permission.MANAGE_EXTERNAL_STORAGE'],
    ],
    severity: 'high' as PermissionSeverity,
    riskWeight: 18,
  },
];
