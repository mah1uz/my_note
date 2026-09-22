# PART 6 OF 6 — SMART DASHBOARD, SEARCH/RAG EVALUATION, FRONTEND POLISH & DEPLOYMENT

## Project
AI Context-Aware Note-Taking Web Application

## Starting point

Parts 1–5 should now provide:
- Next.js App Router + TypeScript frontend
- Django/DRF/PostgreSQL backend
- UUID AppUser ownership
- authentication + user isolation
- real Notes CRUD
- Groq structured extraction/review
- real Tasks / Events / Shopping / Expenses / Study views
- collapsible premium sidebar
- Your Space cards/modals
- Universal Search
- deterministic regex/query parser
- structured SQL analytics
- PostgreSQL full-text search
- pgvector semantic retrieval
- hybrid ranking
- strict grounded Ask My Notes
- Places
- time/location reminders
- active browser location mode
- nearby Shopping aggregation

Part 6 finishes the product for capstone demonstration and production readiness.

---

# Goal

Finish:
- real What Matters Now
- real Daily AI Briefing
- useful Expense Dashboard
- rigorous query-parser/retrieval/RAG evaluation
- final Next.js motion/UX pass
- accessibility
- automated release testing
- security/privacy review
- performance/reliability
- deployment
- documentation
- repeatable demo

Do not add unrelated features.

---

# Implementation order

### Step A — Full audit / remove mocks
### Step B — What Matters Now
### Step C — Daily AI Briefing
### Step D — Expense Dashboard
### Step E — Query parser / retrieval / RAG evaluation
### Step F — Next.js interaction + accessibility hardening
### Step G — Automated release testing
### Step H — Security/privacy review
### Step I — Performance/reliability
### Step J — Deployment
### Step K — Documentation + demo readiness

---

# STEP A — Full audit

Inspect:
- leftover Vite artifacts
- dead routes/components
- duplicated API clients
- mock production data
- hardcoded URLs
- stale auth code
- ownership gaps
- unsafe regex
- unbounded search input
- any model-based intent-classifier code — there should be none
- RAG paths without source validation
- location data leaking into search/RAG
- browser console errors
- Next.js hydration warnings
- animation jank
- accessibility gaps
- committed secrets
- stale docs

Do not broad-refactor merely for aesthetics.

---

# STEP B — What Matters Now

Use deterministic scoring.

Candidates:
- overdue Tasks
- due-soon Tasks
- upcoming Events
- high-importance items
- nearby Shopping when Location Mode is active

Exclude:
- completed
- cancelled
- archived

Example exclusive temporal buckets:

```text
overdue              +100
due <= 1 hour         +80
due today             +60
due <= 3 days         +30
due <= 7 days         +10
pending                +5
high importance       +40
```

Avoid temporal double counting.

Return:
- item id
- title
- type
- domains
- score
- reasons
- due/start info

Frontend:
- explainable animated priority cards
- smooth layout reorder
- reduced-motion users get stable immediate changes
- never label the score as mysterious AI confidence

---

# STEP C — Daily AI Briefing

Django determines facts first.

Possible facts:
- today's Tasks
- overdue Tasks
- upcoming Events
- highest-priority items
- pending Shopping
- recent Expense summary

Pipeline:

```text
Django structured facts
    ↓
compact briefing JSON
    ↓
Groq
    ↓
concise prose
```

Rules:
- supplied facts only
- no outside knowledge
- no invented tasks
- no motivational filler
- do not change dates/amounts
- urgent first
- concise

If Groq fails:
- dashboard remains useful
- optionally use deterministic fallback copy

Do not send all raw Notes.

---

# STEP D — Expense Dashboard

PostgreSQL/Django performs all arithmetic.

Display:
- selected month total
- recent expenses
- primary-domain totals
- largest expenses
- count
- simple date/month filter

Use one primary reporting domain so multi-domain expenses are counted once.

Cross-check Universal Search queries against the dashboard.

Examples:

```text
where did I spend the most money?
how much did I spend last month?
largest education expense
```

Search answers and dashboard values must agree.

---

# STEP E — Query parser / retrieval / RAG evaluation

This is a major capstone requirement.

## 1. Regex/query-parser dataset

Create approximately 100–200 labelled queries.

Include:
- money expressions
- BDT/Tk/৳
- USD/$
- over/under
- MAX/MIN
- SUM/AVG/COUNT
- type cues
- domain cues
- status cues
- quoted phrases
- date ranges
- relative dates
- ambiguous phrasing
- spelling variation
- long inputs
- Unicode
- adversarial regex inputs

Evaluate:
- amount/currency parsing accuracy
- operator extraction accuracy
- date-resolution accuracy
- field precision/recall
- false-hard-filter rate
- explicit type/domain/status extraction accuracy

