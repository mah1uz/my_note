# PART 3.5 — TRANSACTIONS, PERSONALIZATION, AI ENTITLEMENT & ONBOARDING

## Project
AI Context-Aware Note-Taking Web Application — My Notes

## Position in roadmap

Implement this plan **after Part 3.4** and **before Part 4**.

Expected Part 3.4 foundation:
- Django + DRF
- PostgreSQL / Supabase PostgreSQL
- stable UUID `AppUser`
- `UserAuthIdentity(issuer, subject)`
- Supabase Auth cutover
- React/Vite frontend still active
- Notes + NoteItems + Domains
- Groq note analysis/review
- session-only BYOK
- strict user isolation
- privacy-safe Django admin

Part 3.5 intentionally runs **before the Next.js migration**.

Do not assume:
- Next.js
- TypeScript
- TanStack Query
- pgvector
- Universal Search
- RAG
- Places/reminders
- What Matters Now implementation

Part 4 will migrate this working functionality to Next.js and add search/RAG.

---

# 1. Product principle

The product remains:

> capture first; structure second; user confirmation before authoritative derived actions.

Examples:

```text
"I have a quiz tomorrow at 10am."
  -> Event / Education

"I need to buy eggs."
  -> Task / Shopping

"I bought apples for 200 taka."
  -> source NoteItem
  -> suggested DEBIT transaction
  -> user confirms
  -> ledger entry

"I just got my salary 20k."
  -> source/context item
  -> suggested CREDIT transaction
  -> user confirms
  -> ledger entry
```

Raw Note text remains the source record and is never overwritten by AI.

---

# 2. Finance architecture — authoritative decision

Do not model income as an Expense.

Create a dedicated financial ledger:

```text
Transaction
  direction = CREDIT | DEBIT
  amount = positive NUMERIC
```

User-facing destination:

```text
Transactions
  All
  Expenses
  Income
```

Existing `NoteItem.item_type = EXPENSE` may remain for compatibility with
Part 3 extraction, but after this migration it is **not** the authoritative
financial source.

Use `finance_transactions` for:
- balance
- monthly income
- monthly spending
- largest expense
- transaction history
- finance summaries
- Part 4 structured finance search
- Part 6 finance dashboard

`NoteItem.amount/currency` remains extraction/source context only.

---

# 3. Transaction model

Target conceptual schema:

```text
finance_transactions
────────────────────────────────────────
id                  UUID PK
user_id             UUID FK -> app_users
note_item_id        UUID NULL FK -> note_items
primary_domain_id   UUID NULL FK -> domains
direction           VARCHAR(8)
amount              NUMERIC(18,4)
currency            CHAR(3)
label               VARCHAR(255)
transaction_at      TIMESTAMPTZ
source_kind         VARCHAR(24)
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

## Direction

```text
CREDIT = money entering
DEBIT  = money leaving
```

## Source kind

```text
AI_NOTE
MANUAL
OPENING_BALANCE
```

## Ledger invariant

A row in `finance_transactions` is already confirmed.

Do not use the ledger table as a draft/suggestion table.

Suggestions belong in:
- current analysis/review state
- validated provider artifact
- transient frontend review state

Only user confirmation creates a Note-derived Transaction.

## Constraints

- UUID PK
- owner is always `AppUser`
- `amount > 0`
- `direction IN (CREDIT, DEBIT)`
- `currency` normalized uppercase
- one Note-derived Transaction per NoteItem in V1
- unique `note_item_id` when non-null
- Note-derived Transaction owner must equal source NoteItem owner
- deleting a source NoteItem cascades its Note-derived Transaction
- deleting AppUser cascades all their Transactions
- Domain deletion remains restricted/retired according to global Domain policy

## Reporting domain

`primary_domain_id` is the transaction's reporting category.

For Note-derived Transactions:
- default it from the confirmed NoteItem's primary Domain when available
- user may edit it
- once confirmed, finance reports use the Transaction's field

This prevents finance reports from changing unexpectedly when source metadata is
later reorganized.

---

# 4. Opening balance

Allow one opening-balance record per user per currency in V1.

Conceptual uniqueness:

```text
UNIQUE(user_id, currency)
WHERE source_kind = 'OPENING_BALANCE'
```

Positive opening position:

```text
CREDIT
```

Negative starting position/debt:

```text
DEBIT
```

Do not add a separate mutable `current_balance` column.

Balance is always derived from ledger rows.

---

# 5. Balance and cash-flow rules

For each currency independently:

```text
balance =
SUM(CREDIT)
-
SUM(DEBIT)
```

Opening balance is simply included by `source_kind`.

Do not ask Groq to calculate financial totals.

Use PostgreSQL/Django aggregation.

## Deterministic ordering

For running balance:

```text
transaction_at
created_at
id
```

## Multi-currency

Never sum unlike currencies.

Return separate summaries:

```text
BDT
USD
EUR
```

V1 defaults to `AppUser.default_currency`.

---

# 6. Timezone rule for finance

Period boundaries must use `AppUser.timezone`.

Example:

```text
"This month"
```

means the user's local calendar month, not an arbitrary UTC month.

Resolve the local boundary, convert to timezone-aware query values, then query
PostgreSQL.

Unit test month/day boundary behavior.

---

# 7. Deterministic Note pre-parser

Create a modular pre-parser before Groq.

Suggested structure:

```text
notes/services/preparser/
  __init__.py
  parser.py
  money.py
  dates.py
  task_cues.py
  event_cues.py
  finance_cues.py
  labels.py
