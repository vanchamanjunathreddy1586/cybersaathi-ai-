# CYBERSAATHI AI — SECURITY REMEDIATION & DEFENSE-IN-DEPTH PLAN
**Tagline:** Your Digital World. Our Protection.  
**Classification:** Strategic Security Engineering & Remediation Roadmap  
**Target:** CyberSaathi AI Platform (Web, API, Extension, DB, AI Engine)  
**Version:** 1.1.0  
**Effective Date:** November 16, 2026  

---

## 1. PURPOSE & PRIORITIZATION FRAMEWORK

This document details the prioritized security remediation plan for CyberSaathi AI, covering vulnerabilities addressed during the Red Team audit and outlining proactive defense-in-depth enhancements for production operations.

Remediation priority follows standard risk matrices based on Exploitability, Blast Radius, and Business Impact:
- **P0 (Immediate / Critical):** Severe vulnerabilities affecting data integrity, authorization bypass, or brand defense.
- **P1 (High Priority / Launch Blocking):** Input validation gaps, brute-force vulnerabilities, or RLS hardening.
- **P2 (Medium Priority / Post-Launch Sprint):** Edge WAF tuning, rate limit synchronization, and secret lifecycle controls.
- **P3 (Operational Rigor / Continuous):** DevSecOps CI integration, continuous dependency auditing, and recurring threat model updates.

---

## 2. COMPLETED REMEDIATIONS (AUDIT FINDINGS CS-SEC-001 TO 005)

The following security findings were identified during the autonomous red team audit, directly patched in code, and verified with automated regression tests:

| ID | Title | Priority | Code Status | Remote DB Status | Files Modified | Test Verification |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| **CS-SEC-001** | Insecure RLS Policy on `family_circle_members` & Missing `search_path` | **P0** | **RESOLVED** | **PENDING SQL EXECUTION** | `backend/supabase/migrations/20261116000000_harden_family_safety_rls.sql`, `backend/src/services/family-safety/family-safety.service.ts` | `backend/tests/red-team-security.test.ts` |
| **CS-SEC-002** | Domain Suffix Matching Bypass in Extension Brand Heuristics | **P0** | **RESOLVED** | N/A (Client Engine) | `extension/heuristics.js` | `extension/tests/heuristics.test.js` |
| **CS-SEC-003** | Unvalidated UUID Route Parameters in `family-safety.routes.ts` | **P1** | **RESOLVED** | N/A (API Routing) | `backend/src/routes/family-safety.routes.ts` | `backend/tests/red-team-security.test.ts` |
| **CS-SEC-004** | Missing Rate Limiters on Family Safety Sensitive Endpoints | **P1** | **RESOLVED** | N/A (Rate Limiting Layer) | `backend/src/services/rate-limiting/rate-limiter.service.ts`, `backend/src/routes/family-safety.routes.ts` | `backend/tests/red-team-security.test.ts` |
| **CS-SEC-005** | Non-Strict Schema on Call Scanner Transcript Payload | **P2** | **RESOLVED** | N/A (Zod Schema) | `backend/src/routes/call-scanner.routes.ts` | `backend/tests/red-team-security.test.ts` |
| **CS-SEC-006** | Test-Only Auth Context Isolation in `scannerAuth` | **P1** | **RESOLVED** | N/A (Auth Middleware) | `backend/src/middleware/scannerAuth.ts` | `backend/tests/red-team-security.test.ts` |

---

## 3. REMAINING STRATEGIC REMEDIATION TASKS BY PRIORITY

### PHASE 1 — PRE-LAUNCH DATABASE & INFRASTRUCTURE RIGOR (P1)

#### Task 1.1: Production Database Migration Deployment (ACTION REQUIRED)
- **Status:** **PENDING OPERATOR EXECUTION IN SUPABASE DASHBOARD**
- **Objective:** Apply migration batch (`20261115000000_create_family_safety.sql` and `20261116000000_harden_family_safety_rls.sql`) to the remote Supabase project.
- **Probe Evidence:** Remote probe verified that `family_circles` table (PGRST205) and `join_family_circle_with_invite` RPC (PGRST202) are not yet created on the remote instance.
- **Action Items:**
  1. Open the Supabase Dashboard for the linked project.
  2. Navigate to **SQL Editor** -> **New Query**.
  3. Paste and execute the SQL block documented in Section 6 of `CYBERSAATHI_RED_TEAM_SECURITY_REPORT.md`.
  4. Confirm that `public.is_circle_member` executes with `SET search_path = ''`.
  5. Confirm `public.join_family_circle_with_invite` returns success on valid pairing tokens.
- **Owner:** Database Administrator / Release Engineer.

