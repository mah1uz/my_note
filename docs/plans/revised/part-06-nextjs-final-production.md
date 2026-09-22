# PART 6 OF 6 — SMART DASHBOARD, EVALUATION, HARDENING & DEPLOYMENT

## Project
AI Context-Aware Note-Taking Web Application — My Notes

## Starting point

Parts 1–5 should provide:
- Next.js App Router + TypeScript frontend
- Django/DRF backend
- Supabase PostgreSQL
- Supabase Auth
- UUID AppUser ownership
- raw Notes CRUD
- Groq structured extraction/review
- session-only BYOK + limited trial entitlement
- Tasks / Events / Shopping / Transactions / Study
- authoritative `finance_transactions`
- profession / priority preferences
- onboarding
- final Dashboard navigation
- Universal Search
- deterministic query parser
- PostgreSQL FTS
- pgvector semantic retrieval
- hybrid ranking
- strict grounded Ask My Notes
- Places
- time/location reminders
- active-session location mode
- nearby Shopping aggregation

Part 6 finishes the capstone.

Do not add unrelated product scope.

---

# 1. Final navigation — frozen

Keep:

```text
Dashboard
  Overview
  Tasks
  Events
  Shopping
  Transactions
  Study

Search
Places
Settings

----------------
Logout
```

Do not reintroduce:
- Your Space
- Expenses as a top-level destination

---

# 2. Implementation order

### Step A — Full audit / remove mocks
### Step B — What Matters Now
### Step C — Daily Briefing
### Step D — Transactions / Finance Dashboard
### Step E — Query parser / retrieval / RAG evaluation
### Step F — Next.js interaction + accessibility hardening
### Step G — Automated release testing
### Step H — Security/privacy review
### Step I — Performance/reliability
### Step J — Deployment
### Step K — Documentation + demo readiness

---

# 3. Step A — full audit

Inspect:
- leftover Vite code/artifacts
- obsolete `Your Space` routes/components
- stale `Expenses` routes used as finance source
- duplicate API clients
- mock production data
- hardcoded URLs
- stale auth code
- ownership gaps
- unsafe regex
- unbounded search input
- any model intent classifier
- RAG paths without source validation
- finance totals still using NoteItem amount
- location leaking into search/RAG
- browser console errors
- hydration warnings
- animation jank
- accessibility gaps
- committed secrets
- stale docs
- old Neon/Vite deployment instructions
- combined search/RAG endpoints that violate the Part 4 split

Do not broad-refactor for aesthetics.

Fix correctness, consistency, security and maintainability first.

---

# 4. What Matters Now — deterministic

Candidates:
- overdue Tasks
- due-soon Tasks
- upcoming Events
- explicit high-importance items
- optionally pending Shopping

Exclude:
- completed
- cancelled
- archived

Base scoring example:

```text
overdue               +100
due <= 1 hour          +80
due today              +60
due <= 3 days          +30
due <= 7 days          +10
pending                 +5
high importance        +40
```

Temporal buckets are exclusive.

Do not add all overlapping deadline scores.

---

# 5. Preference boosts

Consume Part 3.5 preferences:

```text
BALANCED
STUDY_FIRST
WORK_FIRST
```

Example modest boosts:

```text
Study first:
Education Task/Event +10

Work first:
Work Task/Event +10
```

Exact values should be tested, but profile boosts must not outrank:
- overdue
- due within 1 hour
- explicit HIGH importance

Expose reasons:

```text
Overdue
Due today
High importance
Study priority preference
```

No opaque AI score.

---

# 6. Nearby-shopping context

Part 5 keeps live GPS in browser memory.

Canonical split:

```text
Django
  -> base What Matters ranking

Browser
  -> knows nearbyPlaceId when Location Mode ON
  -> applies small deterministic boost to pending Shopping
     assigned to that saved Place
```

Example:

```text
Nearby saved place +8
```

Requirements:
- frontend reason shown
- no raw coordinates sent
- boost removed immediately when Location Mode OFF
- nearby boost never overpowers urgent deadlines
- reduced-motion users get immediate stable reorder

No location data is needed in the backend priority endpoint.

---

# 7. What Matters endpoint

Approximately:

