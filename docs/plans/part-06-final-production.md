# PART 6 OF 6 — SMART DASHBOARD, EVALUATION, TESTING & DEPLOYMENT

## Project
AI Context-Aware Note-Taking Web Application

## Starting point
Parts 1–5 should provide a functioning product with:
- React frontend
- Django/DRF/PostgreSQL backend
- authentication
- Notes CRUD
- Groq extraction/review
- real Tasks/Events/Expenses
- semantic search
- RAG Q&A
- saved Places
- time reminders
- active browser location reminders
- shopping place aggregation

Part 6 finishes the capstone by adding the final smart dashboard behavior, evaluation, reliability/security work, and deployment.

---

## Role and working rules
Act as a senior software engineer preparing a university capstone for demonstration and deployment.

Before changing files:
1. Inspect the full Parts 1–5 codebase.
2. Identify technical debt/unfinished mocks.
3. Present the Part 6 plan.
4. Separate must-fix issues from optional polish.
5. Wait for `IMPLEMENT PART 6 — STEP A`.

Do not add unrelated new product features.
Do not turn V1 into a larger project.

---

## Goal
Finish:
- real What Matters Now prioritization
- real Daily AI Briefing
- useful Expense Dashboard
- AI/retrieval evaluation
- frontend/backend automated tests
- security review
- performance/reliability cleanup
- documentation
- deployment
- capstone demo readiness

---

## Implementation order
### Step A — Remove remaining mocks / technical audit
### Step B — What Matters Now engine
### Step C — Daily AI Briefing
### Step D — Expense Dashboard
### Step E — AI & retrieval evaluation suite
### Step F — Automated testing
### Step G — Security/privacy review
### Step H — Performance/reliability cleanup
### Step I — Deployment
### Step J — Final documentation/demo checklist

---

# STEP A — FULL PROJECT AUDIT

Before new code, inspect for:
- remaining mock data in production pages
- hardcoded URLs
- duplicated business logic
- missing ownership filters
- TODOs from previous parts
- unused packages
- stale components
- inconsistent statuses/domains
- API error handling gaps
- incorrect loading/empty states
- secrets accidentally committed

Create a concise audit report.

Do not perform broad refactors unless needed for correctness or maintainability.

---

# STEP B — WHAT MATTERS NOW

## Goal
Prioritize actionable items using deterministic logic, not Groq.

Input candidates:
- pending Tasks
- upcoming Events
- overdue Tasks
- high-importance items
- shopping tasks relevant to current nearby place when Location Mode is active

Exclude:
- completed
- cancelled
- archived

## Backend base score
Implement an explainable scoring service.

Example starting rules (tune after tests):
- overdue: +100
- due within 1 hour: +80
- due today: +60
- high importance: +40
- due within 3 days: +30
- due within 7 days: +10
- pending: +5

Avoid double-counting temporal buckets incorrectly. Design ordered/exclusive time rules.

Location relevance is live client context, so either:
- add a client-side score/boost after receiving backend items, or
- send a coarse relevant Place ID only when explicitly needed

Prefer not to send continuous GPS coordinates.

## Endpoint
Approximately:
`GET /api/v1/dashboard/what-matters/`

Return:
- note_item_id
- title
- type
- domains
- score
- human-readable reason(s)
- due/start info

Example:
```json
{
  "id": 12,
  "title": "Register for gaming show",
  "score": 85,
  "reasons": ["Due in 40 minutes"]
}
```

## Frontend
Replace mock dashboard priority cards with real data.

Show reasons so ranking is explainable.

Do not display a mysterious AI priority score.

---

# STEP C — DAILY AI BRIEFING

## Goal
Use Groq only to convert structured relevant daily data into concise prose.

Django first determines facts.

Possible briefing context:
- today's tasks
- overdue tasks
- today's/upcoming events
- highest-priority items
- pending shopping items
- recent expense total/summary

Do **not** send all notes to Groq.

