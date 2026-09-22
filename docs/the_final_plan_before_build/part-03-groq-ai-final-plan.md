# PART 3 FINAL PLAN BEFORE BUILD — Groq AI Note Intelligence

> Source of truth: `docs/plans/part-03-groq-ai.md`.
> Status at time of writing: Part 2 complete. Admin audit confirmed Django Admin
> sufficient, built-in UserAdmin working, Note admin configured, normal users
> blocked from `/admin/`, API user isolation enforced, no custom React admin needed.
> Do NOT redesign Part 2 auth/admin unless a genuine Part 3 incompatibility appears
> (none found).
> Scope guard: NO PostgreSQL, NO embeddings, NO semantic search, NO RAG,
> NO places/location/reminders, NO What Matters Now, NO Daily Briefing.

## 1. Current Part 2 architecture summary

```text
React/Vite (:5173) — Fetch + Bearer access (memory) + HttpOnly refresh cookie
  | JSON over /api/v1, CORS allowlist Vite origins only
  v
Django + DRF (:8000) + SimpleJWT (10m access / 7d rotating refresh, blacklist)
  | ORM, JSON-only parsers, IsAuthenticated default, throttling
  v
SQLite (dev), TZ Asia/Dhaka
```

Real: register/login/refresh/logout/me, Notes CRUD with user-scoped queryset +
404 isolation, Django Admin (`User` stock + `Note` registered). Still mocked:
Tasks, Events, Shopping, Expenses, Places, Search/Ask, Daily Briefing,
What Matters Now. New notes stay `UNPROCESSED`; no fake AI.

## 2. Current Note model / API / frontend flow

- Model `backend/notes/models.py`: `Note(user FK CASCADE related_name=notes,
  raw_text TEXT, processing_status
  UNPROCESSED/PROCESSING/PROCESSED/FAILED/REVIEW_REQUIRED default UNPROCESSED,
  is_archived bool, created_at, updated_at)`, ordering `-created_at`.
- Serializer: exposes
  `id/raw_text/processing_status/is_archived/created_at/updated_at`;
  `processing_status` read-only; blank `raw_text` rejected; client `user` ignored.
- View: `ModelViewSet`,
  `get_queryset() = Note.objects.filter(user=request.user)`,
  `perform_create(user=request.user)`. Router at `/api/v1/notes/`.
- Frontend `src/api/notesApi.js`: `listNotes/getNote/createNote({raw_text})/
  editNote(PATCH)/removeNote`, normalized to
  `{id, originalText, processingStatus, ...}`. `NotesContext` loads on
  `currentUser.id`, clears on logout/switch. Detail page currently shows
  "Awaiting organization" placeholder — the integration point for AI Review.
- Tasks/Events/Expenses pages read `src/data/mockData.js` via
  `AppStateContext` — the three pages to convert in Step F.

## 3. Proposed NoteItem model

Single concrete model, no inheritance (plan V1). Addition to
`backend/notes/models.py`:

- `id` BigAutoField PK
- `note` FK → Note, NOT NULL, `on_delete=CASCADE`, `related_name='items'`
- `item_type` CharField(max_length=20, choices=TASK/EVENT/EXPENSE/INFORMATION,
  NOT NULL)
- `title` CharField(max_length=200, NOT NULL, blank=False)
- `summary` TextField(blank=True, default='')
- `normalized_text` TextField(blank=True, default='')
- `start_datetime` DateTimeField(null=True, blank=True)
- `due_datetime` DateTimeField(null=True, blank=True)
  (naive input interpreted in `Asia/Dhaka`, stored TZ-aware)
- `amount` DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
- `currency` CharField(max_length=3, null=True, blank=True), e.g. `BDT`
- `quantity` DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
- `unit` CharField(max_length=20, null=True, blank=True), e.g. `gram`/`piece`
- `place_hint` CharField(max_length=120, null=True, blank=True) — free text only
  (e.g. `Agora`); must NOT auto-bind to future `Place` FK
- `status` CharField(max_length=20,
  choices=PENDING/COMPLETED/CANCELLED/ARCHIVED, default=PENDING, NOT NULL)
- `importance` CharField(max_length=10, choices=LOW/NORMAL/HIGH,
  default=NORMAL, NOT NULL)
- `confidence` FloatField(null=True, blank=True), validators 0–1, UI signal only
- `is_confirmed` BooleanField(default=False, NOT NULL)
  (`False` = draft from analyze, `True` = user-approved)
- `created_at` / `updated_at` auto fields
- `metadata` JSONField(default=dict, blank=True) — prompt/model snapshot,
  no secrets
