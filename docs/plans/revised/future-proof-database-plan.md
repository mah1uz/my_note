# FUTURE-PROOF DATABASE ARCHITECTURE PLAN — RECONCILED EDITION

## Project
AI Context-Aware Note-Taking Web Application — My Notes

**Status:** Canonical database source of truth for Parts 3.4–6  
**Database:** Supabase PostgreSQL  
**Auth:** Supabase Auth  
**Backend:** Django REST Framework  
**Current pre-Part-4 frontend:** React/Vite  
**Part-4+ frontend:** Next.js App Router + TypeScript  
**Default timezone:** `Asia/Dhaka`  
**Default currency:** `BDT`

---

# 1. Core ownership decision

All application-owned data resolves to a stable internal UUID:

```text
Supabase Auth
  JWT iss + sub
      ↓
user_auth_identities
      ↓
app_users.id UUID
      ↓
private application data
```

Supabase user UUID is not copied into every content table.

`app_users.id` is the relational root.

---

# 2. Non-negotiable rules

1. Application-owned entities use UUID primary keys unless a strong exception exists.
2. `app_users.id` is the permanent internal owner.
3. Supabase Auth is identity, not the application relational root.
4. Backend derives current user from a verified Supabase JWT.
5. Frontend never chooses authoritative `user_id`.
6. User-owned querysets are owner-scoped before serialization.
7. Raw Note text is the source record.
8. AI output is derived and cannot silently overwrite raw Notes.
9. One Note may produce many NoteItems.
10. Type and Domain remain separate.
11. Confirmed Transactions are the financial ledger.
12. Embeddings are derived/regenerable.
13. BYOK keys are not persisted.
14. Admin cannot read private content through application admin UI/API.
15. Admin privilege/account actions are audited.
16. No live GPS history is stored.
17. Sensitive models are not directly exposed in Django Admin.
18. Use Django `TextChoices` + DB constraints, not PostgreSQL native ENUMs.
19. Timed values use timezone-aware timestamps.
20. Money uses `NUMERIC` / Python Decimal, never float.
21. Different currencies are never silently summed.
22. Current GPS never enters embeddings/RAG/Groq.

---

# 3. Canonical roadmap relationship

```text
Parts 1–3
        ↓
Part 3.4
UUID ownership + PostgreSQL + Supabase Auth foundation
        ↓
Part 3.5
Transactions + Preferences + AI entitlement + Onboarding
        ↓
Part 4
Next.js + pgvector + FTS + Hybrid Search + Strict RAG
        ↓
Part 5
Places + Reminders + active-session Location Mode
        ↓
Part 6
Smart Dashboard + Evaluation + Deployment
```

The old `Part 4.5` numbering is retired.

---

# 4. App users

## `app_users`

```text
id UUID PK
email VARCHAR(320)
display_name VARCHAR(120) NULL
status VARCHAR(24)
timezone VARCHAR(64)
locale VARCHAR(16)
default_currency CHAR(3)
email_verified_at TIMESTAMPTZ NULL
last_seen_at TIMESTAMPTZ NULL
suspended_at TIMESTAMPTZ NULL
deletion_requested_at TIMESTAMPTZ NULL
created_at
updated_at
deleted_at NULL
```

Status:

```text
ACTIVE
SUSPENDED
DELETION_PENDING
DELETED
```

Email is account metadata, not identity key.

---

# 5. External identity mapping

## `user_auth_identities`

```text
id UUID PK
user_id UUID FK -> app_users ON DELETE CASCADE
auth_system VARCHAR(32) = SUPABASE
issuer VARCHAR(255)
subject VARCHAR(255)
created_at
last_seen_at NULL
```

Constraint:

```text
UNIQUE(issuer, subject)
```

Authentication flow:

```text
Authorization: Bearer <Supabase access JWT>
  ↓
verify signature/JWKS + iss + aud + exp
  ↓
(issuer, subject)
  ↓
UserAuthIdentity
  ↓
AppUser
```

Never merge AppUsers merely because an email matches.

---

# 6. User preferences

## `user_preferences`

One row per AppUser.

```text
id UUID PK
user_id UUID UNIQUE FK -> app_users ON DELETE CASCADE

notification_enabled BOOLEAN
time_reminders_enabled BOOLEAN
location_reminders_enabled BOOLEAN
daily_briefing_enabled BOOLEAN

week_starts_on SMALLINT

profession VARCHAR(24)
priority_profile VARCHAR(24)

onboarding_completed_at TIMESTAMPTZ NULL
onboarding_tour_version INTEGER

created_at
updated_at
```

