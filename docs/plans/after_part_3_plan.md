# Project Overview — After Part 3 (Supabase Auth + PostgreSQL Cutover Complete)

**Date:** 2026-09-22
**Status:** Parts 1–3 complete. Supabase PostgreSQL connected with all migrations
applied. Supabase Auth (email/password + Google) is the only application
authentication system. Legacy Django/SimpleJWT token auth removed.

---

## 1. What Rememberly is

AI context-aware note-taking web app. Capture raw notes first, then organize
them with Groq AI (review → correct → confirm) or manually. Confirmed items
surface as Tasks, Events, Shopping, and Expenses.

## 2. Stack

| Layer    | Technology                                                              |
|----------|-------------------------------------------------------------------------|
| Frontend | React 18, React Router 7, Vite 6, Vitest 2, Playwright                  |
| Backend  | Django 5.2.7, DRF 3.16.1, `dj-database-url`, `psycopg` 3.2             |
| Auth     | Supabase Auth, `PyJWT` + `cryptography`, JWKS verification              |
| Database | Supabase PostgreSQL (session pooler, port 5432, SSL require)            |
| AI       | Groq (`groq` SDK 1.7, `jsonschema` validation), session-only BYOK       |
| Timezone | `Asia/Dhaka`, default currency `BDT`                                    |

## 3. Repository map

```text
backend/
  accounts/       Supabase identity: AppUser, UserAuthIdentity, UserPreference,
                  AdminProfile, AdminAuditEvent, JWT auth, provisioning, /auth/me/
  notes/          Notes, Domains, NoteItems, AIProcessingLog, revision services,
                  ownership + Part 3 tests
  ai/             Groq service (analyze_note, redact, ProviderFailure), output schema
  config/         settings (PostgreSQL, Supabase, CORS, DRF), urls
  run_e2e.py      Disposable E2E runner with deterministic mock provider
frontend/src/
  api/            supabaseClient, authApi, http (Bearer), notesApi, itemsApi
  components/     GoogleSignInButton
  context/        AuthContext, NotesContext, AppStateContext, AiKeyContext (BYOK)
  features/       AIReviewPanel, AiProviderCard, ItemPages, ItemFields + tests
  App.jsx         routes incl. /auth/callback and /reset-password
docs/
  plans/          part-01..06 (history), revised/ (parts 4, 4.5, 5, 6 roadmap)
  the_final_plan_before_build/  future-proof DB + Part 3 final plans
  authentication.md, database-migration.md, api.md, architecture.md, erd.md
```

## 4. Authentication (Supabase-only)

```text
Google / email login → Supabase Auth → access JWT →
Authorization: Bearer <jwt> → Django JWKS verification →
UserAuthIdentity(issuer, subject) → AppUser UUID → owner-scoped queries
```

- Frontend: `supabaseClient.js` (publishable key only), `authApi.js`
  (sign-up, sign-in, session restore, sign-out, `resetPasswordForEmail`,
  `updateUser`, `signInWithOAuth google` → `/auth/callback`).
- Backend: `accounts/authentication.py` verifies signature via Supabase JWKS,
  enforces `ES256/RS256`, `aud=authenticated`, `iss={SUPABASE_URL}/auth/v1`,
  requires `exp/iat/iss/sub/aud`; failures are `401`.
- Provisioning (`accounts/services/provisioning.py`) is atomic: first login
  creates `AppUser + UserAuthIdentity + UserPreference`; repeat logins touch
  `last_seen_at`; non-`ACTIVE` users rejected; existing emails never silently
  merged.
- No passwords, refresh tokens, or Supabase secrets stored in app tables.
- Google sign-in verified manually end-to-end (Supabase reports `google: true`,
  authorize endpoint `302` to Google with correct callbacks).
- Django `auth/sessions` remains only for `/admin/`.

## 5. Database (Supabase PostgreSQL)

- Django connects via `DATABASE_URL` (session pooler, `:5432`, `sslmode=require`).
- Identity tables: `app_users` (UUID PK), `user_auth_identities`
  (unique `issuer + subject`), `user_preferences`, `admin_profiles`,
  `admin_audit_events`.
- Content: `notes_note` (required `app_user_id` FK, `raw_text` source of truth,
  `processing_status`, optimistic `revision`), `notes_noteitem` (typed items,
  date-only vs datetime kept separate, `NUMERIC` money, check constraints),
  `notes_domain` + M2M, `notes_aiprocessinglog`.