- Indexes (only genuinely useful): `(note, is_confirmed)`,
  `(note, item_type)`, `(item_type, status)`
- `clean()` enforces: non-empty title; `confidence` 0–1 if set; EXPENSE should
  have `amount` (warn, not hard-block, to allow manual fallback).

## 4. Proposed Domain model + relationship

- `Domain`: `id` PK, `name` CharField(max_length=60, unique=True),
  `slug` SlugField(max_length=60, unique=True), `ordering = ('name',)`.
- Relationship: `NoteItem.domains = ManyToManyField(Domain,
  related_name='items', blank=True)`. Auto join table
  `notes_noteitem_domains`. No through model in V1.
- Seed set (canonical, 9): Education, Shopping, Finance, Work, Personal,
  Health, Entertainment, Travel, Other. Display case canonical; slug lowercase.
  Seeded via data migration, never in fixtures requiring secrets.

## 5. Proposed AIProcessingLog model

- `id` PK
- `note` FK → Note, NOT NULL, CASCADE, `related_name='ai_logs'`
- `model_name` CharField(max_length=80), e.g. `llama-3.3-70b-versatile`
  (final choice recorded at implementation)
- `prompt_version` CharField(max_length=20), e.g. `v1`
- `raw_response` TextField(blank=True) — verbatim provider text, truncated
  server-side (~20k chars)
- `parsed_response` JSONField(null=True, blank=True) — validated payload or
  null on failure
- `status` CharField(max_length=20, choices=SUCCESS/FAILED/EMPTY/RETRIED,
  NOT NULL)
- `error_message` TextField(blank=True), sanitized, no keys
- `created_at` auto_now_add; ordering `-created_at`; index `(note, created_at)`
- Never exposed via user APIs; Admin read-only.

## 6. Updated ERD

```text
User 1 ──< Note (FK user NOT NULL CASCADE; delete user → notes → items → logs)
Note 1 ──< NoteItem (FK note NOT NULL CASCADE)
NoteItem >──< Domain (M2M, blank; delete either side removes join only)
Note 1 ──< AIProcessingLog (FK note NOT NULL CASCADE; logs never delete notes)
```

PKs: all `id`. Nullable: only §3 date/money/qty/unit/place/confidence +
`metadata{}` default; rest NOT NULL with defaults. `Domain.name/slug` unique.
Future-only (NOT Part 3): `NoteEmbedding`, `Place`, `Reminder`.

## 7. Exact Groq structured-output JSON schema

Enforced server-side after Groq returns (Groq JSON mode + second-pass DRF
validation; never regex prose). Draft for Step B sign-off:

```json
{
  "type": "object",
  "required": ["summary", "items"],
  "additionalProperties": false,
  "properties": {
    "summary": {"type": "string", "maxLength": 500},
    "items": {
      "type": "array", "minItems": 0, "maxItems": 10,
      "items": {
        "type": "object",
        "required": ["type", "title"],
        "additionalProperties": false,
        "properties": {
          "type": {"type": "string", "enum": ["TASK", "EVENT", "EXPENSE", "INFORMATION"]},
          "title": {"type": "string", "minLength": 1, "maxLength": 200},
          "summary": {"type": "string", "maxLength": 500},
          "normalized_text": {"type": "string", "maxLength": 1000},
          "domains": {"type": "array", "maxItems": 3, "items": {"type": "string", "enum": ["Education", "Shopping", "Finance", "Work", "Personal", "Health", "Entertainment", "Travel", "Other"]}},
          "start_datetime": {"type": ["string", "null"], "format": "date-time"},
          "due_datetime": {"type": ["string", "null"], "format": "date-time"},
          "amount": {"type": ["number", "null"], "minimum": 0},
          "currency": {"type": ["string", "null"], "enum": ["BDT", null]},
          "quantity": {"type": ["number", "null"], "minimum": 0},
          "unit": {"type": ["string", "null"], "maxLength": 20},
          "place_hint": {"type": ["string", "null"], "maxLength": 120},
          "importance": {"type": "string", "enum": ["LOW", "NORMAL", "HIGH"]},
          "confidence": {"type": ["number", "null"], "minimum": 0, "maximum": 1}
        }
      }
    }
  }
}
```

Unknown/missing → `null`, never invented. Server rejects extra keys, unknown
enums, negative money/qty, over-long strings, >10 items.

## 8. Exact allowed values

- `item_type`: `TASK, EVENT, EXPENSE, INFORMATION` (uppercase canonical;
  Groq lowercase normalized server-side then uppercased).