## Pipeline
```text
Django queries structured data
  ↓
creates compact briefing JSON
  ↓
Groq receives facts only
  ↓
returns concise briefing
  ↓
React renders it
```

## Prompt rules
- use only supplied facts
- do not invent activities
- do not add motivational filler
- prioritize clarity and brevity
- mention urgent items first
- never change dates/amounts

## Fallback
If Groq fails:
- dashboard still shows structured lists/cards
- optionally show a deterministic text summary

The app must remain useful without AI prose.

## Caching
A briefing can be cached per user/date if helpful.
Invalidate/regenerate when material daily data changes or provide Refresh.

Do not overbuild cache infrastructure.

---

# STEP D — EXPENSE DASHBOARD

## Goal
Make extracted expenses genuinely useful without becoming accounting software.

Backend/database calculates all arithmetic.
Groq must not calculate totals.

Display:
- selected month total
- recent expenses
- totals by domain/category
- basic date/month filter
- optionally most frequent/top spending categories if simple

Example:
```text
September total: ৳4,850
Shopping: ৳2,300
Education: ৳1,200
Transport: ৳900
Other: ৳450
```

If domains overlap (e.g. Expense has Shopping + Finance), define a consistent aggregation policy so one expense is not double-counted.

Possible rule:
- use a dedicated expense category derived from domains, or
- select one primary reporting category

Decide and document before implementation.

Do not add budgets, bank integrations, tax/accounting features, or complex forecasting.

---

# STEP E — AI AND RETRIEVAL EVALUATION

## Goal
Make the AI-engineering aspect measurable rather than merely saying "uses AI".

Create an offline test dataset of approximately 100–200 notes.

Each labelled example should include expected values as applicable:
- item count
- item type(s)
- domains
- dates/times
- amount
- currency
- quantity/unit
- place hint

Include:
- simple tasks
- events
- expenses
- information
- multi-intent notes
- relative dates
- ambiguous notes
- spelling variation
- shopping/education/finance/work examples

Do not include private production user notes in the test dataset without explicit anonymization/consent.

## Metrics
Calculate useful metrics such as:
- item-type accuracy/F1
- domain multi-label precision/recall/F1
- amount extraction exact accuracy
- date extraction exact/tolerance accuracy
- item-count/multi-intent correctness
- schema failure rate
- AI API failure rate
- user correction rate from application logs

Do not treat model self-reported confidence as true accuracy.

## Retrieval evaluation
Create a smaller labelled query set for semantic search.

Potential metrics:
- Recall@K
- MRR
- Precision@K where labels allow

Example:
Query: `upcoming university work`
Relevant: EM Quiz, Database Assignment

## RAG evaluation
For selected questions, check:
- source relevance
- factual consistency with source notes
- insufficient-context correctness
- citation/source correctness

Keep evaluation scripts outside normal production request flow.

---

# STEP F — AUTOMATED TESTING

## Frontend
Use Vitest + React Testing Library, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, and `@vitest/coverage-v8`. Use Playwright for critical end-to-end browser flows.

Prioritize tests for:
- Quick Capture behavior
- auth-protected routing
- AI Review editing/confirmation
- Search Notes rendering
- Ask My Notes source display
- Shopping grouping
- Location mode UI states
- What Matters Now rendering
- error/empty/loading states

Do not test implementation details excessively.

Frontend release tests must cover the complete critical journeys: registration/login, note capture, AI review, task/event/expense updates, search/RAG source display, shopping aggregation, location-mode failure handling, and logout. Include responsive smoke coverage and verify that no browser console errors occur on primary routes.

## Backend
Use Django `TestCase`/`APITestCase` consistently for backend and API tests. Do not mix in a second backend test framework without a documented reason.

Test:
- auth
- user ownership
- serializers/models
- Notes CRUD
- analyze/confirm validation with mocked Groq
- NoteItem filtering
- embedding lifecycle
- semantic-search user isolation
- RAG context isolation
- Reminder ownership/validation
- expense aggregation
- priority scoring
- Daily Briefing data preparation