Profession:

```text
STUDENT
EMPLOYED
BOTH
OTHER
PREFER_NOT_TO_SAY
```

Priority:

```text
BALANCED
STUDY_FIRST
WORK_FIRST
```

Profession is optional product preference, not identity.

---

# 7. Admin identity

Django `auth_user` remains for staff/admin login only.

Ordinary Supabase users do not become Django staff users.

## `admin_profiles`

```text
id UUID PK
django_user_id UNIQUE
role ADMIN | SUPER_ADMIN
is_active BOOLEAN
created_by_admin_id NULL
created_at
updated_at
```

## `admin_audit_events`

Append-only safe metadata.

Never record:
- Note text
- Transaction details
- AI payload contents
- API keys
- JWTs
- precise coordinates

---

# 8. Notes

## `notes`

```text
id UUID PK
app_user_id UUID FK -> app_users ON DELETE CASCADE
raw_text TEXT
processing_status VARCHAR(24)
is_archived BOOLEAN
revision BIGINT
analysis_started_at TIMESTAMPTZ NULL
created_at
updated_at
```

Indexes:

```text
(app_user_id, created_at DESC)
(app_user_id, is_archived, created_at DESC)
(app_user_id, processing_status)
```

Client never submits authoritative owner.

---

# 9. NoteItems

## `note_items`

```text
id UUID PK
note_id UUID FK -> notes ON DELETE CASCADE
analysis_run_id UUID NULL FK -> ai_processing_runs SET NULL

item_type VARCHAR(20)
title VARCHAR(255)
summary TEXT NULL
normalized_text TEXT NULL

start_date DATE NULL
due_date DATE NULL
start_datetime TIMESTAMPTZ NULL
due_datetime TIMESTAMPTZ NULL

amount NUMERIC(18,4) NULL
currency CHAR(3) NULL
quantity NUMERIC(18,6) NULL
unit VARCHAR(32) NULL

place_hint VARCHAR(255) NULL
assigned_place_id UUID NULL FK -> places SET NULL

status VARCHAR(20)
importance VARCHAR(12)
confidence NUMERIC(5,4) NULL
is_confirmed BOOLEAN
metadata JSONB

created_at
updated_at
```

Existing Part 3 item types may remain:

```text
TASK
EVENT
EXPENSE
INFORMATION
```

Important Part 3.5 rule:

> `EXPENSE` and NoteItem `amount/currency` remain extraction/source context.
> Finance calculations after Part 3.5 use `finance_transactions`.

Do not delete the old type merely to make the schema aesthetically perfect.

---

# 10. Domains

## `domains`

```text
id UUID PK
name VARCHAR(80) UNIQUE
slug VARCHAR(80) UNIQUE
is_active BOOLEAN
sort_order SMALLINT
created_at
```

Seed examples:

```text
Education
Shopping
Finance
Work
Personal
Health
Entertainment
Travel
Other
```

## `note_item_domains`

```text
id UUID PK
note_item_id UUID FK -> note_items ON DELETE CASCADE
domain_id UUID FK -> domains RESTRICT
is_primary BOOLEAN
source AI | USER
created_at
```

Constraints:
- unique `(note_item_id, domain_id)`
- at most one primary Domain per NoteItem

---

# 11. Transactions — authoritative financial ledger

## `finance_transactions`

```text
id UUID PK
user_id UUID FK -> app_users ON DELETE CASCADE
note_item_id UUID NULL FK -> note_items ON DELETE CASCADE
primary_domain_id UUID NULL FK -> domains RESTRICT

direction VARCHAR(8)
amount NUMERIC(18,4)
currency CHAR(3)
label VARCHAR(255)
transaction_at TIMESTAMPTZ
source_kind VARCHAR(24)

created_at
updated_at
```

Direction:

```text
CREDIT
DEBIT
```

Source:

```text
AI_NOTE
MANUAL
OPENING_BALANCE
```

Rules:
- amount always positive
- direction determines sign
- every Transaction row is confirmed/authoritative
- suggestions are not stored as ledger rows
- one Note-derived Transaction per NoteItem in V1
- owner must match source NoteItem owner
- user may edit confirmed transaction
- re-analysis never silently overwrites it

Constraints:

```text
amount > 0
direction IN (CREDIT, DEBIT)
UNIQUE(note_item_id) WHERE note_item_id IS NOT NULL
```