```

Do not create one enormous regex file.

Conceptual result:

```json
{
  "task_hints": [],
  "event_hints": [],
  "shopping_hints": [],
  "finance_hints": {
    "direction": "DEBIT",
    "amount": "200.0000",
    "currency": "BDT",
    "label_hint": "Apples"
  },
  "date_hints": [],
  "time_hints": [],
  "explicit_keywords": []
}
```

It provides deterministic evidence; it does not replace semantic understanding.

---

# 8. Deterministic cue rules

## Strong Task cues

Examples:

```text
need to
have to
must
remember to
buy
submit
finish
send
```

Use as hints, not unconditional truth when grammar is ambiguous.

## Event cues

Examples:

```text
quiz
exam
meeting
interview
class
appointment
presentation
```

Combine with detected time/date evidence where useful.

## Shopping cues

Examples:

```text
buy
need to get
out of
grocery
groceries
```

Do not maintain an enormous product dictionary.

## Finance DEBIT cues

Examples:

```text
bought
purchased
spent
paid
cost
charged
bill
fee
rent
fare
```

## Finance CREDIT cues

Examples:

```text
salary
got paid
received
credited
earned
income
refund
cashback
bonus
allowance
```

## Ambiguous finance

Example:

```text
5000 taka from Rahim
```

Do not guess the direction.

Show a review choice:

```text
Received / Income
Spent / Expense
```

---

# 9. Money parsing

Support deterministic forms such as:

```text
৳200
200 taka
200 tk
BDT 200
20k
20 k
20 thousand
1.5k
2 lakh
2 lac

$20
USD 20
20 dollars
```

Examples:

```text
20k -> 20000
1.5k -> 1500
2 lakh -> 200000
```

Initial aliases:

```text
BDT: ৳, taka, tk, bdt
USD: $, usd, dollar, dollars
```

Do not infer a non-default currency from an ambiguous symbol when locale makes
that unsafe.

Use `Decimal`, never float.

Bound input lengths and test regex complexity.

---

# 10. Transaction label extraction

Goal: concise, grounded labels.

Examples:

```text
"I bought apple at 200 taka."
  -> Apple

"I paid 1200 taka for internet."
  -> Internet

"I spent 500 on transport."
  -> Transport

"I just got my salary 20k."
  -> Salary