There is no intent-classifier metric because no classifier model should exist.

## 2. Retrieval benchmark

Create labelled query/relevant-item pairs.

Compare:

```text
vector-only
lexical-only
hybrid
```

Metrics:
- Recall@K
- MRR
- Precision@K
- nDCG@K if graded labels exist
- latency
- no-result rate

Do not claim hybrid is best without measuring it.

## 3. Structured analytics evaluation

Queries such as:

```text
largest expense
total this month
average expense
unfinished task count
events next week
```

must match deterministic fixture answers exactly.

## 4. Strict RAG evaluation

Evaluate:
- source relevance
- source-ID validity
- citation/source coverage
- unsupported-claim rate
- abstention correctness
- prompt-injection resistance
- conflict handling
- deterministic-answer bypass

Release targets:

```text
cross-user source leakage = 0
invalid source IDs displayed = 0
known unsupported factual claims in labelled test set = 0
```

If generation cannot be validated, show abstention.

---

# STEP F — Next.js frontend experience hardening

Use the updated `fluid-interactive-website-prompt.md` as the frontend interaction source of truth.

## Sidebar

Verify:
- smooth collapse/expand
- no label jitter
- active indicator
- tooltips in collapsed state
- mobile drawer
- keyboard navigation
- harmless persisted UI preference
- logout clearly separated

## Your Space

Verify:
- responsive card grid
- useful compact previews
- card-to-modal transition
- X/Escape/backdrop close
- focus trap
- focus restore
- scroll lock
- mobile full-screen sheet
- large list pagination/virtualization only if actually needed

## Universal Search

Verify:
- available globally
- Cmd/Ctrl+K
- desktop split layout
- mobile tabs
- correct relevance placement
- source navigation
- stale request cancellation
- provider outage leaves left Search Notes usable
- right answer always belongs to current query

## Motion quality

Target:
- expressive
- tactile
- premium
- animation-forward
- immediately usable

Use:
- shared motion tokens
- layout animation
- spring transitions
- blur/opacity/scale overlays
- restrained stagger
- polished skeletons
- tactile press feedback

Do not use:
- particle systems
- cursor trails
- WebGL decoration
- scroll-jacking
- long cinematic loaders
- constant animated backgrounds

## Reduced motion

Everything must remain usable under:

```text
prefers-reduced-motion: reduce
```

---

# STEP G — Automated release testing

## Frontend

Use the Next.js-compatible test setup.

Expected:
- Vitest
- React Testing Library
- user-event
- jest-dom
- Playwright

Test:
- auth/protected routes
- Notes CRUD
- AI Review
- BYOK
- Sidebar
- Your Space
- Universal Search
- Search Notes
- Ask My Notes
- stale request cancellation
- Places
- Reminders
- location errors
- What Matters Now
- Daily Briefing
- Expense Dashboard
- loading/error/empty states

## Backend

Use Django TestCase/APITestCase.

Test:
- ownership
- UUID lookup behavior
- auth identity mapping
- Notes/NoteItems
- AI structured validation
- regex parser
- structured search
- FTS
- embedding lifecycle
- vector user isolation
- hybrid retrieval
- RAG context/source validation
- Place/Reminder isolation
- Expense aggregates
- priority scoring
- briefing preparation

Mock Groq in routine tests.

## Critical Playwright journeys

At least:
1. auth
2. Quick Capture
3. AI review/confirm
4. multi-item Note
5. Your Space updates
6. semantic/hybrid search
7. grounded answer
8. structured expense query
9. open/close Space modal
10. sidebar collapse/expand
11. Place + reminder
12. mocked location entry
13. What Matters Now
14. Daily Briefing
15. logout

Run representative desktop and mobile viewports.

No browser console or hydration errors.

---

# STEP H — Security / privacy

## Secrets
- Django secret env-only
- DB URL env-only
- Groq server key env-only
- BYOK remains non-persistent
- Supabase secret/service credentials backend-only
- only safe values use `NEXT_PUBLIC_`

## Search
- query length limit
- regex complexity/timeout safety
- user scope before exposure
- no cross-user cache
- no raw vectors
- no admin-only artifacts
- no live GPS leakage

## Strict RAG
- notes treated as untrusted data
- context delimiting
- no outside knowledge
- no prompt instructions from notes
- source ID validation
- no generated answer on validation failure
- insufficient-context fallback

## Location
- optional
- OFF by default
- no movement history
- live GPS never sent to Groq
- precise Places excluded from admin content views

## Deletion
Deleting a Note must cascade according to DB policy:
- NoteItems
- embeddings
- reminders
- AI artifacts

---

# STEP I — Performance / reliability