---

# 12. Transaction reporting Domain

`primary_domain_id` is the authoritative finance reporting category.

For Note-derived transaction:
- initialize from source NoteItem primary Domain when available
- user may edit
- later NoteItem Domain changes do not silently rewrite finance history

For manual transaction:
- user may choose a Domain
- may be NULL

Finance category summaries use this field.

---

# 13. Opening balance

V1 supports at most one opening-balance Transaction per user/currency.

Conceptual partial unique constraint:

```text
UNIQUE(user_id, currency)
WHERE source_kind = 'OPENING_BALANCE'
```

Positive opening position:
- `CREDIT`

Negative/debt starting position:
- `DEBIT`

No separate mutable balance column.

---

# 14. Finance calculations

For each currency:

```text
balance =
SUM(CREDIT.amount)
-
SUM(DEBIT.amount)
```

Running order:

```text
transaction_at
created_at
id
```

Period boundaries use `AppUser.timezone`.

Never:
- ask Groq to calculate totals
- sum currencies together
- use float

---

# 15. AI processing metadata

## `ai_processing_runs`

Operational/safe-ish metadata:

```text
id UUID PK
note_id UUID FK -> notes ON DELETE CASCADE
source_run_id UUID NULL self FK
operation
provider
model_name
prompt_version
note_revision
credential_source
status
error_code NULL
error_message NULL sanitized
latency_ms NULL
input_chars NULL
output_chars NULL
created_at
completed_at NULL
```

Credential source:

```text
USER_SESSION
TRIAL
SERVER
NONE
```

Never key material.

---

# 16. Sensitive AI artifacts

## `ai_processing_artifacts`

```text
id UUID PK
run_id UUID UNIQUE FK -> ai_processing_runs ON DELETE CASCADE
input_snapshot TEXT NULL
raw_response JSONB/TEXT NULL
parsed_response JSONB NULL
confirmed_response JSONB NULL
created_at
```

Sensitive.

Never directly register in Django Admin.

---

# 17. BYOK

No persistent user API-key table in V1.

```text
user enters Groq key
  -> browser memory
  -> request header
  -> Django uses it
  -> never persisted
```

Do not put it in:
- DB
- localStorage
- sessionStorage
- cookies
- URLs
- logs

---

# 18. AI trial entitlement

## `user_ai_entitlements`

```text
id UUID PK
user_id UUID UNIQUE FK -> app_users ON DELETE CASCADE
trial_limit INTEGER
trial_used INTEGER
trial_started_at TIMESTAMPTZ
trial_expires_at TIMESTAMPTZ NULL
created_at
updated_at
```

Rules:
- backend-authoritative
- increments atomically
- rate-limited
- raw Note save never consumes/depends on it
- server Groq key remains backend-only

---

# 19. Embeddings — Part 4

## `note_embeddings`

```text
id UUID PK
note_item_id UUID UNIQUE FK -> note_items ON DELETE CASCADE
embedding VECTOR(384)
embedding_model VARCHAR(128)
embedding_version SMALLINT
content_hash CHAR(64)
source_updated_at TIMESTAMPTZ
created_at
updated_at
```

Initial model:

```text
sentence-transformers/all-MiniLM-L6-v2
```

One current embedding per confirmed searchable NoteItem.

Do not store live GPS or secrets.

---

# 20. Places — Part 5

## `places`

```text
id UUID PK
user_id UUID FK -> app_users ON DELETE CASCADE
name VARCHAR(160)
latitude NUMERIC(9,6)
longitude NUMERIC(9,6)
address VARCHAR(500) NULL
default_radius_m INTEGER
created_at
updated_at
```

Constraints:
- latitude -90..90
- longitude -180..180
- sensible radius

Precise data is sensitive.

No movement history.

---

# 21. Reminders — Part 5

## `reminders`

```text
id UUID PK
note_item_id UUID FK -> note_items ON DELETE CASCADE
trigger_type TIME | LOCATION
scheduled_at TIMESTAMPTZ NULL
place_id UUID NULL FK -> places ON DELETE CASCADE for LOCATION
radius_m INTEGER NULL
is_enabled BOOLEAN
last_triggered_at TIMESTAMPTZ NULL
triggered_count INTEGER
created_at
updated_at
```

Validation:

```text
TIME:
  scheduled_at required
  place/radius null in V1

LOCATION:
  place required
  radius required > 0
```