```

Rules:
1. raw Note remains unchanged;
2. use deterministic boundaries where reliable;
3. strip filler words;
4. normalize capitalization;
5. never invent a source/product absent from the Note;
6. Groq may suggest a grounded label;
7. user may edit;
8. uncertain label becomes `Transaction` + editable field.

---

# 11. Deterministic evidence vs Groq

Pipeline:

```text
Raw Note saved
    ↓
deterministic pre-parser
    ↓
Groq structured analysis
    ↓
server schema validation
    ↓
deterministic/Groq merge
    ↓
user review
    ↓
confirmed NoteItems / Transaction
```

Explicit deterministic facts win.

Example:

```text
Note: "I bought apples for 200 taka"

pre-parser:
  DEBIT
  200
  BDT

Groq:
  CREDIT
  250
  BDT
```

Expected:

```text
review conflict
no silent override
```

Groq may help with:
- semantic categorization
- title normalization
- domain suggestions
- multi-intent splitting
- ambiguous structure

Groq may not silently override explicit:
- amount
- currency
- obvious direction
- explicit date/time

---

# 12. Transaction suggestion state machine

A suggestion is not a ledger row.

Conceptual states:

```text
NONE
  ↓ detection
SUGGESTED
  ├─ user edits -> SUGGESTED
  ├─ user skips/rejects -> REJECTED for current Note revision
  └─ user confirms -> Transaction created
```

If a confirmed Transaction already exists for the NoteItem:
- re-analysis must not duplicate it;
- changed AI output may produce a review notice only;
- user must explicitly update/replace the existing Transaction.

Use Note revision / analysis revision to avoid stale suggestions.

---

# 13. Complete/incomplete suggestion UX

Complete:

```text
Suggested transaction

Apples
Expense / Debit
৳200
Today, 5:00 PM

[ Edit ] [ Save expense ]
```

Missing amount:

```text
Complete this transaction

Apples
Amount:   [          ]
Currency: [ BDT ]

[ Skip ] [ Save expense ]
```

Missing direction:

```text
Was this money received or spent?

[ + Income ] [ - Expense ]
```

Never invent missing values merely to complete the card.

---

# 14. Manual creation without Groq

The user must be able to create:
- Task
- Event
- Shopping item
- Transaction
- Study item

without AI.

If current `NoteItem` requires a Note FK, create a visible/manual source Note
from the user's actual entered content. Do not invent a hidden fake Note.

## Manual Transaction

```text
Type: Expense / Income
Label
Amount
Currency
Date/time
Primary Domain (optional)
```

A valid manual transaction is immediately authoritative.

No AI call is needed.

---

# 15. AI access — BYOK + limited trial

Raw Note saving never depends on Groq.

Priority:

```text
valid session-only user key
  -> USER_SESSION

else remaining trial
  -> TRIAL

else
  -> save Note
  -> AI unavailable
  -> manual organization remains available
