# Part 2 Testing and Corrections

## Status

Completed and verified on September 21, 2026.

## Verification executed

- `backend/.venv/bin/python manage.py check`: passed with no issues.
- `backend/.venv/bin/python manage.py makemigrations --check --dry-run`: passed with no model changes.
- `backend/.venv/bin/python manage.py test --verbosity 2`: 17 tests passed.
- `npm test`: 9 React integration tests passed.
- `npm run test:coverage`: passed with 89.71% statements and 79.74% branches across measured frontend files.
- `npm run build`: Vite production build passed.
- `npm run test:e2e`: one Chromium full-stack test passed against Django and SQLite.
- `backend/.venv/bin/python -m pip check`: passed with no broken requirements.
- `npm audit --omit=dev`: passed with zero production dependency vulnerabilities.

Backend coverage includes registration validation, login, current user, rotating refresh, logout, JSON-only auth requests, generic password reset, password reset token validation, revocation of pre-reset access and refresh tokens, Note defaults and cascade behavior, CRUD status codes, unauthenticated rejection, admin access, and mandatory User A/User B read/update/delete isolation.

Frontend coverage includes session restoration, protected-route redirects, login success and API errors, registration/logout, Notes loading/error states, direct Note detail retrieval, CRUD, account-switch cache isolation, generic password-reset messaging, and continued mock behavior for later pages.

The browser test registers a unique user, creates a Note, reloads to prove persistence, edits and reloads again, deletes and reloads again, logs out, verifies route protection, and logs back in.

## Corrections made during verification

- Replaced the obsolete Part 1 mock-only test harness with real provider and mocked-API integration tests.
- Removed simulated AI extraction from newly persisted Notes; real Notes remain `UNPROCESSED`.
- Added protected routes and auth bootstrap loading so `/app/*` does not render before session restoration.
- Added forgot-password and reset-password UI routes.
- Cleared the in-memory access token when session restoration fails.
- Serialized concurrent refresh attempts to prevent refresh-token rotation races, including React Strict Mode startup.
- Added an unauthorized callback so an unrecoverable refresh failure clears React authentication and cached Notes.
- Made local logout clear React state and redirect even when the server request fails.
- Reloaded Notes when the authenticated user ID changes, preventing one account's cached Notes from appearing after an account switch.
- Added direct detail API retrieval instead of relying only on the list response.
- Added visible errors for Note list/create/update/delete failures and cleared stale errors after successful requests.
- Restricted DRF API parsing to JSON; cross-origin form posts cannot invoke auth endpoints without a CORS preflight.
- Enabled SimpleJWT password-change revocation and blacklisted all outstanding refresh tokens after a password reset.
- Updated production email backend selection so non-debug deployments default to SMTP rather than console output.
- Replaced the old browser test with a real full-stack persistent CRUD test and configured Playwright to launch Django and Vite.

## Acceptance reevaluation

All 17 Part 2 acceptance criteria pass. Authentication and Notes are real; SQLite persistence, protected routes, current-user state, CRUD, ownership scoping, User A/User B API isolation, admin registration, component tests, and the browser flow are verified. Later features remain mocked, and no AI, Groq, embeddings, vector database, location, maps, or notification implementation was added.

## Residual boundaries

- SQLite and the console email backend are development defaults. Production deployment configuration belongs to Part 6.
- Django's built-in User model does not make `email` database-unique; the public registration endpoint normalizes email and rejects duplicates, while `username` is set to that normalized email and is database-unique.
- Browser isolation is enforced and exhaustively tested at the API layer; the E2E test covers one account while React has a separate account-switch cache regression test.