```text
GET /api/v1/dashboard/what-matters/
```

Return base facts:

```text
item_id
title
item_type
domains
base_score
reasons
due/start info
importance
```

Do not return a fake confidence percentage.

Frontend may add the local nearby-shopping reason/boost.

---

# 8. Daily Briefing

Django determines facts first.

Possible facts:
- today's Tasks
- overdue Tasks
- upcoming Events
- highest-priority items
- pending Shopping count
- current-period finance summary from Transactions

Pipeline:

```text
structured Django facts
   ↓
bounded briefing payload
   ↓
Groq
   ↓
concise grounded prose
```

Rules:
- supplied facts only
- no outside knowledge
- no invented actions
- dates/amounts unchanged
- urgent first
- concise
- no motivational filler

If Groq fails:
- dashboard remains useful
- deterministic fallback summary is allowed

Do not send all raw Notes.

---

# 9. Transactions / Finance Dashboard

This replaces the old `Expense Dashboard` wording.

Financial source of truth:

```text
finance_transactions
```

Never calculate the dashboard from NoteItem amount fields.

Show:

```text
Current balance
Income this period
Expenses this period
Recent transactions
Largest debits
Primary-domain spending
Transaction count
```

Filters:

```text
This week
This month
Last month
Custom range
Currency
```

Tabs/segments:

```text
All
Expenses
Income
```

---

# 10. Finance arithmetic

PostgreSQL/Django performs all arithmetic.

For one currency:

```text
balance = CREDIT - DEBIT
```

Period boundaries use `AppUser.timezone`.

Different currencies remain separate.

No silent FX conversion.

Primary-domain totals use `finance_transactions.primary_domain_id`.

Do not double count multi-domain source NoteItems.

---

# 11. Search/dashboard consistency

These must agree:

```text
Transactions dashboard
Universal Search structured finance answers
Daily Briefing finance facts
```

Examples:

```text
where did I spend the most money?
how much did I spend last month?
largest education expense
income this month
```

All share the same deterministic finance services/query semantics.

Write cross-feature consistency tests.

---

# 12. Query-parser evaluation dataset

Create approximately 100–200 labelled queries.

Cover:
- BDT/Tk/৳
- USD/$
- credit/debit wording
- over/under
- MAX/MIN
- SUM/AVG/COUNT
- type cues
- Domain cues
- status cues
- quoted phrases
- dates
- relative dates
- timezone edges
- ambiguous wording
- spelling variation
- Unicode
- long inputs
- adversarial regex cases

Metrics:
- amount extraction accuracy
- currency extraction accuracy
- direction extraction accuracy
- operator accuracy
- date-resolution accuracy
- field precision/recall
- false-hard-filter rate
- type/domain/status extraction accuracy

No intent-classifier metric because no classifier exists.

---

# 13. Retrieval benchmark

Create labelled query/relevant-result pairs.

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
- nDCG@K if graded
- latency
- no-result rate

Do not claim hybrid is superior without measured results.

Include:
- NoteItem queries
- Transaction-label queries
- mixed source queries
- quoted exact phrases
- semantic paraphrases

---

# 14. Structured analytics evaluation

Queries such as:

```text
largest expense
total spent this month
income last month
average debit
unfinished task count
events next week
```

must match deterministic fixtures exactly.

Groq must not participate in expected arithmetic.

---

# 15. Strict RAG evaluation

Measure:
- source relevance
- source-ID validity
- citation/source coverage
- unsupported-claim rate
- abstention correctness
- prompt-injection resistance
- conflict handling
- deterministic-answer bypass
- cross-user leakage

Release targets:

```text
cross-user source leakage = 0
invalid displayed source IDs = 0
known unsupported factual claims in labelled suite = 0
```

When validation fails, withhold generated text.

---

# 16. Part 4 API split audit

Verify production uses:

```text
POST /api/v1/search/
POST /api/v1/search/answer/
```

`/search/`:
- deterministic parser
- structured query/hybrid retrieval
- deterministic answers
- no Groq dependency

`/search/answer/`:
- backend re-retrieves evidence
- strict context
- Groq only when needed

Do not regress to one slow endpoint where provider failure blocks search results.

---

# 17. Relevance honesty

