# PART 3 OF 6 — GROQ AI NOTE INTELLIGENCE

## Project
AI Context-Aware Note-Taking Web Application

## Starting point
Part 2 must already provide:
- real React ↔ Django connection
- real authentication
- real Notes CRUD
- user ownership/security
- SQLite persistence

Part 3 adds the AI understanding layer while preserving the raw Note as the source of truth.

---

## Role and working rules
Act as a senior AI/full-stack engineer and pair programmer.

Before changing files:
1. Inspect the completed Part 2 code.
2. Identify current Note model/API/frontend flow.
3. Present the Part 3 plan.
4. Show exact schema for AI output.
5. List backend/frontend files to create/modify.
6. Explain failure and correction behavior.
7. Wait for `IMPLEMENT PART 3 — STEP A`.

Do not implement semantic search, RAG, PostgreSQL, location, reminders, or final dashboard intelligence yet.

---

## Goal
Turn raw notes into structured, editable information using Groq.

Examples:

Input:
`I have an EM quiz on September 23.`

Expected structure:
- Event
- Education
- title: EM Quiz
- date: September 23

Input:
`I bought 300gm chilli for 50 taka.`

Expected structure:
- Expense
- Shopping + Finance
- item: chilli
- quantity: 300
- unit: gram
- amount: 50
- currency: BDT

Input:
`Tomorrow class at 10, buy eggs afterwards, and today I spent 250 taka on books.`

Expected:
- Event: class tomorrow 10
- Task: buy eggs
- Expense: books ৳250

One Note must be able to create multiple NoteItems.

---

## Part 3 scope
Implement:
- NoteItem model if not already created
- Domain model if not already created
- automatic domain seed data
- Groq service layer
- structured AI output
- multi-item extraction
- task/event/expense/information types
- date/time interpretation
- money/quantity/unit extraction
- place hint extraction
- importance extraction
- AI confidence signal
- AIProcessingLog
- review/correction UI
- confirmation flow
- retry/manual fallback
- user correction tracking

Do **not** implement:
- embeddings
- semantic search
- RAG
- PostgreSQL/pgvector
- maps/geolocation
- browser reminders
- What Matters Now ranking
- Daily Briefing

---

## Implementation order
### Step A — Finalize structured data schema/models
### Step B — Groq integration service
### Step C — Analyze endpoint
### Step D — AI Review frontend
### Step E — Confirmation/correction flow
### Step F — Real Tasks/Events/Expenses pages
### Step G — AI failure handling and evaluation logging
### Step H — Manual tests

---

# STEP A — STRUCTURED DATA MODEL

## Note remains immutable source context
Always preserve `Note.raw_text` unless the user explicitly edits/deletes it.

AI output must be derived data, not a replacement for the Note.

## NoteItem
Implement or finalize fields approximately:
- id
- note FK
- item_type
- title
- summary
- normalized_text
- start_datetime nullable
- due_datetime nullable
- amount nullable
- currency nullable
- quantity nullable
- unit nullable
- place_hint nullable
- status
- importance
- confidence nullable
- is_confirmed
- created_at
- updated_at
- metadata JSON optional

Initial item types:
- TASK
- EVENT
- EXPENSE
- INFORMATION

Suggested statuses:
- PENDING
- COMPLETED
- CANCELLED
- ARCHIVED

Importance:
- LOW
- NORMAL
- HIGH

Avoid excessive inheritance/subclass models in V1. Prefer one understandable NoteItem model unless a clear need appears.

## Domain
Fields:
- id
- name
- slug

Initial seed domains:
- Education
- Shopping
- Finance
- Work
- Personal
- Health
- Entertainment
- Travel
- Other

Relationship:
`NoteItem many ↔ many Domain`

## AIProcessingLog
Fields approximately:
- id
- note FK
- model_name
- prompt_version
- raw_response JSON/text as appropriate
- parsed_response JSON
- status
- error_message
- created_at

Purpose:
- debug failures
- compare prompt versions
- measure AI behavior
- preserve original prediction before user edits

Do not expose logs through normal user APIs.

---

# STEP B — GROQ SERVICE LAYER

## Security
`GROQ_API_KEY` must exist only in backend environment variables.
Never expose it to Vite/React.

## Service placement
Create a backend service module such as:
`ai/services/groq_service.py`

Do not place Groq code directly in views.

## Structured output
Use Groq structured JSON/schema capability if supported by the selected model.
Validate the result again server-side.