## Next.js

Measure:
- route bundles
- search overlay bundle
- map lazy-load bundle
- hydration time
- unnecessary client components
- rerenders
- modal/list rendering
- font strategy

Do not mark the whole app `use client`.

## Motion

Prefer:
- transform
- opacity

Avoid layout-thrashing animations.

Test on:
- mid-range laptop
- mobile emulation
- reduced-motion mode

## Backend

Review:
- select_related/prefetch_related
- query counts
- PostgreSQL indexes
- vector latency
- FTS latency
- structured analytics indexes
- top-K caps
- bounded RAG context
- embedding-model caching
- provider timeouts
- duplicate requests

Do not add Redis/Celery unless proven necessary.

---

# STEP J — Deployment

Target concept:

```text
Next.js frontend -> Vercel or comparable
Django backend   -> Render/Fly/comparable
PostgreSQL       -> implemented provider
Auth             -> Supabase Auth if implemented
```

Frontend env examples:

```text
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Never expose:

```text
NEXT_PUBLIC_GROQ_API_KEY
NEXT_PUBLIC_DATABASE_URL
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
```

Backend:
- DJANGO_SECRET_KEY
- DATABASE_URL
- optional GROQ_API_KEY fallback
- ALLOWED_HOSTS
- CORS_ALLOWED_ORIGINS
- Supabase backend verification/admin credentials if used

Deployment smoke:
1. migrations
2. backend health
3. auth
4. CORS
5. Next.js production build
6. Universal Search
7. strict RAG abstention
8. provider failure
9. Places permission flow
10. mobile smoke

---

# STEP K — Documentation

Update:
- README
- architecture
- ERD
- API
- AI design
- search/RAG
- location reminders
- deployment
- testing/evaluation
- frontend architecture
- motion/interaction guide

Document specifically:
- no intent-classifier model
- deterministic regex/query parser
- hard-filter vs soft-hint rules
- structured SQL analytics
- pgvector + FTS hybrid search
- relevance-score meaning
- deterministic-answer shortcut
- strict RAG validation
- user isolation
- location/search privacy boundary
- Next.js architecture
- reduced-motion support

---

# Final demo flow

1. register/login
2. Quick Capture:
   `Tomorrow I have class at 10, buy eggs from Agora afterwards, and I spent 250 taka on books.`
3. AI extracts three items
4. edit + confirm
5. open Your Space
6. Tasks / Events / Expenses / Shopping previews update
7. expand a Space card
8. collapse/expand sidebar
9. open Universal Search with Cmd/Ctrl+K
10. query:
   `university work I need to worry about`
11. left shows ranked sources + Relevance
12. right shows grounded answer + sources
13. query:
   `where did I spend the most money?`
14. show deterministic SQL-backed answer
15. show saved Agora Place
16. simulate location entry
17. show aggregated Shopping alert
18. What Matters Now
19. Daily Briefing
20. Expense Dashboard
21. briefly show retrieval/RAG evaluation

Do not depend on physical movement.

---

# Final acceptance criteria

The project is complete only when:
1. Next.js is the production frontend.
2. no important production page uses mock data.
3. auth/ownership are secure.
4. raw Notes remain source of truth.
5. AI extraction/review works.
6. Your Space is real.
7. Universal Search works globally.
8. no intent-classifier model exists.
9. regex/query parsing is tested.
10. structured analytics are correct.
11. pgvector semantic retrieval works.
12. PostgreSQL FTS works.
13. hybrid retrieval is evaluated.
14. Search Notes ranks useful evidence.
15. relevance is labelled correctly.
16. strict RAG uses only retrieved context.
17. invalid/unsupported generated answers are withheld.
18. Places/reminders/location work within web limits.
19. What Matters Now is deterministic.
20. Daily Briefing is grounded in structured facts.
21. Expense calculations are deterministic.
22. interaction quality is polished.
23. reduced-motion/accessibility works.
24. backend/frontend/E2E tests pass.
25. security/privacy review passes.
26. production deployment smoke passes.
27. docs are current.
28. demo flow is repeatable.
29. limitations are documented.
30. no unnecessary V2 feature was added.

---

# Deliverable before implementation

Provide:
1. full audit
2. mock/technical-debt inventory
3. priority-scoring design
4. briefing context schema
5. expense aggregation policy
6. regex/query-parser evaluation plan
7. retrieval benchmark plan
8. strict RAG evaluation plan
9. frontend UX/motion audit
10. accessibility checklist
11. backend/frontend/E2E release plan
12. security/privacy checklist
13. performance risks
14. deployment plan
15. documentation gaps
16. exact step order
17. demo checklist

Then wait for:

`IMPLEMENT PART 6 — STEP A`