- `domains`: `Education, Shopping, Finance, Work, Personal, Health,
  Entertainment, Travel, Other` (display case; slugs derived). Max 3 per item.
- `NoteItem.status`: `PENDING, COMPLETED, CANCELLED, ARCHIVED`
  (default `PENDING`).
- `importance`: `LOW, NORMAL, HIGH` (default `NORMAL`).
- Existing `Note.processing_status` reused unchanged:
  `UNPROCESSED, PROCESSING, PROCESSED, FAILED, REVIEW_REQUIRED`.

## 9. Groq prompt strategy

System prompt (versioned `v1`, server-injected; user text is data, never
instructions):

1. No invented facts: extract only explicit or directly entailed values;
   else `null`. Spelling variants allowed (`chilli/chili`) but no new
   objects/dates/amounts.
2. Multi-item: split independent clauses/intents
   (`class + buy eggs + spent 250` → 3 items). Cap 10; keep most concrete,
   note truncation in `summary`.
3. Dates/timezone: server passes `now_iso` + `timezone=Asia/Dhaka`. Resolve
   relative (`tomorrow`, `Friday`, `at 10`) against that; missing time keeps
   date-only with ambiguity noted; unresolvable → `null`.
4. BDT normalization: `taka/Tk/৳/TK` → `currency=BDT`, numeric `amount`.
   No currency conversion; non-BDT money keeps `amount`, `currency=null` +
   mention in `summary` (V1 BDT-first per examples).
5. Quantity/unit: `300gm/300 g/300 gram` → `quantity=300, unit=gram`
   (normalize `gm/g→gram`, `kg→kilogram`, `pcs→piece`); missing → `null`.
6. Ambiguity: `Get that thing from Rahim tomorrow` → single `TASK`,
   verbatim-ish title, structured fields `null`, low `confidence`,
   `domains=[Other]` only if no better fit.
7. Titles concise (<80 chars ideal); per-item `confidence` (≥0.85 normal,
   0.60–0.84 highlight, <0.60 strong review — UI only).
8. JSON only matching §7 schema; no prose, no reminders, no geocoding.

## 10. Analyze endpoint `POST /api/v1/notes/:id/analyze/`

- Auth `IsAuthenticated`; note via
  `Note.objects.filter(user=request.user).get(pk=id)` → non-owner 404.
  No body params (V1 analyzes current `raw_text`).
- Atomic flow: `processing_status=PROCESSING` → call
  `groq_service.analyze_note(raw_text, now, tz)` with timeout (~20s) →
  validate schema → success: replace unconfirmed drafts (see §12), create
  `NoteItem(is_confirmed=False)` + domains, write `AIProcessingLog SUCCESS`,
  note → `REVIEW_REQUIRED`, return `{note, items[], log_id}`.
  Provider/validation failure: log `FAILED`, note → `FAILED`, return 502 with
  "Your note is saved" message (see §14). Empty-valid output: log `EMPTY`,
  note → `REVIEW_REQUIRED` with `items: []`.
- Throttle: reuse existing user throttle; consider scoped analyze rate at
  implementation (Part 6 formalizes).

## 11. Confirmation endpoint `POST /api/v1/notes/:id/confirm-analysis/`

- Payload: full user-approved `items[]` (same shape as §7, plus optional `id`
  for existing drafts) — never a bare boolean.
- Server: verify ownership → validate every item (types/domains/dates/amounts,
  domain existence, no cross-user IDs) → transaction: update/create
  `NoteItem(is_confirmed=True)`, delete drafts removed by user, delete
  unconfirmed items absent from payload, preserve original AI output in log
  (never overwrite `parsed_response`) → append correction snapshot (§13) →
  ≥1 confirmed ⇒ note `PROCESSED`; zero confirmed ⇒ stay `REVIEW_REQUIRED` →
  return updated note + confirmed items.
- Client IDs from other notes/users → 400/404, no write.

## 12. Re-analysis policy

- Retry when `REVIEW_REQUIRED`/`FAILED`: delete all `is_confirmed=False`
  items for that note, keep all `is_confirmed=True` untouched, create fresh
  drafts, append new `AIProcessingLog` row. Never merge into confirmed items.
- Retry when `PROCESSED` with confirmed items: allowed, but drafts are
  additive candidates; confirmed unchanged unless edited via confirm endpoint.
  UI warns: "Retry will replace unconfirmed drafts only."
- Logs append-only; lineage via `metadata`, never by overwriting.

## 13. Correction-tracking design