Review UI labels.

Allowed:

```text
Relevance 94
Highly relevant
```

Avoid:

```text
94% confidence
94% correct
```

unless a calibrated probability model exists.

Document normalization.

---

# 18. Next.js experience hardening

Use the reconciled motion guide.

Target:
- fast
- fluid
- tactile
- calm
- immediately usable

Focus on:
- sidebar collapse/expand
- Dashboard group
- Universal Search
- category cards/sheets
- Transaction interactions
- task completion
- forms
- loading states
- route transitions

Do not rely on:
- particles
- cursor trails
- WebGL decoration
- moving backgrounds
- scroll-jacking
- long loaders

---

# 19. Sidebar hardening

Verify:
- no label jitter
- Dashboard child routes
- active state
- collapsed tooltips
- mobile drawer
- keyboard navigation
- harmless persisted UI preference
- logout visually separated

Dashboard collapsed behavior:
- icon may open child popover/flyout
- accessible keyboard support
- no hidden unreachable child routes

---

# 20. Category experience

Dashboard categories:

```text
Tasks
Events
Shopping
Transactions
Study
```

Verify:
- responsive summaries
- useful previews
- Add
- View all
- modal/sheet or route transitions
- focus trap where dialog used
- Escape
- backdrop behavior
- focus restore
- mobile full-screen sheet where appropriate

No `Your Space` naming in production UI/docs.

---

# 21. Universal Search hardening

Verify:
- global entry
- Cmd/Ctrl+K
- desktop split
- mobile tabs
- current-query request ownership
- cancellation
- provider outage isolation
- source navigation
- Transaction results
- abstention
- deterministic finance answers
- left results available before Groq

---

# 22. Reduced motion

Mandatory.

Under:

```text
prefers-reduced-motion: reduce
```

reduce/disable:
- Lenis
- stagger
- spring travel
- large transforms
- shared-layout zoom
- animated counters

Keep:
- visible focus
- essential state transition
- immediate content

No functionality depends on animation.

---

# 23. Accessibility audit

Keyboard:
- sidebar
- Dashboard children
- search shortcut
- result navigation
- dialogs/sheets
- source links
- forms
- onboarding replay
- transaction forms
- place/reminder controls

Verify:
- semantic buttons/links
- labels
- focus visibility
- dialog semantics
- focus trap
- focus restore
- screen-reader status for loading/error/success
- no color-only finance meaning

---

# 24. Automated frontend release tests

Use:
- Vitest
- React Testing Library
- user-event
- jest-dom
- Playwright

Cover:
- Supabase auth UI/session
- protected routes
- Notes CRUD
- AI review
- BYOK/trial
- onboarding
- Dashboard navigation
- Transactions
- finance summary
- sidebar
- Search
- grounded answer
- stale requests
- Places
- Reminders
- Location errors
- What Matters
- Briefing
- reduced motion
- loading/error/empty states

---

# 25. Backend release tests

Use Django TestCase/APITestCase.

Cover:
- auth identity mapping
- ownership
- Notes/NoteItems
- Transaction constraints
- finance aggregation
- timezone period boundaries
- UserPreferences
- trial entitlement
- AI validation
- query parser modules
- structured search
- FTS
- embeddings
- vector isolation
- hybrid retrieval
- RAG context/source validation
- Place/Reminder isolation
- priority base scoring
- briefing payload preparation

Mock Groq in routine tests.

---

# 26. Critical Playwright journeys

At least:

1. register/login
2. onboarding
3. Quick Capture
4. AI review/confirm
5. multi-item Note
6. DEBIT Transaction confirmation
7. CREDIT Transaction confirmation
8. Dashboard Transactions update
9. semantic/hybrid search
10. grounded answer
11. structured finance query
12. verify query value equals finance dashboard value
13. sidebar collapse/expand
14. Place creation
15. reminder creation
16. mocked location entry
17. nearby Shopping alert
18. What Matters
19. Daily Briefing
20. Settings preference change
21. logout

Desktop + mobile representative viewports.

No console/hydration errors.

---

# 27. Security / privacy review

## Secrets
Backend only:
- `DJANGO_SECRET_KEY`
- `DATABASE_URL`
- Groq server key
- Supabase secret/admin credentials if actually needed

