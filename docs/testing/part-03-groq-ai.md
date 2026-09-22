# Part 3 Testing and Corrections

## Status

Implemented and verified on September 21, 2026. Routine tests use mocked Groq
responses; the browser suite uses a disposable SQLite database and an
explicit test-only provider fixture. No live credential is used or stored by
automated tests.

## Planned verification

- Schema validation for valid and malformed AI responses.
- Deterministic mock tests for event, task, expense, information, and multi-item extraction.
- Ambiguous-input tests that prevent invented facts.
- Timeout, invalid JSON, provider-error, retry, and manual-fallback tests.
- Tests proving the raw Note remains available after AI failure.
- Review, edit, remove, and confirm interaction tests.
- User-isolation tests for analyze and confirm operations.

## Verification executed

- `backend/.venv/bin/python manage.py check`: passed with no issues.
- `backend/.venv/bin/python manage.py makemigrations --check --dry-run`: passed.
- `backend/.venv/bin/python manage.py test`: 51 tests passed.
- `frontend/npm test`: 27 tests passed.
- `frontend/npm run test:coverage`: passed with 94.14% statements and 85.9% branches.
- `frontend/npm run build`: passed.
- `frontend/npm run test:e2e`: 4 Chromium tests passed.
- E2E covered real Django/SQLite registration, analysis, review, correction,
  confirmation, reload persistence, task/event/expense/shopping pages,
  provider failure, manual fallback, mobile layout, empty review, raw-note
  preservation, and User A/User B API isolation.
- BYOK security tests cover request-key precedence, server fallback,
  provider-not-configured behavior, invalid-key sanitization, database
  non-persistence, in-memory frontend state, logout/remount clearing, and
  analyze-only header transport.
- Backend fixtures covered valid and malformed schemas, all required examples,
  ambiguity, provider failure classes, retries, stale writes, deletion during
  analysis, confirmation validation, model constraints, and domain seed data.

## Corrections recorded so far

- The Part 3 plan was updated to require mocked Groq responses in ordinary tests.
- Session-only user BYOK was added without a database field or migration.

## Corrections made during implementation

- Added explicit revision checks so delayed analysis results cannot overwrite
  a Note edited or deleted while the provider request is in flight.
- Kept date-only facts separate from timed datetimes so unknown times are not
  represented as invented midnight values.
- Added a bounded processing lease to prevent concurrent analysis races while
  allowing abandoned analyses to be retried.
- Added strict provider JSON/schema validation before draft persistence.
- Added backend re-validation for every client confirmation and manual item.
- Added read-only Admin views for Domain, NoteItem, and AIProcessingLog while
  keeping logs out of normal user APIs.
- Added a test-only mocked provider for Playwright; production never enables it.
- Added optional server-key fallback and a Dashboard session-only personal-key
  card. Browser tests use synthetic values only and never inspect secret input
  values, request headers, browser state, screenshots, or reports.

## Residual boundaries

- The current model uses Groq JSON object mode with server-side validation;
  strict provider constrained decoding is not assumed for the selected
  `llama-3.3-70b-versatile` model.
- Confirmed Tasks, Events, Expenses, and text-hint Shopping are real. Places,
  location matching, advanced expense aggregation, semantic search, RAG,
  reminders, and dashboard intelligence remain later parts.
- A provider key must be rotated if it has ever been exposed outside the
  backend secret environment.