- Migration chain is clean: `accounts 0001–0003`, `notes 0001–0006`
  (`0006_make_app_user_sole_owner` removed legacy `Note.user`).
- Old SQLite demo data was discarded; Supabase started clean.
- Private content models are not registered in Django Admin.

## 6. Backend API (`/api/v1`)

| Method | Endpoint                              | Purpose                                  |
|--------|---------------------------------------|------------------------------------------|
| GET    | `/auth/me/`                           | Supabase-resolved `AppUser` profile      |
| GET/POST | `/notes/`, `/notes/:id/`            | Owner-scoped Notes CRUD (PATCH/DELETE)   |
| GET    | `/notes/:id/review/`                  | Note + draft/confirmed items + domains   |
| POST   | `/notes/:id/analyze/`                 | Groq analysis → validated drafts (6/min) |
| POST   | `/notes/:id/confirm-analysis/`        | Persist approved/manual item set         |
| GET/POST/PATCH | `/items/`, `/items/:id/`      | Confirmed items only; PATCH needs `revision` |

Cross-user access returns `404` (no existence disclosure); unauthenticated
returns `401`.

## 7. Part 3 AI organization

- Raw note text is never overwritten by AI; analysis creates unconfirmed drafts.
- Revision leases + conditional updates prevent stale writes (`409` on conflict);
  late provider responses are superseded, never applied blindly.
- Provider failures return sanitized 5xx; raw note and old drafts preserved.
- BYOK: personal Groq key lives only in browser memory for the session, sent via
  `X-Groq-Api-Key` header on analyze only, never persisted or logged
  (`AiKeyContext`, `AiProviderCard`).
- Deterministic fixtures (`notes/test_fixtures.py`) back unit, browser, and E2E tests.

## 8. Frontend routes and state

- Public: `/login`, `/register`, `/forgot-password`, `/reset-password`,
  `/auth/callback`.
- Protected `/app/*`: dashboard, notes (+ new/detail), tasks, events, shopping,
  expenses, places, search, settings.
- `AuthContext` restores Supabase session and subscribes to auth changes;
  `NotesContext` loads owner notes; Groq key cleared on logout/account switch.

## 9. Testing (all green at cutover)

- Backend: **51 tests pass** (`manage.py test --keepdb -v 1`; `--keepdb` because
  the pooler cannot drop `test_postgres`).
- Frontend: **27 tests pass** (`npm test`), production build passes
  (`npm run build`).
- `makemigrations --check`: no changes; `manage.py check`: clean;
  `git diff --check`: clean.
- Supabase ownership tests cover create/list scoping and cross-user `404`s;
  JWT unit tests cover valid ES256 tokens and wrong-issuer rejection.

## 10. Environment configuration

Tracked examples contain placeholders only. Ignored local files hold secrets:

- `backend/.env`: `DATABASE_URL` (pooler URL, URL-encoded password),
  `DATABASE_SSL_REQUIRE=true`, `SUPABASE_URL`, `SUPABASE_JWKS_URL`,
  optional `GROQ_API_KEY`.
- `frontend/.env`: `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY` (browser-safe; never secret/service-role keys).

## 11. Removed in this cutover

`djangorestframework-simplejwt`, token blacklist app/tables, legacy
`register/login/refresh/logout/password-reset` endpoints and serializers,
`SUPABASE_AUTH_ENABLED` / `VITE_SUPABASE_ENABLED` flags, legacy
`Note.user` FK, and local Supabase skill tooling (`.agents/`, `.claude/`,
`agent/`, `skills-lock.json`).

## 12. Deferred / next

Per `docs/plans/revised/`: Part 4 (Next.js hybrid search + strict RAG),
Part 4.5 (transactions/personalization/onboarding), Part 5 (reminders/location),
Part 6 (production). Open schema work: explicit `NoteItemDomain` through model,
AI run/artifact split, UUID PKs for user-owned content, pgvector embeddings.

## 13. Local run and verify

```bash
cd /mnt/d/A1/my_note/backend
.venv/bin/python manage.py check
.venv/bin/python manage.py showmigrations accounts notes
.venv/bin/python manage.py test --keepdb -v 1
.venv/bin/python manage.py runserver
```

```bash
cd /mnt/d/A1/my_note/frontend
npm test && npm run build
npm run dev   # http://localhost:5173
```

Verify data in Supabase **Table Editor** (`public` schema: `app_users`,
`user_auth_identities`, `notes_note`) or **SQL Editor** by matching
`/auth/me/` id against `notes_note.app_user_id`.