```

BYOK stays memory-only.

Never persist it in:
- PostgreSQL
- localStorage
- sessionStorage
- cookies
- URLs
- logs

Hard refresh/logout clears it.

---

# 16. AI entitlement model

Add:

```text
user_ai_entitlements
────────────────────────────────
id                    UUID PK
user_id               UUID UNIQUE FK
trial_limit           INTEGER
trial_used            INTEGER
trial_started_at      TIMESTAMPTZ
trial_expires_at      TIMESTAMPTZ NULL
created_at            TIMESTAMPTZ
updated_at            TIMESTAMPTZ
```

Rules:
- one row per user
- usage increments atomically
- enforce a backend rate limit
- frontend counter is display-only
- trial applies to AI analysis, not Note saving
- define charge policy for provider/validation failure
- no server key exposure

Recommended V1 charge policy:
- increment only after a provider request was actually accepted/sent;
- do not charge for local validation rejection before provider call;
- document provider-timeout behavior explicitly.

`AIProcessingRun.credential_source`:

```text
USER_SESSION
TRIAL
SERVER
NONE
```

Never store key material.

---

# 17. User preferences

Extend `user_preferences` with:

```text
profession
priority_profile
onboarding_completed_at
onboarding_tour_version
```

## Profession

```text
STUDENT
EMPLOYED
BOTH
OTHER
PREFER_NOT_TO_SAY
```

Optional and user-editable.

Do not infer it from Notes.

## Priority profile

```text
BALANCED
STUDY_FIRST
WORK_FIRST
```

Suggested default from onboarding:

```text
Student  -> Study first
Employed -> Work first
Both/Other/Prefer not -> Balanced
```

The user may override immediately.

Profession does not override explicit note meaning.

Use Django `TextChoices` / `CharField` + database check constraints.

---

# 18. Part 6 priority-engine contract

Part 3.5 only stores preferences and defines the contract.

Part 6 scoring:

```text
base deterministic urgency
+ modest profile boost
+ explicit importance
+ optional client-side nearby-shopping context
```

Profile boost must never overpower:
- overdue
- immediate deadline
- explicit HIGH importance

Every result exposes reasons.

No opaque AI priority score.

---

# 19. Final information architecture established here

Part 3.5 establishes the final navigation semantics.

Current React/Vite may implement a simple version now; Part 4 migrates/polishes it.

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

There is no permanent top-level `Your Space`.

Before Part 4, Search and Places may remain placeholders/incomplete according to
their roadmap stage, but the navigation naming should not regress later.

---

# 20. Dashboard / Categorized Summary

Dashboard should contain, as available at this stage:

```text
Quick Capture
Categorized Summary
Finance snapshot
```

Part 6 later adds final What Matters Now / Daily Briefing.

Categorized Summary:

```text
Tasks
Events
Shopping
Transactions
Study
```

Each category:
- count
- 3–5 recent/important rows
- Add action
- View all

Use existing React/Vite patterns now.
Part 4 may replace them with premium modal/sheet interactions during migration.

---

# 21. Transactions UI

Transactions screen/card:

```text
Current balance
This month spent
This month income
```

Tabs:

```text
All
Expenses
Income
```

Row:

```text
Apples
Shopping
22 Sep, 5:00 PM              - ৳200
```

Credit:

```text
Salary
Finance
30 Sep                       + ৳20,000
```

Use accessible labels, not color alone.

Summary arithmetic is backend deterministic.

---

# 22. Finance endpoints

Approximate:

```text
GET    /api/v1/transactions/
POST   /api/v1/transactions/
GET    /api/v1/transactions/:id/
PATCH  /api/v1/transactions/:id/
DELETE /api/v1/transactions/:id/

GET    /api/v1/finance/summary/
```

Filtering may support:

```text
direction
currency
date_from
date_to
primary_domain
```

All querysets are current-AppUser scoped before serialization.

---

# 23. Preferences / entitlement endpoints

Approximate:

```text
GET   /api/v1/preferences/
PATCH /api/v1/preferences/

GET   /api/v1/ai/entitlement/
```

Onboarding may use the preferences endpoint rather than inventing a separate
profile system.

---

# 24. Part 4 search contract — define now, implement later

Part 4 must query `finance_transactions` for financial truth.

Examples:

```text
where did I spend the most money?
how much did I spend this month?
show my salary entries
income last month
expenses over 1000 taka
```

Part 3.5 does not implement Universal Search.

It only ensures the finance schema is ready.

For Note-derived transactions, Part 4 may join:
- transaction
- source NoteItem
- source Note
- Domain

Manual transactions may appear as Transaction search results without a source Note.

---

# 25. Registration and first-user onboarding

Authentication itself belongs to Part 3.4.

After first successful AppUser provisioning, Part 3.5 adds lightweight onboarding.

Flow:

```text
sign in
  ↓
new AppUser?
  ↓
preferences
  - profession optional
  - default currency/timezone confirmation
  - initial priority profile
  ↓
AI access choice
  - trial
  - session BYOK
  - skip
  ↓
short product tour
  ↓