Reminder item and Place must belong to same AppUser.

---

# 22. Place assignment semantics

```text
note_item.assigned_place_id
```

= where an item belongs.

```text
reminder.place_id
```

= where a reminder fires.

They are separate.

Deleting Place:
- item assignment -> SET NULL
- LOCATION reminder -> delete/cascade

---

# 23. Relationship map

```text
Supabase Auth
  ↓ iss + sub
UserAuthIdentity
  ↓
AppUser
  ├─ UserPreferences
  ├─ UserAiEntitlement
  ├─ Notes
  │    ├─ NoteItems
  │    │    ├─ NoteItemDomains -> Domains
  │    │    ├─ NoteEmbedding
  │    │    ├─ Reminder
  │    │    └─ optional FinanceTransaction
  │    └─ AiProcessingRuns
  │          └─ AiProcessingArtifact
  │
  ├─ FinanceTransactions (manual/opening balance too)
  └─ Places
       ├─ assigned NoteItems
       └─ Location Reminders

Django staff auth_user
  ↓
AdminProfile
  ↓
AdminAuditEvents
```

---

# 24. Delete/cascade policy

| Parent delete | Child behavior |
|---|---|
| AppUser | cascade user-owned content |
| Note | cascade NoteItems + AI runs |
| NoteItem | cascade embedding/reminders/note-derived Transaction |
| AI run | cascade sensitive artifact |
| Place | SET NULL item assignment |
| Place | cascade LOCATION reminders |
| Domain | restrict while referenced |
| admin identity | audit actor SET NULL |

Manual Transactions are independent of Note deletion.

---

# 25. User isolation invariants

Every release tests:
- A cannot list/read/update/delete B Notes
- A cannot access B NoteItems
- A cannot access B Transactions
- A cannot link B Place
- A cannot access B Reminder
- search filters by AppUser in DB query
- vectors are owner-scoped before ranking exposure
- RAG sources are current-user only
- suspended AppUser rejected even with otherwise valid JWT

---

# 26. Admin privacy

Admin UI/API may see:
- AppUser UUID
- email/display name
- status
- account timestamps
- safe counts
- operational processing metadata

Admin UI/API must not expose:
- raw Note text
- NoteItem content
- Transaction label/amount/history
- AI artifacts
- embeddings
- saved coordinates/address
- RAG content
- BYOK keys

Transactions count may be shown if product/admin requirements need a safe count,
but contents/amounts remain private.

---

# 27. Core indexes

Identity:

```text
user_auth_identities(issuer, subject) UNIQUE
user_auth_identities(user_id)
```

Notes:

```text
notes(app_user_id, created_at DESC)
notes(app_user_id, processing_status)
```

Items:

```text
note_items(note_id, is_confirmed)
note_items(item_type, status)
note_items(status, due_datetime)
note_items(assigned_place_id, status)
```

Transactions:

```text
finance_transactions(user_id, transaction_at DESC)
finance_transactions(user_id, direction, transaction_at DESC)
finance_transactions(user_id, currency, transaction_at DESC)
finance_transactions(user_id, primary_domain_id, transaction_at DESC)
finance_transactions(note_item_id) UNIQUE when non-null
```

Entitlement:

```text
user_ai_entitlements(user_id) UNIQUE
```

Embeddings:

```text
note_embeddings(note_item_id) UNIQUE
note_embeddings(content_hash)
```

Places/reminders:

```text
places(user_id, name)
reminders(note_item_id, is_enabled)
reminders(trigger_type, is_enabled, scheduled_at)
reminders(place_id, is_enabled)
```

Measure before adding speculative indexes.

---

# 28. JSONB policy

Typed relational columns for:
- ownership
- status
- money
- dates
- reporting categories
- fields used in filters/aggregates

JSONB only for bounded extensibility:
- NoteItem extraction metadata
- AI artifacts
- safe admin metadata

Never hide core finance fields or ownership inside JSON.

---

# 29. Concurrency / consistency

Use `Note.revision` for AI/re-analysis consistency.

AI flow:
- claim revision
- provider work outside long DB lock
- verify revision before commit
- stale result discarded

Use `transaction.atomic()` for:
- first AppUser provisioning
- confirmed review replacement
- Transaction confirmation + related local updates where required
- trial quota atomic increment
- admin role changes + audit
- local account status update + audit

External Supabase/provider calls cannot be atomic with PostgreSQL.

Handle orchestration failures explicitly.