V1 minimum (no ML learning): `AIProcessingLog.parsed_response` preserves
original AI output forever. On confirm, store `metadata.confirmed_snapshot`
(or second log row with `status=SUCCESS` + `metadata.is_correction=True`)
holding final user-approved items. Offline diff later yields type/domain/
amount/date correction rates. No extra model in V1.

## 14. Failure handling

All paths leave raw `Note` intact and usable:

- Timeout / network / rate-limit / provider 5xx: catch in service, log
  `FAILED` sanitized, note → `FAILED`, UI:
  `AI organization failed. Your note is saved.` + `[Retry AI Analysis]
  [Organize Manually]`.
- Malformed JSON / invalid schema / unsupported enums: same path; log
  offending path, persist nothing as items.
- Zero valid items but provider success: log `EMPTY`, note →
  `REVIEW_REQUIRED`, UI: "No structured items found — add manually or retry."
- Groq never controls note save; analyze is post-save only.

## 15. Manual-organization fallback

When AI fails or user prefers: simple form on detail page creating ≥1
`NoteItem` directly (type/title/domains + relevant date/amount/place fields).
Submits to confirm endpoint with confirmed intent; server validates
identically. Makes `PROCESSED` achievable with zero Groq calls.

## 16. AI Review frontend UX plan

Extend `NoteDetailPage` (no new route V1): when status is
`REVIEW_REQUIRED`/`FAILED`, render `AIReviewPanel` below the always-visible
original note. Per draft item editable: Type select, Title input, Domains
multi-select (seed list), Start/Due datetime-local, Amount + Currency
(BDT default), Quantity + Unit, Place hint, Importance, confidence badge
(color thresholds §9). Actions: Confirm all, Edit inline, Remove item, Add
missing item (manual), Retry analysis. States: loading (`Analyzing…`),
success, validation-error (field messages), provider-error + retry, empty
("No items — add manually or retry."). Confirm sends full approved array;
success flips badge to `PROCESSED`.

## 17. Tasks / Events / Expenses transition to real NoteItems

- New `src/api/itemsApi.js`: `listItems(params)`, `getItem`, `patchItem`,
  `confirmAnalysis(noteId, items)`, `analyzeNote(noteId)` — reusing
  `apiRequest` auth/refresh handling.
- `TasksPage`: replace `mockTasks` with
  `GET /api/v1/items/?type=TASK&confirmed=true`; keep toggle
  (PATCH `status` COMPLETED↔PENDING) + basic edit.
- `EventsPage`: `type=EVENT`; show date/domains/title.
- `ExpensesPage`: `type=EXPENSE`; backend-computed totals by domain + recent
  list (sums in Django, never Groq).
- Shopping stays mock-derived until Part 5. `AppStateContext` keeps mocks for
  Places/Search/Dashboard; Tasks/Events/Expenses switch to real API with
  loading/error/empty states mirroring Notes.

## 18. Exact backend files to create or modify

Create: `backend/ai/__init__.py`, `backend/ai/services/__init__.py`,
`backend/ai/services/groq_service.py` (Groq call, timeout, raw text return);
`backend/notes/item_serializers.py` (or extend `serializers.py`);
`backend/notes/migrations/0002_noteitem_domain_log.py` +
`0003_seed_domains.py` (data migration); `backend/notes/items_views.py` (or
extend `views.py` with analyze/confirm actions + items viewset);
`docs/ai-design.md` (model/prompt/schema/failure/limits).

Modify: `backend/notes/models.py` (3 models), `backend/notes/views.py` +
`backend/notes/urls.py` (analyze/confirm + `items/` routes),
`backend/notes/admin.py` (register `NoteItem`/`Domain`/`AIProcessingLog`,
logs read-only), `backend/config/settings.py` (GROQ env + timeout constants
only), `backend/requirements.txt`, `docs/api.md`, `docs/architecture.md`,
`docs/erd.md`.

Explicitly NOT touched: auth/admin architecture, `accounts/*` (except docs),
DB engine (stays SQLite), no `search/`/`places/`/`reminders/` apps.

## 19. Exact frontend files to create or modify

Create: `src/api/itemsApi.js`,
`src/components/AIReviewPanel.jsx` (or `src/features/notes/AIReviewPanel.jsx`
if Step A adopts folder split — decide at Step A, no churn otherwise),
`src/components/ManualItemForm.jsx` (may fold into panel if small).

Modify: `src/App.jsx` (`NoteDetailPage` review integration,
`TasksPage`/`EventsPage`/`ExpensesPage` real-data swap),
`src/api/notesApi.js` (expose `processingStatus`, optional `analyzeNote`
helper), `src/context/AppStateContext.jsx` (remove replaced mocks),
`src/data/mockData.js` (prune only replaced mocks; keep
places/search/dashboard), `src/App.test.jsx` (mocked-API review/confirm/
fallback tests). No router/Auth changes.