Frontend public:
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Never expose:
- service-role/secret key
- database URL
- Django secret
- Groq server key

## Search
- input length cap
- regex safety
- owner scope first
- no cross-user cache
- no raw vectors
- no admin artifacts
- no live GPS

## RAG
- Notes untrusted
- context delimiters
- source validation
- abstention
- no outside knowledge
- no instructions from Notes

## Finance
- admin cannot read personal transaction rows/amounts
- no finance content in operational logs
- no client authoritative user IDs

## Location
- optional
- OFF default
- no movement history
- browser-only live GPS
- precise Places excluded from normal admin content

---

# 28. Deletion review

Deleting AppUser:
- cascades private application data per policy

Deleting Note:
- NoteItems
- embeddings
- reminders
- AI artifacts
- Note-derived Transaction through NoteItem cascade

Deleting Place:
- Shopping assignment -> SET NULL
- dependent LOCATION reminder -> delete/cascade

Manual Transaction:
- not tied to Note deletion

Test all cascades.

---

# 29. Performance — Next.js

Measure:
- route bundles
- Search overlay bundle
- map lazy bundle
- hydration
- client-component boundaries
- rerenders
- large lists
- font loading

Do not mark root app `use client`.

Dynamic import:
- map
- other genuinely heavy browser-only features

Virtualization/pagination only where real list size justifies it.

---

# 30. Performance — backend

Review:
- select_related/prefetch_related
- indexes
- query counts
- finance aggregation plans
- FTS latency
- vector latency
- top-K limits
- context caps
- embedding model process caching
- provider timeouts
- duplicate calls

Do not add Redis/Celery merely for architectural prestige.

Add only with measured need.

---

# 31. Embedding deployment risk

`all-MiniLM-L6-v2` may have:
- model download time
- memory footprint
- cold-start impact

Measure on target backend host.

If target host cannot run it reliably, document alternatives before changing:
- smaller compatible embedding model
- hosted embedding provider
- separate embedding service

A model change requires:
- documented dimension change if any
- migration
- full re-embedding
- retrieval re-evaluation

Do not silently swap models.

---

# 32. Deployment target

Canonical target:

```text
Next.js frontend -> Vercel or comparable
Django backend   -> Render/Fly/comparable
Database         -> Supabase PostgreSQL
Authentication   -> Supabase Auth
Google OAuth     -> Google Cloud + Supabase provider
```

Do not reintroduce Neon unless the project explicitly decides to migrate databases.

---

# 33. Production environment variables

Frontend:

