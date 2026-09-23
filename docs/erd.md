# Entity Relationship Design

## Implemented through Part 3 (current schema)

```text
AppUser (accounts)
  PK id UUID
  email, display_name, status, timezone, locale, default_currency
  timestamps + soft-delete/suspension fields
       1
       |
       | owns (ON DELETE CASCADE)
       |
       many
Note
  PK id
  FK app_user -> AppUser.id, NOT NULL, ON DELETE CASCADE
  raw_text, NOT NULL (non-blank enforced by API serializer)
  processing_status, NOT NULL, default UNPROCESSED
  is_archived, NOT NULL, default false
  revision, NOT NULL, default 0 (optimistic concurrency)
  analysis_started_at, nullable (analysis lease)
  created_at, updated_at, NOT NULL
```

Deleting an AppUser cascades to that user's Notes because Notes have no valid owner without the AppUser. All API querysets are also scoped to `request.user`; clients cannot assign owner IDs. Identity mapping lives in `UserAuthIdentity(issuer, subject)` → `AppUser`, with one `UserPreference` row per user.

> Historical note: Part 2 used Django's built-in `User` (username/email) as Note owner. Migration `notes.0006_make_app_user_sole_owner` removed the legacy FK; AppUser is now the sole owner.

## Part 3 structured intelligence

```text
Note 1 ─── many NoteItem
NoteItem many ─── many Domain
Note 1 ─── many AIProcessingLog

NoteItem
  PK id
  FK note -> Note.id, NOT NULL, ON DELETE CASCADE
  FK analysis_log -> AIProcessingLog.id, nullable, SET NULL
  item_type, title, summary, normalized_text
  start_date/due_date nullable
  start_datetime/due_datetime nullable, timezone-aware when present
  amount/currency/quantity/unit/place_hint nullable
  status, importance, confidence nullable
  is_confirmed, metadata, created_at, updated_at

Domain
  PK id
  unique name, unique slug

AIProcessingLog
  PK id
  FK note -> Note.id, NOT NULL, ON DELETE CASCADE
  FK source_log -> AIProcessingLog.id, nullable, SET NULL
  operation, model_name, prompt_version, note_revision
  input_text, raw_response, parsed_response, confirmed_response
  status, error_code, error_message, created_at, completed_at
```

Draft NoteItems have `is_confirmed=false`; normal item APIs expose only
confirmed items. Every new analysis has an append-only log. Confirmed items
are preserved when a Note is re-analyzed. Deleting a User cascades Notes,
which cascade NoteItems and AIProcessingLogs.

## Designed for later parts

```text
Note 1 -> many NoteItem
NoteItem many <-> many Domain
Note -> many AIProcessingLog
User -> many Place
User -> many Reminder
NoteItem -> optional NoteEmbedding
```

These tables are not implemented in Part 3 to avoid unused complexity:
`NoteEmbedding`, `Place`, and `Reminder`. PostgreSQL, vector search, RAG,
location, and dashboard intelligence are later parts.
