# Application Architecture

## Part 2

```text
React/Vite (localhost:5173)
  | JSON over /api/v1
  | Authorization: Bearer <access token>
  v
Django REST Framework (localhost:8000)
  | Django ORM
  v
SQLite (development)
```

Authentication and Notes are real in Part 2. Tasks, Events, Shopping, Expenses, Places, Search, Daily Briefing, and What Matters Now remain mock frontend features.

The access token is held in React memory. The refresh token is kept in an HttpOnly, SameSite cookie and is never exposed to JavaScript. On browser reload, React calls the refresh endpoint and then `/auth/me/` before deciding whether a protected route may render.

Refresh requests are shared while one is in flight so rotating tokens cannot race. An unrecoverable refresh failure clears authenticated React state and cached Notes. Password changes invalidate existing access tokens and blacklist outstanding refresh tokens.

The API accepts JSON request bodies only. Combined with the restricted development CORS allowlist and the refresh cookie's `SameSite=Lax` policy, this prevents cross-origin HTML form submissions from invoking authentication endpoints.

New persisted Notes remain `UNPROCESSED`. Part 2 does not simulate AI extraction for those notes.