---

# 30. Transaction re-analysis rule

If source Note is re-analyzed after a confirmed Transaction exists:

```text
existing Transaction remains authoritative
```

A changed suggestion may be shown as:
- conflict
- proposed update

But no automatic overwrite.

This avoids AI silently rewriting a user's ledger.

---

# 31. Search/RAG database rule — Part 4

Structured finance queries use `finance_transactions`.

Examples:

```text
spent -> direction=DEBIT
income -> direction=CREDIT
```

NoteItem semantic search remains useful for note meaning.

Search may join Transaction to its source NoteItem/Note for context.

Manual Transactions can appear independently.

---

# 32. Location/search boundary — Part 5

Saved Place names may be searchable.

Live GPS:
- browser memory only
- no embeddings
- no RAG
- no Groq
- no stored parser state
- no movement-history table

---

# 33. Final table inventory

## Part 3.4 foundation

1. `app_users`
2. `user_auth_identities`
3. `user_preferences`
4. `admin_profiles`
5. `admin_audit_events`
6. `notes`
7. `note_items`
8. `domains`
9. `note_item_domains`
10. `ai_processing_runs`
11. `ai_processing_artifacts`

## Part 3.5

12. `finance_transactions`
13. `user_ai_entitlements`
14. preference field additions

## Part 4

15. `note_embeddings`

## Part 5

16. `places`
17. `reminders`

Optional future:
- tags
- attachments metadata
- persistent encrypted provider credentials only if product scope changes

---

# 34. Django app ownership suggestion

```text
accounts/
  AppUser
  UserAuthIdentity
  UserPreferences
  UserAiEntitlement

notes/
  Note
  NoteItem
  Domain
  NoteItemDomain

finance/
  FinanceTransaction

ai/
  AIProcessingRun
  AIProcessingArtifact

search/
  NoteEmbedding

context/ or places/
  Place
  Reminder

admin_portal/
  AdminProfile
  AdminAuditEvent
```

A dedicated `finance` app is justified because Transaction is now an
authoritative domain with its own aggregation/query behavior.

Do not create a new app merely for every table.

---

# 35. Supabase-specific security

1. publishable key may exist in browser.
2. secret/service-role credentials remain server-only.
3. Django validates access JWTs.
4. local AppUser status checked on every authenticated request.
5. Google OAuth is configured through Supabase Auth.
6. application data remains behind Django.
7. do not expose a second uncontrolled Supabase Data API path.
8. require SSL for hosted PostgreSQL.

---

# 36. Authentication/session statement

Supabase session includes:
- access token
- refresh token managed by Supabase client

Django API requests send the current access JWT.

Do not claim browser holds only an access token if Supabase session persistence is enabled.

Logout does not retroactively erase a JWT cryptographically before expiry;
local session/refresh state is revoked/cleared and AppUser status remains an
additional server-side control.

---

# 37. Part 3.4 migration target

Part 3.4 completes:
- PostgreSQL cutover
- UUID ownership
- Supabase Auth cutover
- AppUser-only Notes ownership
- AI run/artifact split
- explicit NoteItemDomain
- safe admin boundary
- regression/user-isolation tests

Existing disposable SQLite demo data is not copied to Supabase PostgreSQL.

SQLite may remain as local reference only.

---

# 38. Part 3.5 migration target

Part 3.5 adds:
- FinanceTransaction
- UserAiEntitlement
- preference fields
- indexes/constraints
- finance privacy tests

No pgvector yet.

No Places/reminders yet.

---

# 39. Acceptance criteria

Database architecture is considered aligned only when:

1. AppUser UUID is stable owner root.
2. Supabase identity maps by iss+sub.
3. Note ownership uses AppUser.
4. raw Note remains source of truth.
5. NoteItems remain derived semantic structure.
6. Transactions are finance source of truth.
7. NoteItem expense fields are not used for balance after Part 3.5.
8. Transaction suggestions are not ledger rows.
9. CREDIT/DEBIT use positive Decimal amount.
10. finance reporting Domain is explicit.
11. opening-balance policy is explicit.
12. period summaries use user timezone.
13. BYOK is not persisted.
14. trial entitlement is backend-authoritative.
15. embeddings are derived and owner-scoped.
16. live GPS is not persisted.
17. admin cannot read private content through admin surfaces.
18. cascade policies are tested.
19. no client controls authoritative ownership.
20. Parts 4–6 can build without rewriting ownership/finance foundations.