Use either:
- Pydantic schema
- JSON Schema + explicit validation

Do not parse arbitrary prose using regex.

## Conceptual output schema
```json
{
  "summary": "Short note-level summary",
  "items": [
    {
      "type": "task",
      "title": "Buy eggs",
      "summary": "Buy eggs after class",
      "normalized_text": "Buy eggs",
      "domains": ["shopping"],
      "start_datetime": null,
      "due_datetime": null,
      "amount": null,
      "currency": null,
      "quantity": null,
      "unit": null,
      "place_hint": null,
      "importance": "normal",
      "confidence": 0.94
    }
  ]
}
```

The exact schema must use only known allowed values.

---

## AI system rules
The prompt must instruct the model to:
1. Never invent missing facts.
2. Return null for unknown values.
3. Split independent actions/events/expenses into multiple items.
4. Use only allowed item types.
5. Use only allowed domains.
6. Allow multiple domains where justified.
7. Extract explicit money values.
8. Normalize common currency expressions (`taka`, `Tk`, `৳` → `BDT`).
9. Extract quantity/unit if explicit.
10. Extract dates/times if explicit or naturally relative.
11. Use user timezone/current date for relative dates.
12. Preserve ambiguity instead of guessing.
13. Keep titles concise.
14. Return a confidence signal per item.
15. Avoid inventing reminder settings.

Default development timezone:
`Asia/Dhaka`

Pass current date/time explicitly from Django.

---

## Confidence
Store the model-returned confidence as a **UI/review signal only**, not a calibrated probability.

Suggested UI thresholds:
- >= 0.85: normal review
- 0.60–0.84: highlight for review
- < 0.60: strongly request review

Never auto-trust sensitive extractions solely because confidence is high.

---

# STEP C — ANALYZE ENDPOINT

Create approximately:
`POST /api/v1/notes/:id/analyze/`

Flow:
```text
React requests analysis
  ↓
Django verifies note belongs to request.user
  ↓
Note.processing_status = PROCESSING
  ↓
Groq service receives raw_text + date/timezone
  ↓
Backend validates structured response
  ↓
Create draft/unconfirmed NoteItems + Domains
  ↓
Save AIProcessingLog
  ↓
Note.processing_status = REVIEW_REQUIRED
  ↓
Return draft analysis
```

If AI succeeds but extracts zero valid items, return a valid review state rather than fabricating items.

## Re-analysis behavior
If the user retries analysis:
- do not create duplicate draft items
- clearly define whether old unconfirmed drafts are replaced
- never silently overwrite confirmed items

Choose a simple policy and document it.

---

# STEP D — AI REVIEW FRONTEND

After analysis, show a review screen/panel.

For each extracted item show editable:
- Type
- Title
- Domains
- Start/due date
- Amount/currency
- Quantity/unit
- Place hint
- Importance
- Confidence indicator

Actions:
- Confirm all
- Edit item
- Remove extracted item
- Add missing manual item if practical
- Retry analysis

The user must be able to correct AI before confirmation.

Do not hide the original raw note.

---

# STEP E — CONFIRMATION/CORRECTION FLOW

Suggested endpoint:
`POST /api/v1/notes/:id/confirm-analysis/`

Payload should contain the user-approved structured items, not simply a boolean.

Backend must:
1. verify ownership
2. validate item types/domains/fields
3. update/create approved NoteItems
4. mark `is_confirmed = true`
5. preserve original AI prediction in log
6. record enough information to evaluate corrections
7. set Note status `PROCESSED`

Do not trust client-submitted domain IDs belonging to hidden/unapproved data without validation.

---

## Correction tracking
At minimum preserve:
- original AI parsed output
- final confirmed structured output

This allows later calculation of:
- type correction rate
- domain correction rate
- extraction correction rate

Do not build advanced ML learning from corrections in V1.

---

# STEP F — REAL TASKS/EVENTS/EXPENSES PAGES

Replace the corresponding Part 1 mock pages with real confirmed NoteItems.

## Tasks
Query confirmed `TASK` items for current user.
Support:
- list
- complete/uncomplete
- basic editing

## Events
Query confirmed `EVENT` items.
Show:
- date/time
- domains
- title

## Expenses
Query confirmed `EXPENSE` items.
Show:
- title/item
- amount/currency
- quantity/unit if available
- date
- domains

Keep Shopping partially derived from real Shopping-domain Tasks, but location grouping can remain mocked until Part 5.