```text
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Backend:

```text
DJANGO_SECRET_KEY
DATABASE_URL
DATABASE_SSL_REQUIRE
SUPABASE_URL
SUPABASE_AUTH_ENABLED
SUPABASE_JWT_AUDIENCE
SUPABASE_JWKS_URL
GROQ_API_KEY  # optional server fallback/trial only
ALLOWED_HOSTS
CORS_ALLOWED_ORIGINS
CSRF_TRUSTED_ORIGINS where applicable
```

Never print secrets in deployment logs.

---

# 34. Google OAuth deployment completion

Local Google OAuth may already work.

At production deployment:
1. deploy frontend;
2. know final production frontend origin;
3. know Supabase project callback;
4. add production frontend origin to Google OAuth client where required;
5. keep Supabase callback URI authorized in Google;
6. add production redirect URL(s) to Supabase Auth allow-list;
7. update Supabase Site URL;
8. test login/logout/callback in production.

Google OAuth remains Supabase-mediated.

Do not point Google directly at Django as the OAuth callback.

---

# 35. CORS / auth smoke

Production smoke:
- frontend can call Django
- only expected origins allowed
- Bearer Supabase access token accepted
- wrong issuer/audience rejected
- expired token rejected
- suspended AppUser rejected
- logout clears frontend session state
- admin remains separate

---

# 36. Deployment smoke

Run:
1. Django migrations
2. DB extension state
3. backend health
4. admin
5. auth
6. CORS
7. Next.js production build
8. Notes CRUD
9. Transaction summary
10. Search retrieval
11. deterministic finance answer
12. strict RAG abstention
13. provider failure
14. Places permission UI
15. reminder active-session behavior
16. mobile smoke

---

# 37. Documentation

Update:
- README
- architecture
- ERD
- API
- authentication
- AI design
- transaction/finance design
- search/RAG
- location/reminders
- deployment
- testing/evaluation
- frontend architecture
- motion guide

Document explicitly:
- Part 3.5 finance authority
- no top-level Your Space
- Transaction vs NoteItem
- no intent classifier
- deterministic parser
- search endpoint split
- relevance semantics
- strict RAG
- user isolation
- location privacy
- browser reminder limitation
- Next.js auth boundary
- reduced motion
- Supabase PostgreSQL deployment

---

# 38. Final demo flow

1. register/login
2. show onboarding/personalization briefly
3. Quick Capture:
   `Tomorrow I have class at 10, buy eggs from Agora afterwards, and I spent 250 taka on books.`
4. raw Note saves first
5. AI extracts structured items
6. edit/confirm
7. confirm DEBIT Transaction
8. add/confirm salary CREDIT example
9. open Dashboard -> Transactions
10. show balance/income/expense
11. collapse/expand Dashboard sidebar
12. Cmd/Ctrl+K
13. semantic query:
   `university work I need to worry about`
14. left ranked evidence
15. right grounded answer + sources
16. finance query:
   `where did I spend the most money?`
17. show deterministic answer
18. show same value in Finance Dashboard
19. saved Agora Place
20. simulated location entry
21. one aggregated Shopping alert
22. What Matters Now
23. Daily Briefing
24. retrieval/RAG evaluation
25. logout

Do not depend on physical movement.

---

# 39. Known limitations to state honestly

At minimum:
- browser reminders are active-session V1 behavior
- no background GPS history
- no native push while browser closed
- no bank integration
- no FX conversion
- no accounting/tax system
- English-first embedding/search assumptions if still true
- server embedding model may cold-start on small hosting
- Groq availability/quota affects AI organization/briefing, not raw Notes
- BYOK key disappears on refresh/logout by design

---

# 40. Product scope freeze

Do not add before capstone completion:
- native mobile app
- WhatsApp/SMS
- OCR
- collaboration
- complex calendar integration
- custom model training
- agents
- voice assistant
- recommendation engine
- banking
- investment tools
- gamification

---

# 41. Final acceptance criteria

The project is complete only when:

1. Next.js is production frontend.
2. final navigation is consistent.
3. no top-level Your Space remains.
4. Transaction ledger is finance authority.
5. no important production page uses mock data.
6. auth/user isolation secure.
7. raw Notes remain source of truth.
8. AI review/fallback works.
9. manual add works.
10. finance totals deterministic/timezone-correct.
11. Search works without Groq.
12. parser deterministic/tested.
13. FTS works.
14. pgvector works.
15. hybrid retrieval evaluated.
16. relevance labelled honestly.
17. strict RAG validates sources.
18. unsupported answers abstain.
19. Places/reminders work within web limits.
20. live GPS stays browser-only.
21. What Matters consumes preferences.
22. nearby Shopping boost stays privacy-preserving.
23. Daily Briefing grounded in structured facts.
24. finance/search values agree.
25. reduced motion/accessibility pass.
26. backend/frontend/E2E pass.
27. security/privacy review passes.
28. production deployment smoke passes.
29. Google OAuth production config passes if enabled.
30. docs are consistent.
31. demo repeatable.
32. limitations documented.
33. no unnecessary V2 scope added.

---

# 42. Deliverable before implementation

Provide:

1. full project audit
2. stale-doc/old-terminology inventory
3. mock/technical-debt inventory
4. What Matters scoring design
5. preference boost design
6. nearby client-context design
7. briefing payload schema
8. finance dashboard aggregation policy
9. cross-feature finance consistency plan
10. parser evaluation plan
11. retrieval benchmark
12. strict RAG evaluation
13. frontend UX/motion audit
14. accessibility checklist
15. release test matrix
16. security/privacy checklist
17. performance risks
18. deployment plan
19. Google OAuth production checklist
20. documentation gaps
21. exact implementation order
22. demo checklist

Then wait for:

`IMPLEMENT PART 6 — STEP A`
