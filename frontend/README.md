# CyberSaathi AI frontend

The frontend is a React, TypeScript, and Vite application. Authentication uses
Supabase Auth directly from the browser; the browser bundle must contain only
the Supabase project URL and its public publishable key. Never use a Supabase
secret or service-role key in a `VITE_` variable.

## Local configuration

Copy `.env.example` to `.env.development` and set:

- `VITE_API_BASE_URL`: the Express backend origin (default local value:
  `http://localhost:3001`).
- `VITE_SUPABASE_URL`: the Supabase project URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: the project's publishable key (legacy anon
  key is also public, but do not use a secret/service-role key).

Vite environment files are ignored by Git. Restart Vite after changing them.
Authentication displays a configuration error and will not make auth requests
until the URL and publishable key are configured.

## Profile database setup

Apply
`../backend/supabase/migrations/20261106010000_create_profiles.sql` to the
Supabase project using the Supabase CLI or SQL Editor. It creates a profile
record from the actual `auth.users` row on signup, enables RLS, and permits
authenticated users to read their own profile and update only its `full_name`.
It does not grant browser access to the health-check table or other application
tables. Existing Auth users are backfilled during migration.

## Email authentication redirects

In Supabase Authentication URL Configuration, set the local Site URL to
`http://localhost:5173` and allow the local redirect URLs
`http://localhost:5173/auth/callback` and
`http://localhost:5173/reset-password`. Add the corresponding deployed
frontend origins and paths before deploying.

## Google OAuth configuration

Google sign-in is implemented through Supabase Auth but is not enabled by this
repository alone. To configure it:

1. In Google Cloud Console, create an OAuth 2.0 Client ID with application
   type **Web application**.
2. Add the local frontend origin (`http://localhost:5173`) and your deployed
   frontend origin as authorized JavaScript origins.
3. Add the Supabase project's provider callback URL shown on the Supabase
   Google provider settings page as an authorized redirect URI. It is the
   Supabase Auth callback, not the frontend `/auth/callback` route.
4. Enable Google under Supabase Authentication providers and enter the Google
   Client ID and Client Secret there. Keep the Client Secret in Supabase; never
   put it in this repository or a `VITE_` variable.
5. Add `http://localhost:5173/auth/callback` and the deployed frontend callback
   to Supabase's allowed redirect URLs.

Google login is not considered configured or tested until those external
settings are saved and a real OAuth round trip succeeds.

## Commands

```bash
npm run dev
npm run lint
npm run build
```

## Install and offline use

The production build includes a web app manifest, application icons, and a
service worker. Service-worker installation requires HTTPS in production
(`localhost` is allowed for development). It caches the public application
shell and static assets only; API responses, authentication data, scans,
investigations, private messages, and learning progress are not cached.

The academy stores only the public course and lesson catalog locally after it
has been loaded once. Offline reading does not submit lesson completion,
quizzes, certificates, AI tutor requests, scans, or other live actions.

Background push is optional and requires the backend VAPID configuration and
the `web_push_subscriptions` database migration. The permission prompt appears
only after the user selects **Enable Web Push** in Security Center settings.
The repository does not include a static hosting/CDN deployment configuration;
the production host must enforce HTTPS and set an appropriate Content Security
Policy for the configured frontend, backend, and Supabase origins.

The `/` route is the public welcome page for visitors and the protected
dashboard for authenticated users. Available authentication routes are
`/login`, `/register`, `/forgot-password`, `/reset-password`, and
`/auth/callback`.

## CyberSaathi Assistant

The authenticated `/assistant` route provides English, Telugu, and Hindi
cybersecurity chat, browser speech input/output when supported, incident
response guidance, and saved conversation history. It uses the backend's
existing `AI_API_BASE_URL`, `AI_API_KEY`, and `AI_MODEL`; configure these only
on the backend. Apply
`../backend/supabase/migrations/20261112000000_create_ai_assistant.sql` after
the Academy, scanner, and investigation migrations. If the provider or
migration is unavailable, the assistant displays an error instead of
generating a placeholder answer.

Typed messages are sent to the configured AI provider and saved in the
authenticated user's Supabase account when a valid response is received.
Private scan, investigation, or lesson context is not included unless the user
selects it for that message. Avoid entering passwords, OTPs, full card numbers,
or authentication secrets. Conversation deletion removes its saved messages.
Voice input and playback depend on browser speech APIs and installed language
voices; microphone access is initiated only when the user selects **Speak**.
Speech recognition may send audio to the browser's speech service depending
on the browser and operating system. AI chat and voice features require an
internet connection.
