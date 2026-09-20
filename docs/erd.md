# Entity Relationship Design

## Implemented in Part 2

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
```

Deleting a user cascades to that user's Notes because Notes have no valid owner without the User. All API querysets are also scoped to `request.user`; clients cannot assign `user` IDs.

Django's built-in User model is used as required. Its `username` is database-unique and the registration API sets it to the normalized email. The built-in `email` column itself is not database-unique, so duplicate-email protection applies to the public registration path rather than arbitrary ORM/admin writes.

## Designed for later parts

```text
Note 1 -> many NoteItem
NoteItem many <-> many Domain
Note -> many AIProcessingLog
User -> many Place
User -> many Reminder
NoteItem -> optional NoteEmbedding
```

These tables are not implemented in Part 2 to avoid unused complexity and false AI behavior.
