# CyberSaathi AI — Mobile Companion Application

> **Tagline:** *Your Digital World. Our Protection.*  
> **Platform:** Universal iOS & Android (Phones & Tablets)  
> **Technology Stack:** React Native & Expo SDK 52 (TypeScript, Expo Router v4, React Native Reanimated, Expo SecureStore, Supabase JS)

---

## 🛡️ Overview

**CyberSaathi AI Mobile** is a production-grade, security-hardened mobile companion application engineered to provide real-time scam detection, multilingual AI incident response, biometrically protected evidence management, and family defense for citizens across India.

The mobile application connects directly to the existing CyberSaathi AI Express backend and Supabase infrastructure without duplicating backend business logic, maintaining complete isolation from the web frontend (`/frontend`).

---

## ✨ Core Features & Mobile Capabilities

### 1. Authentication & Security Engine
- **Supabase Authentication**: Email/Password and Google OAuth with deep linking (`cybersaathi://auth/callback`).
- **Hardware-Backed Storage**: Auth tokens are encrypted at rest using iOS Keychain and Android Keystore via `expo-secure-store`.
- **Biometric App Shield**: Optional Face ID / Touch ID / Fingerprint gate (`expo-local-authentication`) to lock access upon returning from background.
- **Hardware Posture Audit**: Real-time evaluation of device screen lock, biometrics enrollment, and OS security level.

### 2. AI Scam Radar
- **Multi-Modal Threat Scanner**: Evaluates URLs, SMS texts, and emails against domain reputation, typosquatting heuristics, and panic keywords.
- **Camera QR Scanner**: High-speed live viewfinder (`expo-camera`) with animated reticle and flashlight/torch control to detect malicious UPI payment redirects and phishing payloads.
- **Visual Risk Gauge**: Real-time 0–100 threat probability meter with color-coded verdict (**SAFE**, **SUSPICIOUS**, **DANGEROUS**) and explainability breakdown.

### 3. Voice Saathi (Multilingual AI Assistant)
- **Gemini AI Integration**: Multi-turn contextual guidance for ongoing cyber incidents.
- **Language Switcher**: Native support for **English**, **हिन्दी (Hindi)**, and **తెలుగు (Telugu)**.
- **Voice Audio Prompts**: Native voice recording via `expo-av` with automatic incident guidance synthesis.

### 4. Investigation Room & Evidence Locker
- **Case Management**: Track incident status (Open, In Progress, Resolved) with timeline event logging.
- **Evidence Locker**: Attach screenshots and banking statement extracts with automated SHA-256 integrity hashing.
- **AI Case Analysis**: One-tap Gemini contextual analysis for incident containment.
- **Court-Ready PDF Generation**: Compiles official incident summaries using `expo-print` and shares via `expo-sharing`.

### 5. Fraud Recovery Suite & 1930 Emergency Helpline
- **One-Tap 1930 Dialer**: Instant connection to India's National Cyber Crime Helpline for golden hour financial recovery.
- **9 Indian Fraud Vectors**: Step-by-step containment checklists for UPI scams, digital arrest video calls, electricity bill APKs, sextortion, and SIM swap attacks.
- **Bank Directory**: Direct 24x7 fraud blocking hotlines for SBI, HDFC, ICICI, and Axis Bank.

### 6. Cybercrime FIR Drafter
- Generates official legal complaints compliant with Ministry of Home Affairs guidelines for submission at **cybercrime.gov.in** or local Cyber Police Stations under:
  - **Information Technology Act, 2000 Section 66D** (Cheating by personation).
  - **Bharatiya Nyaya Sanhita (BNS) Section 318** (Cheating and dishonestly inducing delivery of property).

### 7. Cyber Academy
- Micro-learning modules on Phishing, UPI safety, and Identity protection.
- Interactive quizzes with instant scoring, feedback, and certificate eligibility.

### 8. Family Safety Circles
- Guardian and Member roles with invite code pairing (`SAATHI-XXXX`).
- One-tap **Emergency SOS Threat Alert** broadcast with push notifications to protect family members from active scam calls.
- Non-crashing graceful fallback when remote database migration is pending.

---

## 🚀 Getting Started

### Prerequisites
- Node.js `v18+` (Tested on `v25.8.1`)
- npm `v9+` (Tested on `v11.11.0`)
- Expo Go app on physical iOS/Android device OR an Android/iOS emulator

### Environment Setup
Create a `.env` file in the `mobile/` directory by copying `.env.example`:

```bash
cp mobile/.env.example mobile/.env
```

Configure your endpoints:
```ini
# For Android Emulator:
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3001/api

# For iOS Simulator / Web:
EXPO_PUBLIC_API_BASE_URL=http://localhost:3001/api

# For Physical Device on Wi-Fi:
EXPO_PUBLIC_API_BASE_URL=http://<YOUR_LOCAL_IP>:3001/api

# Supabase Credentials:
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Installation & Launch

```bash
# Navigate to mobile directory
cd mobile

# Install dependencies
npm install --legacy-peer-deps

# Start Expo Development Server
npm start
```

### Running on Devices
- **Android**: Press `a` in the terminal or run `npm run android`
- **iOS**: Press `i` in the terminal or run `npm run ios`
- **Physical Device**: Scan the terminal QR code with the **Expo Go** camera (Android) or default Camera app (iOS)

---

## 🧪 Testing & Verification

The mobile client includes full TypeScript strict mode compilation and Jest test suites:

```bash
# Run TypeScript compilation check
npm run typecheck

# Run test suite
npm test
```

### Test Coverage
- `secureStore.test.ts`: Hardware-backed keychain/keystore encryption and in-memory fallback.
- `deviceSecurity.test.ts`: Hardware posture scoring, biometric checks, and hardening recommendations.
- `scanner.api.test.ts`: Risk score calculation, multi-modal payload triage, and verdict assignment.
- `recovery.api.test.ts`: 1930 emergency hotline mapping and statutory FIR complaint letter generation.
- `family.api.test.ts`: Remote database migration resilience and fallback circle state.
- `academy.api.test.ts`: Course loading and interactive quiz evaluation.

---

## 📦 Production Builds (EAS)

Configure Expo Application Services (`eas.json`) to generate standalone release binaries:

```bash
# Generate Android APK (standalone installable binary)
npx eas-cli build -p android --profile preview

# Generate Android App Bundle (Google Play Store release)
npx eas-cli build -p android --profile production

# Generate iOS Build (Apple App Store / TestFlight)
npx eas-cli build -p ios --profile production
```

---

## 🔒 Security Compliance
- **Zero Raw Secret Exposure**: Sensitive keys and credentials are never stored in client state.
- **Hardware Encryption**: Refresh tokens are stored strictly within the platform's hardware enclave.
- **Network Resilience**: Full offline operation for emergency contacts, cached containment checklists, and learning modules when cellular connectivity is severed.
- **WCAG 2.1 AA Compliant**: High-contrast Cyber Guard palette (`#0B1120`, `#6366F1`, `#06B6D4`, `#10B981`, `#EF4444`) with minimum 44px touch targets and screen-reader semantics.