Dashboard
```

Never require a Groq key before Note capture.

---

# 26. Product tour

Keep it short: 4–6 steps.

Suggested targets:

1. Quick Capture
2. AI analyze/review
3. Categorized Summary
4. Transactions
5. Settings
6. Search placeholder explanation (optional; Part 4 feature)

If Search is not implemented yet, do not spotlight a fake interactive feature.
The tour version can be incremented in Part 4 to introduce Universal Search.

Requirements:
- Skip immediately
- Next / Back
- keyboard accessible
- responsive
- reduced-motion friendly
- replay from Settings
- versioned
- data-attribute/ref targets
- safe handling for missing target

Do not use brittle pixel coordinates.

---

# 27. Frontend implementation context

Part 3.5 still uses the current React/Vite frontend.

Use existing:
- React
- Vite
- JavaScript
- current API/auth patterns

Do not migrate to:
- Next.js
- TypeScript
- TanStack Query

inside Part 3.5.

Part 4 owns that migration.

Build business behavior so it can be migrated cleanly:
- API modules
- feature-local components
- minimal duplicated state
- explicit loading/error/empty states

---

# 28. Suggested frontend additions (React/Vite)

Names should match the current repository style, but conceptually:

```text
src/
  api/
    transactionsApi.js
    preferencesApi.js
    aiEntitlementApi.js

  components/
    finance/
      TransactionList.jsx
      TransactionForm.jsx
      TransactionSuggestion.jsx
      BalanceSummary.jsx

    onboarding/
      FirstRunOnboarding.jsx
      ProfessionStep.jsx
      AiAccessStep.jsx
      ProductTour.jsx

    dashboard/
      CategorizedSummary.jsx
      CategorySummaryCard.jsx