## Information
No dedicated page is required unless useful. Information items can appear in Notes/Search later.

---

# STEP G — FAILURE HANDLING

AI must never control whether a Note is saved.

If Groq:
- times out
- quota/rate limit occurs
- network fails
- returns invalid schema
- returns unsupported values

Then:
- raw Note remains saved
- `processing_status = FAILED`
- AIProcessingLog records failure safely
- UI displays: `AI organization failed. Your note is saved.`

Actions:
- Retry AI Analysis
- Organize Manually

Do not delete the Note or make it unusable.

---

## Manual organization fallback
Provide a simple manual method to create at least one NoteItem when AI fails.

Fields may include:
- type
- title
- domains
- relevant date/amount fields

Keep it simple.

---

# STEP H — MANUAL TEST CASES

Test at minimum:

### Simple event
`I have an EM quiz on September 23.`
Expected Event + Education.

### Shopping task
`I need eggs from Agora.`
Expected Task + Shopping + place hint Agora.

### Expense
`I bought 300gm chilli for 50 taka.`
Expected Expense + Shopping/Finance + 300 gram + 50 BDT.

### Multi-item
`Tomorrow class at 10, buy eggs afterwards, and today I spent 250 taka on books.`
Expected 3 NoteItems.

### Information
`My project supervisor prefers weekly progress updates.`
Expected Information, likely Education/Work depending context.

### Ambiguous
`Get that thing from Rahim tomorrow.`
Expected uncertainty/null where unknown, not invented object.

### AI failure
Simulate API exception. Raw Note must remain.

### Security
User B cannot analyze/confirm User A's note.

## Automated AI verification
Use Vitest/React Testing Library for frontend AI Review behavior and the selected Django test stack for backend behavior. Mock Groq responses in ordinary tests; never require a live Groq request or API quota for the test suite.

Required automated cases:
- valid structured output passes schema validation
- malformed, incomplete, or unexpected output is rejected safely
- event, task, expense, information, and multi-item extraction
- ambiguous input does not cause invented facts
- timeout, provider error, invalid JSON, and retry behavior
- raw Note remains available after every AI failure
- review edit, remove, confirm, and manual fallback behavior
- User B cannot analyze, confirm, or read User A's note/items
- frontend loading, success, validation-error, provider-error, and retry states

Use fixed fixtures for repeatable expected outputs. Keep original AI output and corrected output testable for later evaluation.

---

## Backend API additions (approximate)
- `POST /api/v1/notes/:id/analyze/`
- `POST /api/v1/notes/:id/confirm-analysis/`
- `GET /api/v1/items/`
- `GET /api/v1/items/:id/`
- `PATCH /api/v1/items/:id/`

Optional filters:
- `?type=TASK`
- `?domain=shopping`
- `?status=PENDING`

Keep API simple and documented.

---

## Documentation
Update:
- `docs/ai-design.md`
- `docs/api.md`
- `docs/architecture.md`
- README setup for `GROQ_API_KEY`

Document:
- model used
- prompt version
- schema
- failure behavior
- review flow
- known limitations

Do not claim the AI is always correct.

---

## Acceptance criteria
Part 3 is complete only when:
1. Raw notes are still saved independently of AI.
2. Groq key is backend-only.
3. AI response is schema-validated.
4. Simple tasks/events/expenses are extracted.
5. One Note can generate multiple NoteItems.
6. Multiple domains are supported.
7. User can review/edit/remove AI results.
8. Confirmed items persist.
9. Tasks page uses real items.
10. Events page uses real items.
11. Expenses page uses real items.
12. AI failures leave notes intact.
13. Retry/manual fallback exists.
14. AI original output and corrected output are preservable for evaluation.
15. No embeddings/RAG/location code has been introduced.
16. Automated AI, backend, frontend, security, and failure-path tests pass.
17. Routine tests use mocked Groq responses and require no production secrets.

---

## Deliverable before implementation
Before changing files, provide:
1. current Part 2 architecture summary
2. proposed NoteItem/Domain/AIProcessingLog schema
3. exact Groq JSON schema
4. prompt strategy
5. analyze/confirm endpoint design
6. retry/re-analysis policy
7. correction tracking design
8. frontend AI Review component plan
9. files to create/modify
10. exact step-by-step implementation order
11. testing checklist
12. key risks

Then wait for:

`IMPLEMENT PART 3 — STEP A`
