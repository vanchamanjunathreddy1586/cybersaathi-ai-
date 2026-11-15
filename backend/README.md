# CyberSaathi AI Backend

The backend foundation for CyberSaathi AI — **Your Digital World. Our Protection.**

## Requirements

- Node.js 18 or newer
- npm

## Install dependencies

From this directory, install the dependencies declared by `package.json`:

```bash
npm install
```

The backend dependencies are already present in this project; do not install them again unless the package manifest changes.

## Configure the environment

Copy `.env.example` to `.env`, then set:

- `PORT`: HTTP port (defaults to `3001`).
- `NODE_ENV`: `development`, `test`, or `production`.
- `FRONTEND_URL`: the frontend's complete origin, for example `http://localhost:5173`.
- `ALLOWED_ORIGINS`: optional comma-separated list of additional complete origins.
- `SUPABASE_URL`: the Supabase project URL.
- `SUPABASE_PUBLISHABLE_KEY`: the project's publishable key. Do not use a secret or service-role key.
- `GOOGLE_SAFE_BROWSING_API_KEY`: optional server-only URL reputation integration.
- `VIRUSTOTAL_API_KEY`: optional server-only URL reputation integration. The scanner only looks up an existing report; it does not submit new URLs.
- `AI_API_BASE_URL`, `AI_API_KEY`, and `AI_MODEL`: optional OpenAI-compatible endpoint used by the Academy tutor, verified-evidence summaries, investigation analysis, and CyberSaathi Assistant. Keep the key backend-only.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`: optional Web Push configuration. Keep the private key in the backend environment only.

The backend allows requests from `FRONTEND_URL` and `ALLOWED_ORIGINS`. It does not use a wildcard CORS origin. Keep `.env` private and never place backend secrets in frontend configuration.

Supabase configuration is optional for server startup. Apply all SQL files in `supabase/migrations/`, including `20261107000000_create_scan_results.sql`, before using database-backed scanner features. The scan-results migration enables RLS, permits authenticated users to select/insert/delete only their own rows, and stores evidence without the submitted message or URL content. `GET /api/health/supabase` performs a `SELECT` for the seeded health-check row using the publishable key and anon role.

Apply `20261108000000_create_investigations.sql` before using the Investigation Room. It creates account-owned cases, append-only timeline events, and evidence metadata with RLS. It also creates a private `investigation-evidence` Storage bucket with a 10 MB limit and an allowlist of document/image MIME types. The browser uploads only explicitly selected files and calculates SHA-256 locally; the server does not independently verify the supplied hash or inspect/execute file contents. A case export is generated locally as a PDF from the saved timeline and evidence metadata.

Optional investigation AI analysis requires the existing `AI_API_BASE_URL`, `AI_API_KEY`, and `AI_MODEL`. Each analysis requires explicit user consent. Only case title/description, user-authored timeline notes, and evidence metadata are sent to the configured provider; file bytes are never sent. AI results are validated, are not stored, and must be treated as unverified. If AI is unconfigured or unavailable, the investigation room remains usable without AI.

Apply `20261112000000_create_ai_assistant.sql` after the Academy, scanner, and investigation migrations. It creates account-owned conversations and messages with RLS and a narrowly scoped function that returns only the authenticated user's own Academy progress and latest quiz review. CyberSaathi Assistant uses the same OpenAI-compatible backend provider settings as the existing AI features; it does not add another provider or browser credential. User messages are saved to Supabase after a valid AI response. A user must explicitly select a saved scan, investigation, or Academy lesson before that private context is sent; selected scan summaries omit submitted content, selected investigation context contains only limited timeline summaries and evidence counts, and lesson selection includes public lesson text plus that user's own progress/review. Evidence file bytes are never sent. Messages are sent to the configured external AI provider and stored until the user deletes the conversation. Provider responses are untrusted guidance, not a confirmed security action.

Nexconn integration is optional. Configure `NEXCONN_APP_KEY`, `NEXCONN_APP_SECRET`, and `NEXCONN_API_REGION` (`sg` or `us`) in the backend environment. The App Secret must remain server-only. Nexconn user IDs are derived from the authenticated Supabase ID, and the backend issues a Nexconn token on demand using the region-specific signed API. Tokens are held in memory by the browser SDK and are not written to Supabase. Calling is disabled by default; enable audio/video calling in the Nexconn Console and set `NEXCONN_CALLS_ENABLED=true` only after that service is active. The web integration currently supports Singapore and North America SDK area codes.

The official Nexconn release notes/documentation lists Chat and Engine `26.2.1`, ChatUI `26.2.5`, and Call `26.2.1`. The current Call package declares an exact `26.2.0` peer requirement while ChatUI requires `26.2.1`; these documented releases build together, but npm's strict peer resolver rejects them. `frontend/.npmrc` records the required `legacy-peer-deps` setting; the frontend production build was verified against this set. Nexconn ChatUI is not tuned for portrait mobile layouts; the community page calls this out and remains responsive around the SDK UI.

The scanner does not fetch submitted URLs, resolve their DNS, follow redirects, or inspect TLS certificates. This is intentional SSRF protection; those checks are explicitly reported as unavailable. Configured reputation lookups are only run after the user opts in from the scanner UI. Unconfigured or failed providers are reported as unavailable, never as clean.

Risk is deterministic: indicator point values are defined alongside the matching rules, summed and capped at 100; provider-confirmed malicious findings contribute 100 points, and the VirusTotal suspicious aggregate contributes 30. Risk bands are 0–29 low, 30–59 medium, 60–79 high, and 80–100 critical. Confidence is separate: confirmed provider threats score 95; clean provider checks start at 65 plus 8 per provider (capped at 90); heuristic evidence starts at 45 plus 5 per positive indicator (capped at 75); no positive evidence and no clean external check yields 30. A score of zero without clean external checks is still inconclusive.

## Run in development

```bash
npm run dev
```

The server restarts when source files change.

## Build

```bash
npm run typecheck
npm run build
```

Compiled JavaScript is written to `dist/`.

## Start in production

Set production environment variables, build the backend, then run:

```bash
npm start
```

The server handles `SIGINT` and `SIGTERM` with a graceful shutdown.

## API endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/health/supabase` | Supabase database health-check query |
| `POST` | `/api/scanner/analyze` | Authenticated deterministic URL, SMS, email, or decoded-QR analysis |
| `GET` | `/api/scanner/history` | Authenticated scan history |
| `GET` | `/api/scanner/history/:id` | Authenticated saved report |
| `DELETE` | `/api/scanner/history/:id` | Delete the authenticated user's saved report |
| `GET` | `/api/investigations` | List the authenticated user's investigations |
| `POST` | `/api/investigations` | Create an investigation |
| `GET` | `/api/investigations/:id` | Read a case, timeline, and evidence metadata |
| `PATCH` | `/api/investigations/:id` | Update case details/status |
| `DELETE` | `/api/investigations/:id` | Delete a case and its private evidence objects |
| `POST` | `/api/investigations/:id/notes` | Append a user-authored timeline note |
| `POST` | `/api/investigations/:id/evidence` | Register metadata for an uploaded private file |
| `DELETE` | `/api/investigations/:id/evidence/:evidenceId` | Delete a private evidence object and metadata |
| `POST` | `/api/investigations/:id/analyze` | Consent-gated, optional AI analysis |
| `GET` | `/api/assistant/conversations` | List the authenticated user's conversations |
| `POST` | `/api/assistant/conversations` | Create an assistant conversation |
| `GET` | `/api/assistant/conversations/:id` | Read an owned conversation and its messages |
| `POST` | `/api/assistant/conversations/:id/messages` | Send a rate-limited message to the configured AI provider |
| `DELETE` | `/api/assistant/conversations/:id` | Delete an owned conversation and its messages |
| `GET` | `/api/assistant/context-options` | List the user's saved scans, cases, and Academy lessons that may be selected |
| `GET` | `/api/nexconn/configuration` | Authenticated Nexconn configuration status |
| `POST` | `/api/nexconn/session` | Issue an authenticated user's Nexconn token |

Scanner endpoints require `Authorization: Bearer <Supabase access token>`. A scan request is limited to 8,000 characters, and analysis is rate-limited to 10 requests per minute per client IP. External provider credentials and optional AI endpoint credentials must remain backend-only. The frontend reads `VITE_API_BASE_URL` for the API origin and defaults to `http://localhost:3001`; configure it for the deployed backend and allow the deployed frontend origin in `ALLOWED_ORIGINS`.

## Validate

```bash
npm run typecheck
npm test
npm run build
```

Successful health response:

```json
{
  "success": true,
  "message": "CyberSaathi AI backend is running",
  "status": "healthy"
}
```
# Web Push notifications

Background Web Push is optional. Configure all three backend-only variables
before enabling subscriptions:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (a `mailto:` contact or HTTPS URL)

Generate a VAPID key pair with `npx web-push generate-vapid-keys` in a trusted
environment. Store the private key only in the backend environment; never put
it in a `VITE_` variable, source file, or browser storage. Apply
`supabase/migrations/20261111000000_add_web_push_subscriptions.sql` before
enabling subscriptions. Without these values, the application reports push as
unavailable and does not create a subscription.
