# FINAL PART 3 SECURITY + LIVE PROVIDER COMPLETION PLAN

Status: Approved for implementation. This is the final Part 3 security and
live-provider completion work only. Part 4 remains out of scope.

## Scope guard

Do not add PostgreSQL, pgvector, embeddings, semantic search, RAG, locations,
reminders, What Matters Now, Daily AI Briefing, or any other Part 4–6 feature.
Keep SQLite and the existing mocked-provider browser test strategy.

## Goals

1. Verify `backend/.env` is ignored, private, and untracked.
2. Prove provider credentials never enter Git, frontend environment variables,
   logs, database records, fixtures, screenshots, or generated reports.
3. Add a session-only user-owned Groq API key (BYOK) option.
4. Resolve credentials as user request key, then optional server fallback.
5. Preserve raw Notes and existing Part 2/Part 3 behavior on every failure.
6. Add automated security/regression coverage and a safe manual live smoke test.

## Secret design

The browser stores a user key only in a React in-memory context. It is never
written to localStorage, sessionStorage, cookies, URLs, query parameters,
Vite variables, notes, items, users, AIProcessingLogs, analytics, fixtures,
screenshots, or reports. The key is sent only as `X-Groq-Api-Key` on the
authenticated analyze endpoint. Django passes the selected key explicitly to
the Groq service. React never calls Groq directly.

Resolution order:

1. `X-Groq-Api-Key` on `POST /api/v1/notes/:id/analyze/`.
2. Optional backend `GROQ_API_KEY`.
3. Sanitized `not_configured` provider error.

The server key remains in ignored `backend/.env` or deployment environment.
`backend/.env.example` contains placeholders only. No database migration or
credential column is needed.

## Backend implementation

- Extend `groq_service.analyze_note` with an explicit optional `api_key`.
- Redact both server and request keys plus Groq-shaped values before any
  persisted response/error text.
- Read `X-Groq-Api-Key` only in the analyze action; do not accept it on review,
  confirmation, item, note, or unrelated endpoints.
- Pass it through the existing service boundary without persistence.
- Keep provider failures sanitized and preserve raw Notes.
- Permit the custom header through development CORS configuration.

## Frontend implementation

- Add a dedicated in-memory `AiKeyContext` with set/clear operations.
- Add an authenticated Dashboard AI Provider card with a password field,
  optional show/hide control, session-only status, and clear action.
- Clear the key on logout and naturally on hard refresh/remount.
- Add the header only to `analyzeNote`; all unrelated requests remain clean.
- Never repopulate the input with the submitted key.
- Display the clear provider-not-configured message without echoing secrets.

## Tests

Backend tests cover header forwarding, user-key precedence, server fallback,
missing credentials, invalid-key redaction, database non-persistence, and
existing user isolation. Frontend tests cover in-memory-only state, logout and
remount clearing, password UX, analyze-only header behavior, and errors.
Browser tests continue using the mocked provider and never inspect secret input
values, headers, browser state, screenshots, or reports.

## Verification

Run the safe secret scan and:

- `manage.py check`
- `manage.py test`
- `manage.py makemigrations --check --dry-run`
- `pip check`
- `npm test`
- `npm run test:coverage`
- `npm run build`
- `npm run test:e2e`

Lint is reported only if no project lint script exists.

## Manual smoke test

The user enters a newly rotated Groq key manually in the Dashboard password
field, clicks “Use for this session,” and runs the six supplied Part 3 notes.
The key must never be pasted into chat, source, documentation, shell commands,
logs, browser consoles, Playwright code, screenshots, or reports. Verify one
flow through analyze, review, edit, confirm, refresh, and Tasks/Events/Expenses/
Shopping persistence. Clear and re-enter after refresh to verify session-only
behavior.