## 20. Required packages and why

- Python `groq` (official SDK) — structured chat/JSON calls + timeout;
  avoids hand-rolled HTTP/auth/retry. Only new runtime dep.
- No new `pydantic`/`jsonschema`: validate with existing DRF serializers
  against §7 — fewer deps, beginner-readable, consistent with Part 2.
- No new npm deps: Fetch, Router, Vitest/RTL/Playwright already suffice.
  `GROQ_API_KEY` backend env only, never `VITE_*`.

Open decision for Step A sign-off: exact Groq model string (suggest
`llama-3.3-70b-versatile`, confirm availability/quota then) and
`GROQ_TIMEOUT_SECONDS` (suggest 20).

## 21. Migration / seed-data plan

- `makemigrations` for `Domain`/`NoteItem(+M2M)`/`AIProcessingLog` with
  `Meta` indexes; `migrate` on SQLite dev + test DB.
- Data migration `0003_seed_domains.py` via `apps.get_model` (never direct
  imports): `get_or_create` 9 canonical domains with slugs; idempotent,
  reversible no-op. Rerun safe.
- No backfill for existing notes (stay `UNPROCESSED` until user analyzes).
  Admin smoke unaffected.

## 22. Automated testing plan (MOCKED Groq, no quota/secrets)

- Backend `APITestCase` patching
  `ai.services.groq_service.analyze_note`: valid output passes;
  malformed/incomplete/unexpected safely rejected; event/task/expense/
  information + multi-item fixtures; ambiguous input yields nulls;
  timeout/provider-error/invalid-JSON/retry leaves note intact with `FAILED`
  + log; confirm edit/remove/manual paths; User B analyze/confirm/read of
  User A note/items → 404 + DB unchanged.
- Frontend Vitest/RTL with fetch mock: review drafts render, edit/remove/
  confirm/manual flows, loading/success/validation/provider-error/retry,
  Tasks/Events/Expenses loading/error/empty/real-data states.
- Never live Groq, network, or committed key; fixed fixtures.

## 23. Manual test matrix (from Part 3 plan)

1. `I have an EM quiz on September 23.` → Event + Education.
2. `I need eggs from Agora.` → Task + Shopping + `place_hint=Agora`.
3. `I bought 300gm chilli for 50 taka.` → Expense + Shopping/Finance +
   300 gram + 50 BDT.
4. `Tomorrow class at 10, buy eggs afterwards, and today I spent 250 taka on
   books.` → 3 items.
5. `My project supervisor prefers weekly progress updates.` → Information
   (Education/Work context-dependent, no invented date).
6. `Get that thing from Rahim tomorrow.` → uncertain/nulls, low confidence,
   no invented object.
7. Simulated provider exception → raw note intact, `FAILED`, retry + manual.
8. User B analyze/confirm User A note → 404, no leak/mutation.

## 24. Security risks

- Ownership: analyze/confirm/items scoped to `request.user` at ORM level
  (same Notes pattern); cross-user → 404; confirm IDs re-validated; never
  filter in Python post-query. Assert read + write isolation in tests.
- API key: `GROQ_API_KEY` in backend `.env` only, server-side load, never in
  `VITE_*`, responses, logs, or admin; `raw_response` truncated/key-free;
  rate-limit analyze to contain quota abuse.
- Trusting AI output: Groq untrusted — schema + enum/range validation,
  max 10 items, no direct DB write; domains checked vs seeded table; dates
  TZ-aware; amounts non-negative `Decimal`.
- Trusting client confirmation: full server re-validation of every item
  (allowlisted type/domain/status/importance, ID ownership, no hidden-field
  trust); omitted drafts deleted only within owned-note transaction.

## 25. Exact implementation order (Steps A–H)

- **A — Schema/models:** finalize §3–§6, migrations + seed, admin
  registration, no Groq calls.
- **B — Groq service:** `groq_service.py`, env/timeout, JSON schema §7,
  prompt §9, fixture unit tests.
- **C — Analyze endpoint:** §10 + draft-replace rule + logging.
- **D — AI Review frontend:** §16 panel + states.
- **E — Confirm/correction:** §11 + §13 snapshots, `PROCESSED` transition.
- **F — Real Tasks/Events/Expenses:** §17 swap + manual fallback §15.
- **G — Failure/eval logging:** §14 matrix + log retention check.
- **H — Manual + automated tests:** §22–§23 full pass, docs
  (`ai-design`/`api`/`architecture`) updated.