Backend release tests must include migrations, authorization, user isolation, validation, provider failures, transaction/persistence behavior, and regression coverage for every previously completed part. Use factories or isolated fixtures and never depend on production data.

Mock Groq in routine automated tests.
Do not spend API quota in ordinary test suite.

## Browser/API utility tests
Test pure functions:
- Haversine
- date helpers
- scoring logic
- aggregation helpers

## Quality gates and release verification
- All frontend, backend, integration, and Playwright tests pass.
- Critical authorization and user-isolation tests pass.
- AI and retrieval evaluation results meet documented thresholds.
- Coverage reports are generated and reviewed; coverage percentage is not a substitute for meaningful assertions.
- No committed secrets, unexpected network calls, or browser console errors exist in the tested flows.
- Manual responsive, accessibility, deployment smoke, and failure-recovery checks are completed.
- Any known failing test, flaky test, security issue, or unverified critical path blocks release until documented and resolved.

No test strategy can mathematically guarantee a bug-free system. These gates provide repeatable evidence and prevent declaring the project complete while critical behavior remains untested.

---

# STEP G — SECURITY & PRIVACY REVIEW

Review and fix:

## Secrets
- `DJANGO_SECRET_KEY` env-only
- `GROQ_API_KEY` backend-only
- `DATABASE_URL` env-only
- no secrets in Git/history where preventable

## Django production
- `DEBUG=False`
- restricted `ALLOWED_HOSTS`
- restricted CORS
- CSRF/JWT strategy understood
- secure HTTPS deployment

## Authorization
Every user-owned queryset must be scoped:
- Notes
- NoteItems
- Places
- Reminders
- Embeddings
- semantic search
- RAG sources

## Input validation
Validate:
- AI structured output
- user edits
- coordinates/radius
- reminder datetime
- query lengths
- RAG question lengths

## Rate limits
Apply sensible throttling/rate limits to costly endpoints where practical:
- analyze
- re-analyze
- RAG ask
- Daily Briefing refresh

## RAG safety
- retrieved notes are untrusted content
- defend against prompt instructions embedded in notes
- never retrieve cross-user content
- never send server secrets/logs to Groq

## Location privacy
- location mode explicit/off by default
- no movement history stored
- live GPS not sent to Groq
- clear permission messaging

## Data deletion
When user deletes a Note, ensure derived data follows intended cascade:
- NoteItems
- embeddings
- reminders where applicable

Document behavior.

---

# STEP H — PERFORMANCE & RELIABILITY

Review without premature optimization.

Potential improvements:
- select_related/prefetch_related for NoteItems/Domains
- indexes on common filters/dates/status/user FKs
- avoid N+1 queries
- cache/load SentenceTransformer once per process appropriately
- cap semantic top-K/context size
- pagination for Notes/Items if needed
- avoid duplicate Groq requests
- avoid repeated Daily Briefing regeneration
- proper abort/loading behavior on frontend requests where useful

Do not add Redis/Celery merely for prestige.

If free hosting sleeps or has cold starts, document as infrastructure limitation.

---

# STEP I — DEPLOYMENT

## Target architecture
Frontend:
- Vercel or comparable free static hosting

Backend:
- Render or comparable Python hosting

Database:
- Neon PostgreSQL

Actual provider may change if free-tier conditions change. Keep deployment provider-specific settings isolated.

## Environment variables
Backend conceptually:
- `DJANGO_SECRET_KEY`
- `DEBUG`
- `DATABASE_URL`
- `GROQ_API_KEY`
- `ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`

Frontend:
- `VITE_API_BASE_URL`

Never put Groq key in Vite variables.

## Deployment process
1. run tests locally
2. build React locally
3. check Django production settings
4. deploy database/migrations
5. deploy backend
6. verify health/admin/API
7. deploy frontend with correct API URL
8. verify CORS/auth
9. run production smoke tests

## Vector/embedding deployment concern
SentenceTransformer model size/startup may be significant on very small free backend hosting.

Before final deployment, measure whether the chosen host can load it reliably.

