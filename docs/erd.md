# Entity Relationship Design

## Implemented through Part 3

```text
Django User
  PK id
  unique username
  normalized email (duplicate registration rejected by API)
       1
       |
       | owns
       |
       many
Note
  PK id
  FK user -> User.id, NOT NULL, ON DELETE CASCADE
  raw_text, NOT NULL (non-blank enforced by API serializer)
  processing_status, NOT NULL, default UNPROCESSED
  is_archived, NOT NULL, default false
  created_at, NOT NULL
   updated_at, NOT NULL
   revision, NOT NULL, default 0
   analysis_started_at, nullable
```

Deleting a user cascades to that user's Notes because Notes have no valid owner without the User. All API querysets are also scoped to `request.user`; clients cannot assign `user` IDs.

Django's built-in User model is used as required. Its `username` is database-unique and the registration API sets it to the normalized email. The built-in `email` column itself is not database-unique, so duplicate-email protection applies to the public registration path rather than arbitrary ORM/admin writes.

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
