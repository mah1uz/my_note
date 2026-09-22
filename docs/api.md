# Part 3 API

Base URL: `/api/v1`

Request bodies must use `Content-Type: application/json`. Form-encoded API requests are rejected.

## Authentication

Supabase Auth is the only application authentication system. The frontend
signs users in with Supabase email/password or Google OAuth and sends the
Supabase access JWT as `Authorization: Bearer <token>`. Django verifies the
JWT with the Supabase JWKS endpoint and resolves it to the internal UUID
`AppUser`. There are no Django-issued access/refresh tokens and no
Django password-reset endpoints.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/auth/me/` | Return the Supabase-authenticated `AppUser` profile |
| PATCH | `/auth/me/` | Update `display_name`, `timezone`, `locale`, `default_currency` |
| GET | `/auth/preferences/` | Return the user's notification preferences |
| PATCH | `/auth/preferences/` | Update notification preferences and `week_starts_on` (0–6) |
| POST | `/auth/preferences/reset/` | Restore default profile values and notification preferences |
| GET | `/auth/settings/` | Return profile + preferences in one response for the Settings page |

Password recovery uses Supabase `resetPasswordForEmail` and `updateUser`
directly from the frontend.

## Notes

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/notes/` | List the current user's notes, newest first |
| POST | `/notes/` | Create an `UNPROCESSED` note for the current user |
| GET | `/notes/:id/` | Retrieve an owned note |
| PATCH | `/notes/:id/` | Update an owned note |
| DELETE | `/notes/:id/` | Delete an owned note |

Create payload:

```json
{ "raw_text": "Buy eggs from Agora" }
```

Another user's note is not present in the scoped queryset and therefore returns `404`, avoiding resource-existence disclosure.

## AI organization

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/notes/:id/review/` | Return an owned Note, its draft/confirmed items, and the seeded domain vocabulary |
| POST | `/notes/:id/analyze/` | Analyze the current raw Note with Groq and create validated unconfirmed drafts. Requires a credential: personal key via `X-Groq-Api-Key` or free trial via `X-Groq-Trial: true` (uses the server key); otherwise `400 credential_required` |
| POST | `/notes/:id/confirm-analysis/` | Validate and persist the user's approved/manual item set |

Analyze payload:

```json
{ "revision": 0 }
```

The optional session-only personal provider credential is sent in the
`X-Groq-Api-Key` request header on this endpoint only. It is never accepted in
the JSON body, URL, query string, or any other endpoint. The server-owned
`GROQ_API_KEY` is an optional fallback when this header is absent. Neither key
is returned, persisted, or written to processing logs. If neither is available,
the endpoint returns `503` with code `not_configured`.

Confirmation payload contains the current Note revision and full approved
items. Existing draft IDs may be included; omitting a draft removes it. The
server never trusts submitted owner IDs or `is_confirmed` flags.

```json
{
  "revision": 1,
  "items": [
    {
      "id": 4,
      "item_type": "TASK",
      "title": "Buy eggs",
      "domains": ["shopping"],
      "status": "PENDING",
      "importance": "NORMAL"
    }
  ]
}
```

Provider failure returns a sanitized 5xx response stating that the raw Note
was saved. Valid empty analysis is reviewable and never fabricates an item.
Confirmed items are never overwritten by a retry; only unconfirmed drafts are
replaced after a successful validated response.

## Confirmed NoteItems

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/items/` | List only confirmed current-user items |
| GET | `/items/:id/` | Retrieve one confirmed owned item |
| PATCH | `/items/:id/` | Update a confirmed item with its current Note revision |

Supported list filters are `type`, `domain`, and `status`. Draft items are
available only through their owned Note review endpoint. Item PATCH requires a
`revision` and rejects stale writes with `409`.

## Part 3 data boundaries

Tasks, Events, Expenses, and Shopping now read confirmed NoteItems. Shopping
groups pending Shopping-domain tasks by their free-text `place_hint`; saved
Places and location matching remain a later Part 5 feature. Expense arithmetic
and the final expense dashboard remain outside this Part 3 baseline.