If not, present options before changing architecture, such as:
- a smaller compatible embedding model
- hosted embedding alternative with free quota
- separate embedding service

Do not silently replace the planned model without documenting migration/re-embedding consequences.

---

# STEP J — FINAL DOCUMENTATION

Ensure these are current:
- `README.md`
- `docs/requirements.md`
- `docs/architecture.md`
- `docs/erd.md`
- `docs/api.md`
- `docs/ai-design.md`
- `docs/search-rag.md`
- `docs/location-reminders.md`
- `docs/deployment.md`
- `docs/testing-evaluation.md`

README should include:
- product purpose
- feature list
- stack
- architecture summary
- local setup
- environment variables
- development commands
- screenshots if available
- known limitations
- deployment link(s)

Known limitations should honestly include web location/background constraints.

---

# FINAL CAPSTONE DEMO FLOW

Prepare a reliable demonstration using seeded demo user/data.

Suggested demo:

1. Register/login.
2. Quick Capture:
   `Tomorrow I have class at 10, buy eggs from Agora afterwards, and I spent 250 taka on books.`
3. Show raw Note saved first.
4. Analyze with Groq.
5. Show 3 extracted items.
6. Edit/confirm analysis.
7. Show Event/Shopping/Expense pages updated.
8. Search semantically:
   `university work I need to worry about`
9. Ask My Notes:
   `What academic events do I have?`
10. Show source notes.
11. Show saved Agora place and assigned Eggs shopping item.
12. Demonstrate Location Mode with mocked/dev coordinates if physically moving is impractical during presentation.
13. Show shopping aggregation.
14. Show What Matters Now.
15. Show Daily Briefing.
16. Show expense summary.
17. Briefly show AI evaluation results.

Do not depend on physically travelling to a shop during a live capstone demo. Provide a safe developer/demo method to simulate proximity without compromising production behavior.

---

# DEMO/DEVELOPMENT LOCATION SIMULATION

Create a development-only mechanism if needed to test location proximity without moving physically.

Requirements:
- unavailable/disabled in production
- clearly labelled `DEV ONLY`
- allows selecting mock latitude/longitude or saved place
- feeds the same proximity logic used by real geolocation

This makes testing/demo repeatable.

Do not create a hidden production backdoor.

---

# PRODUCT SCOPE FREEZE

Do not add before capstone completion:
- native app
- WhatsApp
- SMS
- OCR
- social features
- collaboration
- complex calendar integration
- custom model training
- AI agents
- voice assistant
- recommendation engine
- gamification

Record these only as possible future work.

---

## Final acceptance criteria
The project is complete only when:
1. no important production page relies on mock data
2. authentication and user isolation are secure
3. raw Notes CRUD works
4. AI structured extraction/review works with graceful failure
5. real Tasks/Events/Expenses work
6. semantic search works
7. RAG answers are grounded with sources
8. Places/reminders/location mode work within stated web limitations
9. shopping aggregation works
10. What Matters Now is real and explainable
11. Daily Briefing uses structured facts and has fallback
12. Expense Dashboard calculations are deterministic
13. AI/retrieval evaluation scripts/results exist
14. automated frontend/backend tests cover critical paths
15. security/privacy checklist is addressed
16. project deploys successfully or deployment limitations are precisely documented
17. README/docs are current
18. capstone demo path is repeatable
19. known limitations are stated honestly
20. no unnecessary V2 features were added

---

## Deliverable before implementation
Before changing files, provide:
1. full-project audit
2. list of remaining mock/incomplete features
3. What Matters Now scoring design
4. Daily Briefing data schema/prompt design
5. expense aggregation/category policy
6. AI evaluation dataset/metric plan
7. semantic/RAG evaluation plan
8. frontend/backend testing plan
9. security/privacy checklist
10. performance risks
11. deployment plan including embedding-model hosting risk
12. documentation gaps
13. exact step order
14. release/demo checklist

Then wait for:

`IMPLEMENT PART 6 — STEP A`