#### Task 1.2: Distributed Redis Cluster Provisioning
- **Status:** Staged in code (`ioredis` fallback to memory store operational).
- **Objective:** Ensure multi-instance horizontally scaled deployments share rate limit state.
- **Action Items:**
  1. Provision a managed Redis instance (e.g. Redis Enterprise, Upstash, or AWS ElastiCache) with TLS enabled.
  2. Populate `REDIS_URL=rediss://default:<password>@<host>:<port>` in the production secret store.
  3. Verify that `ioredis` establishes a connection without falling back to memory store.
- **Target Completion:** Prior to multi-pod deployment.
- **Owner:** Cloud Platform Engineer.

---

### PHASE 2 — EDGE & NETWORK DEFENSE-IN-DEPTH (P2)

#### Task 2.1: Cloudflare / Edge WAF Rate Limiting Parity
- **Objective:** Block automated volumetric attacks before they hit Node.js processes.
- **Action Items:**
  1. Configure Edge WAF rate limiting rules mirroring Express policies:
     - `/api/family-safety/join`: 10 requests / 60 seconds per IP.
     - `/api/call-scanner/analyze-transcript`: 15 requests / 60 seconds per IP.
     - `/api/scanner/analyze`: 20 requests / 60 seconds per IP.
  2. Implement Challenge / Managed Turnstile on requests exceeding threshold.
- **Target Completion:** 2 weeks post-launch.
- **Owner:** Security Operations Engineer.

#### Task 2.2: Content Security Policy (CSP) Reporting Integration
- **Objective:** Detect unauthorized script injection attempts or DOM manipulation in real-time.
- **Action Items:**
  1. Configure `report-uri /api/security/csp-report` in Helmet CSP headers.
  2. Implement a rate-limited ingestion handler that logs CSP violations to the Security Operations Center (SOC) dashboard.
- **Target Completion:** Sprint 2.
- **Owner:** Frontend & Security Architect.

#### Task 2.3: Restrict Production CORS Allowed Origins
- **Objective:** Prevent cross-origin request forgery from arbitrary websites.
- **Action Items:**
  1. In `backend/src/app.ts`, verify that `cors({ origin: env.allowedOrigins })` strictly validates against authorized domains:
     - `https://cybersaathi.org`
     - `https://app.cybersaathi.org`
     - Browser extension origin `chrome-extension://<verified_extension_id>`
  2. Disallow wildcards (`*`) in production mode.
- **Target Completion:** Prior to production domain cutover.
- **Owner:** Backend Lead.

---

### PHASE 3 — DEVSECOPS & CONTINUOUS ASSURANCE (P3)

#### Task 3.1: GitHub Actions Automated Security Pipeline
- **Objective:** Enforce zero regressions on every commit and pull request across all 114 tests.
- **Action Items:**
  Configure `.github/workflows/ci.yml` to run the following sequentially:
  ```yaml
  name: CyberSaathi Security & Quality Pipeline
  on: [push, pull_request]
  jobs:
    verify:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: 22
        # Dependency Auditing
        - run: npm audit --audit-level=high
        # Type Safety Verification
        - run: npm --prefix backend run typecheck
        - run: npm --prefix frontend run build
        # Automated Testing (114 Tests)
        - run: npm --prefix backend test
        - run: npm --prefix frontend test
        - run: npm --prefix extension test
  ```
- **Target Completion:** Next release cycle.
- **Owner:** DevOps / QA Engineer.

#### Task 3.2: Automated Secret Detection (Git Pre-Commit Hook)
- **Objective:** Prevent accidental commit of API keys, VAPID private keys, or Supabase service keys.
- **Action Items:**
  1. Install `git-secrets` or `gitleaks` in developer environments and CI.
  2. Configure pattern detection for Gemini API keys (`AIza...`), VAPID private keys, and JWT secrets.
- **Target Completion:** Immediate.
- **Owner:** Application Security Engineer.

---

## 4. ONGOING AUDIT & THREAT MODELING CADENCE

| Activity | Frequency | Description / Deliverable |
| :--- | :--- | :--- |
| **Dependency CVE Scan** | Weekly (Automated) | Dependabot & `npm audit` checks for known library exploits. |
| **Heuristic Pattern Update** | Bi-weekly | Ingestion of new Indian scam phrases (digital arrest variations, parcel customs scams, loan harassment). |
| **Cloud Configuration Audit** | Monthly | Review of Supabase RLS policies, bucket access rules, and Redis security groups. |
| **External Penetration Testing** | Bi-annually | Third-party grey-box assessment and red team review against production endpoints. |

---

## 5. SIGN-OFF & GOVERNANCE

| Role | Responsibility | Status |
| :--- | :--- | :---: |
| **Principal Security Architect** | Vulnerability discovery, PoC validation, code hardening | **APPROVED** |
| **Backend Engineering Lead** | Route parameters, RLS migration, rate limiting implementation | **APPROVED** |
| **QA Automation Lead** | 114 automated tests, build verification, regression suite | **APPROVED** |