```

Do not build the Part 4 Next.js folder tree yet.

---

# 29. Correction/edit policy

Users can edit:
- label
- amount
- currency
- direction
- transaction_at
- primary Domain

Balance changes deterministically.

Re-analysis never silently overwrites a confirmed Transaction.

If source analysis changes:

```text
existing confirmed transaction stays
new analysis may show conflict/update suggestion
user explicitly decides
```

---

# 30. Duplicate prevention

Note-derived:

```text
UNIQUE(note_item_id) WHERE note_item_id IS NOT NULL
```

Flow:
- none exists -> suggestion may be confirmed
- exists -> do not duplicate
- same revision rejected -> do not silently recreate
- changed revision -> may show explicit update review

Use revision-aware tests.

---

# 31. Security / privacy

Transactions are highly sensitive user data.

Mandatory:
- every transaction query owner-scoped
- no transaction detail/amounts in normal admin UI
- no finance history in operational logs
- no API keys in logs
- profession optional
- no sensitive inference
- trial counter backend-authoritative
- no client-supplied authoritative `user_id`

Admin may see safe counts, not transaction contents.

---

# 32. Required indexes

At minimum:

```text
finance_transactions(user_id, transaction_at DESC)
finance_transactions(user_id, direction, transaction_at DESC)
finance_transactions(user_id, currency, transaction_at DESC)
finance_transactions(user_id, primary_domain_id, transaction_at DESC)
finance_transactions(note_item_id) unique when non-null
user_ai_entitlements(user_id) unique
```

Measure before adding more.

---

# 33. Backend testing — finance

Test:
- user isolation
- amount > 0
- invalid direction
- currency normalization
- CREDIT increases balance
- DEBIT decreases balance
- different currencies stay separate
- one opening balance/user/currency
- duplicate NoteItem transaction blocked
- source delete cascades Note-derived transaction
- manual transaction survives without NoteItem
- edit recalculates summary
- timezone month boundaries
- primary-domain aggregation
- no NoteItem amount used as finance authority

---

# 34. Backend testing — parser/merge

Cases:

```text
I have a quiz tomorrow at 10am.
I need to buy eggs.
I have an interview call on 29 September.
I bought apple at 200 taka.
I paid 1200 tk for internet.
I spent $20 on lunch.
I just got my salary 20k.
I received 2 lakh taka.
5000 taka from Rahim.
I bought apples.
```

Verify:
- amount
- Decimal normalization
- currency
- direction
- ambiguous direction unresolved
- date/time cue
- label extraction
- missing amount
- Unicode/case/punctuation
- long/malicious input safety

Conflict fixture:

```text
pre-parser: DEBIT 200 BDT
Groq: CREDIT 250 BDT
```

Expected:
- conflict
- no ledger row before confirmation
- no silent Groq override

---

# 35. Trial/BYOK tests

Test:
- Note saves with no AI access
- session key wins over trial
- trial used when no key
- exhausted trial prevents server-funded call
- exhausted trial still saves Note
- usage increments atomically
- refresh/logout clears BYOK
- no key persisted
- server key never exposed
- provider failure follows documented charge policy

---

# 36. Preferences/onboarding tests

Test:
- profession optional
- default profile mapping
- override persists
- profession never forces wrong Domain
- new user sees onboarding
- existing completed user does not
- skip
- replay
- tour version
- missing target handling
- keyboard
- mobile
- reduced motion

---

# 37. Frontend regression gate

Before declaring Part 3.5 complete, verify all existing Parts 1–3/3.4 behavior:
- Supabase login/session
- protected routes
- Notes CRUD
- AI analyze/review/confirm
- BYOK
- Tasks
- Events
- existing Shopping behavior
- logout
- admin separation
- user isolation

No pgvector/search/RAG code yet.

---

# 38. Playwright flow

Minimum:

1. login/new user
2. complete/skip onboarding
3. capture quiz note
4. analyze/confirm Event
5. capture buy-eggs note
6. confirm Shopping Task
7. capture `I bought apple at 200 taka`
8. confirm DEBIT Transaction
9. capture `I just got my salary 20k`
10. confirm CREDIT Transaction
11. open Dashboard -> Transactions
12. verify BDT balance
13. manually add Transaction
14. verify balance updates
15. change priority profile
16. logout

No Part 4 Search assertion yet.

---

# 39. Acceptance criteria

Part 3.5 is complete only when:

1. raw Notes save regardless of AI availability.
2. Transaction is the authoritative ledger.
3. unconfirmed suggestions are not ledger rows.
4. CREDIT/DEBIT use positive Decimal amounts.
5. balance is deterministic.
6. currencies are kept separate.
7. opening balance has explicit V1 policy.
8. timezone-aware period summaries are correct.
9. duplicate Note-derived Transactions are blocked.
10. primary Domain exists for finance reporting.
11. NoteItem expense fields are no longer finance source of truth.
12. deterministic pre-parser is modular and tested.
13. Groq cannot silently override explicit facts.
14. BYOK remains memory-only.
15. limited trial is backend-authoritative.
16. profession is optional.
17. priority profile persists.
18. onboarding works and is replayable.
19. final Dashboard/Transactions terminology is established.
20. no permanent top-level Your Space remains in the target IA.
21. manual creation works without Groq.
22. admin does not expose finance contents.
23. user isolation tests pass.
24. existing Parts 1–3.4 regressions pass.
25. Next.js has not been introduced yet.
26. pgvector/FTS/RAG have not been introduced yet.
27. Places/reminders have not been implemented early.
28. Part 4 can migrate this behavior without changing domain rules.

---

# 40. Deliverable before implementation

Before changing code, provide:

1. current Part 3.4 architecture summary
2. current DB/model audit
3. exact migrations
4. Transaction model + constraints/indexes
5. NoteItem-vs-Transaction authority rule
6. opening-balance policy
7. timezone summary policy
8. modular pre-parser design
9. deterministic-vs-Groq merge table
10. suggestion state machine
11. trial quota design
12. BYOK fallback flow
13. UserPreference migration
14. final navigation/route changes in React/Vite
15. onboarding flow
16. backend endpoints
17. frontend files
18. complete test matrix
19. migration/security risks
20. explicit list of Part 4 contracts only, not implementations

Then wait for:

`IMPLEMENT PART 3.5 — STEP A`
