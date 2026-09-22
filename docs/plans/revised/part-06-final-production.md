# PART 6 - SMART DASHBOARD, EVALUATION, HARDENING AND DEPLOYMENT

## Starting assumption

Parts 1-5 are implemented on the existing frontend/database architecture.

Part 6 finishes the capstone without changing frontend framework or rebuilding the database.

## 1. Implementation order

### A. Full audit / remove mocks
### B. What Matters Now
### C. Daily Briefing
### D. Finance Dashboard hardening
### E. Parser / retrieval / RAG evaluation
### F. Interaction + accessibility hardening
### G. Automated release testing
### H. Security/privacy review
### I. Performance/reliability optimization
### J. Deployment
### K. Documentation + demo readiness

## 2. Audit

Inspect:
- obsolete `Your Space` UI;
- stale Expenses-as-financial-truth logic;
- duplicate API clients;
- mock production data;
- hardcoded URLs;
- stale auth paths;
- ownership gaps;
- unsafe regex/unbounded search input;
- model-based intent routing;
- unvalidated RAG sources;
- finance totals using NoteItem amounts;
- location leaking into search/RAG;
- browser/runtime errors;
- accessibility gaps;
- committed secrets;
- combined search/RAG paths that block retrieval on Groq.

Do not broad-refactor for aesthetics.

## 3. What Matters Now

Use deterministic scoring.

Example exclusive urgency buckets:

```text
overdue               +100
due <= 1 hour          +80
due today              +60
due <= 3 days          +30
due <= 7 days          +10
pending                 +5
high importance        +40
```

Exclude completed/cancelled/archived items.

Profile boosts remain modest:

```text
STUDY_FIRST -> small Education boost
WORK_FIRST  -> small Work boost
BALANCED    -> no profile bias
```

A preference boost must never outrank overdue/immediate/high-importance facts.

Expose human-readable reasons; no opaque AI score.

## 4. Nearby Shopping context

Backend returns base priority facts.

Browser may apply a small local boost when existing Location Mode determines a nearby saved Place.

Requirements:
- no raw coordinates sent to priority endpoint;
- visible `Nearby saved place` reason;
- boost disappears when Location Mode is OFF;
- urgent deadlines remain dominant.

## 5. Daily Briefing

Backend determines facts first:
- today's Tasks;
- overdue Tasks;
- upcoming Events;
- highest-priority items;
- pending Shopping count;
- finance summary from authoritative Transactions.

Then send a bounded fact payload to Groq for concise prose.

Rules:
- supplied facts only;
- no outside knowledge;
- no invented actions/dates/amounts;
- urgent facts first;
- deterministic fallback if Groq fails;
- do not send all raw Notes.

## 6. Finance Dashboard

Use existing authoritative Transactions only.

Show, where supported:
- current balance;
- income/expenses for selected period;
- recent transactions;
- largest debits;
- domain/category spending;
- transaction count.

Rules:
- CREDIT - DEBIT;
- user-timezone periods;
- currencies separate;
- no silent FX;
- deterministic backend arithmetic;
- search/dashboard/briefing use the same finance service logic.

## 7. Parser evaluation

Build a labelled query set covering:
- BDT/Tk/currency aliases;
- USD/$;
- credit/debit wording;
- over/under;
- MAX/MIN/SUM/AVG/COUNT;
- types/domains/statuses;
- quoted phrases;
- dates/relative dates/timezone edges;
- ambiguity/spelling/Unicode;
- long/adversarial regex cases.

Measure:
- amount accuracy;
- currency accuracy;
- direction accuracy;
- operator accuracy;
- date-resolution accuracy;
- field precision/recall;
- false-hard-filter rate;
- type/domain/status extraction accuracy.

## 8. Retrieval benchmark

Where existing vector support is available, compare:

```text
vector-only
lexical-only
hybrid
```

Metrics:
- Recall@K;
- MRR;
- Precision@K;
- nDCG@K when graded;
- latency;
- no-result rate.

If vector support is absent, document it as deferred/blocked. Do not create new schema in Part 6.

## 9. Structured analytics evaluation

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

## 10. Strict RAG evaluation

Measure:
- source relevance;
- source-ID validity;
- citation/source coverage;
- unsupported-claim rate;
- abstention correctness;
- prompt-injection resistance;
- conflict handling;
- deterministic-answer bypass;
- cross-user leakage.

Release targets:

```text
cross-user source leakage = 0
invalid displayed source IDs = 0
known unsupported factual claims in labelled suite = 0
```

Withhold generated text on validation failure.

## 11. Search API audit

Verify:

```text
POST /api/v1/search/
POST /api/v1/search/answer/
```

`/search/` must remain useful without Groq.
`/search/answer/` must re-retrieve evidence server-side and validate sources.

## 12. UX hardening

Target:
- fast;
- calm;
- tactile;
- immediately usable.

Focus on:
- sidebar/navigation;
- search overlay;
- category cards/sheets;
- Transactions;
- task completion;
- forms;
- loading/error/empty states;
- reduced motion.

Avoid moving backgrounds, scroll-jacking, long loaders, particles, and decorative WebGL.

## 13. Accessibility

Verify keyboard and screen-reader behavior for:
- navigation;
- search/results;
- dialogs/sheets;
- source links;
- forms;
- onboarding;
- transactions;
- place/reminder controls.

Require visible focus, labels, dialog semantics, focus restore, status announcements, and non-color-only finance meaning.

## 14. Release tests

Frontend tests should cover current implemented features including auth/session, Notes, AI review, BYOK/trial where present, onboarding, Dashboard, Transactions, Search/RAG, Places/Reminders, location errors, What Matters, Briefing, reduced motion, and loading/error/empty states.

Backend tests should cover current auth mapping, ownership, Notes/NoteItems, finance, timezone boundaries, preferences, entitlement, parser, structured search, lexical/vector retrieval where available, RAG validation, Place/Reminder isolation, priority scoring, and briefing facts.

Mock Groq in routine tests.

## 15. Critical E2E journey

At minimum:
1. login/register according to current app;
2. onboarding;
3. Quick Capture;
4. AI review/confirm;
5. multi-item Note;
6. DEBIT/CREDIT confirmation;
7. finance summary update;
8. semantic/hybrid search where available;
9. grounded answer;
10. deterministic finance query equals dashboard value;
11. Place/reminder flow;
12. mocked nearby Shopping alert;
13. What Matters;
14. Daily Briefing;
15. Settings preference change;
16. logout.

## 16. Security/privacy review

Verify:
- backend secrets never reach frontend;
- search is owner-scoped;
- regex/input limits exist;
- no cross-user cache;
- raw vectors/internal artifacts are not exposed;
- Notes are untrusted RAG content;
- source validation/abstention works;
- finance details are not leaked in logs/admin;
- no client authoritative user IDs;
- Location Mode is optional/OFF by default;
- no movement history;
- live GPS stays browser-only.

## 17. Database optimization only

Do not create new tables/columns/extensions or run redesign migrations.

Allowed:
- inspect query counts and plans;
- tune `select_related`/`prefetch_related`;
- add measured indexes on existing fields;
- bound top-K/context sizes;
- cache model resources;
- reduce duplicate provider/database calls;
- verify existing delete/cascade behavior.

## 18. Performance

Frontend:
- bundle weight;
- heavy feature lazy loading;
- rerenders;
- large lists;
- font/media loading.

Backend:
- query counts/plans;
- finance aggregation latency;
- lexical/vector latency;
- context caps;
- embedding-model process reuse where already used;
- provider timeouts;
- duplicate calls.

Do not add Redis/Celery without measured need.

## 19. Deployment

Deploy the existing frontend and Django backend using the project's current hosting choice.

Production checks:
- environment variables present without logging secrets;
- database connectivity works;
- existing schema is current; do not create new schema from this plan;
- auth/CORS work;
- frontend production build passes;
- Notes CRUD works;
- finance summary works;
- search retrieval works;
- deterministic finance answer works;
- RAG abstention/provider failure is safe;
- Places/reminder active-session behavior works;
- mobile smoke passes.

Google OAuth, if enabled, remains configured through the project's existing Supabase/Auth setup.

## 20. Known limitations

State honestly where applicable:
- browser reminders are active-session behavior;
- no background GPS history;
- no native push while browser closed;
- no bank integration;
- no FX conversion;
- no accounting/tax system;
- embedding/search language limitations if measured;
- embedding model cold-start risk if applicable;
- Groq availability affects AI features, not raw Note saving;
- BYOK disappears according to current session-only design.

## 21. Acceptance

Release only when behavior, user isolation, search/RAG grounding, finance consistency, accessibility, performance, privacy, tests, deployment smoke, and documentation all pass without frontend framework migration or database/schema recreation.
