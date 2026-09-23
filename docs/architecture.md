# Application Architecture

## Part 3.4 / 3.5 transition

```text
React/Vite (localhost:5173)
  | Supabase Auth session + JSON over /api/v1
  | Authorization: Bearer <Supabase access token>
  v
Django REST Framework (localhost:8000)
  | JWKS verification -> UserAuthIdentity -> AppUser UUID
  | Django ORM + validated Groq service (backend only)
  v
Supabase PostgreSQL
```

Supabase Auth is the target identity provider for email/password and Google.
Raw Notes remain real. Groq organization is requested only
after a Note is saved: React → DRF ownership check → backend Groq service →
schema validation → draft NoteItems → React review → user confirmation →
confirmed NoteItems. `Note.raw_text` remains the source of truth.

Tasks, Events, and Expenses now use confirmed NoteItems. Shopping groups
confirmed pending Shopping tasks by text `place_hint`. Places, Search, Daily
Briefing, and What Matters Now remain mock/deferred features. PostgreSQL is
required before Part 4.

The access token is held in React memory within the Supabase SPA session; Supabase JS manages session refresh. There is no Django-issued refresh endpoint, no HttpOnly refresh cookie, and no token blacklist (legacy token tables were removed). On browser reload, React restores the Supabase session and calls `/auth/me/` before deciding whether a protected route may render.

An unrecoverable session failure clears authenticated React state and cached Notes. The API accepts JSON request bodies only. Combined with the restricted development CORS allowlist, this prevents cross-origin HTML form submissions from invoking authentication endpoints.

New persisted Notes remain `UNPROCESSED`. Part 2 does not simulate AI extraction for those notes.

AI failures leave the raw Note saved and mark it `FAILED`; users can retry or
organize manually. AI logs are append-only records and are not registered in
Django Admin nor exposed through normal user APIs. The optional server Groq key is
backend-only. A personal user key can be held in React memory for the current
session and sent only as `X-Groq-Api-Key` to Django's analyze endpoint; Django
calls Groq and never persists the credential.
