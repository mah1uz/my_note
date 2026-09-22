# PART 4.5 — PERSONALIZATION, TRANSACTIONS, DASHBOARD SUMMARY & FIRST-USER ONBOARDING

## Project
AI Context-Aware Note-Taking Web Application — My Notes

## Position in roadmap

Implement this plan **after Part 4** and **before Part 5**.

Part 4 should already provide:
- Next.js App Router + TypeScript frontend
- Django/DRF/PostgreSQL backend
- UUID AppUser ownership
- Notes + NoteItems
- Groq note analysis/review
- regex/query parsing
- hybrid Search Notes
- strict grounded Ask My Notes
- collapsible premium sidebar
- Universal Search

Part 4.5 adds the missing product foundation for:
- transaction / personal cash-flow tracking
- income + expense balance
- regex-first financial extraction
- user profession / priority preferences
- dashboard/category navigation cleanup
- manual Task/Event/Transaction entry
- Groq BYOK + limited trial access
- first-login onboarding tour

Part 5 should then add Places, reminders and location-aware behavior on top of this foundation.

---

# 1. PRODUCT PRINCIPLE

The application is primarily:

> a capture-first personal note system that automatically turns everyday notes into useful structured information.

A user may write unrelated notes throughout the day:

```text
8:00 AM
"I have a quiz tomorrow at 10am."

12:00 PM
"I need to buy eggs."

2:00 PM
"I have an interview call on 29 September."

5:00 PM
"I bought apples for 200 taka."

Month end
"I just got my salary 20k."
```

The system should preserve the raw Note first, then derive structured data.

Possible results:

```text
Quiz tomorrow at 10am
→ Event
→ Education

Buy eggs
→ Task
→ Shopping

Interview call on 29 September
→ Event
→ Work

Bought apples for ৳200
→ Expense-like NoteItem
→ confirmed DEBIT transaction
→ label: Apples

Got salary ৳20,000
→ Finance information
→ confirmed CREDIT transaction
→ label: Salary
```

The raw Note must remain intact even if structured extraction fails.

---

# 2. IMPORTANT FINANCE DESIGN DECISION

Do **not** treat income as an "expense" in the database.

The UI may still present a friendly Finance/Expenses area, but the financial ledger should use the neutral concept:

```text
TRANSACTION
```

with:

```text
DEBIT  = money leaving
CREDIT = money entering
```

Recommended user-facing category name:

```text
Transactions
```

Inside that view provide filters:

```text
All
Expenses
Income
```

This is clearer than putting salary inside an "Expense" category.

If the product must retain the word `Expenses`, use:

```text
Expenses & Balance
```

as the card label, but keep the internal ledger model as Transactions.

---

# 3. TRANSACTION MODEL

Add a dedicated transaction model rather than forcing every financial concept into `NoteItem.item_type`.

Conceptually:

```text
finance_transactions
────────────────────────────────────────────
id                  UUID PK
user_id             UUID FK -> app_users
note_item_id        UUID nullable FK -> note_items
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
CREDIT
DEBIT
```

## Source kind

```text
AI_NOTE
MANUAL
OPENING_BALANCE
```

## Rules

- `amount` is always stored as a positive number.
- Never encode debit by storing a negative amount.
- Direction determines the sign.
- `note_item_id` may be null for manual/opening-balance records.
- A Note-derived Transaction must belong to the same AppUser as its source NoteItem.
- Prefer one confirmed financial Transaction per NoteItem in V1.
- Only confirmed Transactions affect totals and balance.
- Use `NUMERIC`, never floating point.
- Do not sum different currencies together.

Suggested constraints:

```text
amount > 0
direction IN (CREDIT, DEBIT)
UNIQUE(note_item_id) WHERE note_item_id IS NOT NULL
```

If a Note/NoteItem-derived transaction is deleted according to product deletion policy, the linked transaction should follow the explicitly chosen cascade behavior.

For V1, prefer cascading a Note-derived transaction with its source item so deleting a user's source note also deletes its derived financial record.

Manual transactions remain directly owned by AppUser.

---

# 4. BALANCE AND CASH-FLOW RULES

This is a simple personal cash-flow ledger, not full accounting software.

For one currency:

```text
balance =
opening balance
+ confirmed CREDIT transactions
- confirmed DEBIT transactions
```

Do not ask Groq to calculate this.

Use PostgreSQL/Django aggregation.

Example:

```text
Opening balance   + ৳5,000
Salary            + ৳20,000
Apples            - ৳200
Transport         - ৳500

Current balance   = ৳24,300
```

## Running balance

Sort deterministically by:

```text
transaction_at
created_at
id
```

Then calculate running balance in that order.

## Multi-currency rule

If future users record multiple currencies:

```text
BDT balance
USD balance
EUR balance
```

must remain separate.

Do not silently convert currencies without an explicit FX feature.

V1 default may be the user's `default_currency`, e.g. BDT.

---

# 5. REGEX-FIRST NOTE PRE-PARSER

Every Note should first pass through a **deterministic pre-parser** before Groq analysis.

Create a service such as:

```text
notes/services/note_preparser.py
```

It should extract explicit, high-confidence hints.

It does **not** replace semantic understanding.

It provides deterministic facts and constraints that Groq is not allowed to contradict.

Conceptual output:

```json
{
  "task_hints": [],
  "event_hints": [],
  "shopping_hints": [],
  "finance_hints": {
    "direction": "DEBIT",
    "amount": "200.0000",
    "currency": "BDT",
    "label_hint": "apple"
  },
  "date_hints": [],
  "time_hints": [],
  "explicit_keywords": []
}
```

---

# 6. REGEX / KEYWORD RULES

## Task cues

Examples:

```text
need to
have to
must
remember to
buy
submit
finish
call
send
```

Do not automatically create a Task from a weak phrase if grammar is ambiguous.

Use strong matches as hints.

## Event cues

Examples:

```text
quiz
exam
meeting
interview
call at/on
class
appointment
presentation
event
```

Combine with detected date/time evidence.

## Shopping / grocery cues

Examples:

```text
buy
need
need to get
out of
don't have
grocery
groceries
eggs
milk
rice
bread
```

Shopping categorization may use semantic Groq analysis too.

Regex should provide useful explicit cues, not attempt to maintain an enormous product dictionary.

## Finance / debit cues

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

Possible phrases:

```text
I bought apples for 200 taka
Spent 500 tk on transport
Paid 1200 for internet
```

## Finance / credit cues

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

Possible phrases:

```text
I got my salary 20k
Received 5000 taka
Got paid 25,000 tk
```

## Ambiguous finance cues

Examples:

```text
500 taka from Rahim
transfer 2000
money 3000
```

Do not auto-decide CREDIT/DEBIT if direction is not clear.

Show a Transaction suggestion asking the user.

---

# 7. MONEY REGEX

Support common forms:

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
```

Normalize examples:

```text
20k -> 20000
1.5k -> 1500
2 lakh -> 200000
```

Keep parsing deterministic and unit tested.

Initial supported currency aliases:

```text
BDT:
৳
taka
tk
bdt

USD:
$
usd
dollar
dollars
```

Do not infer a non-default currency from an ambiguous symbol if locale makes that unsafe.

---

# 8. TRANSACTION LABEL EXTRACTION

The financial list should show concise objects/products/sources instead of the user's whole sentence.

Examples:

```text
"I bought apple at 200 taka."
→ label: Apple

"I paid 1200 taka for internet."
→ label: Internet

"I spent 500 on transport."
→ label: Transport

"I just got my salary 20k."
→ label: Salary
```

Rules:

1. raw Note remains unchanged;
2. use deterministic verb/amount boundaries where reliable;
3. strip filler words;
4. normalize capitalization;
5. never invent a product/source not present in the Note;
6. Groq may suggest a label only when grounded in the Note text;
7. final label remains editable by the user.

If extraction is uncertain:

```text
Transaction
৳200
[ Add a label ]
```

rather than inventing one.

---

# 9. GROQ + REGEX RELATIONSHIP

Use this order:

```text
Raw Note saved
    ↓
strict deterministic pre-parser
    ↓
Groq structured analysis
    ↓
server validation
    ↓
merge rules
    ↓
user review / suggestion cards
    ↓
confirmed NoteItems / Transactions
```

## Merge rule

Explicit deterministic facts win over Groq.

Example:

```text
Note:
"I bought apples for 200 taka"
```

Regex says:

```text
direction = DEBIT
amount = 200
currency = BDT
```

Groq must not change that to:

```text
amount = 250
direction = CREDIT
```

If Groq conflicts with explicit deterministic evidence:

```text
mark review required
show conflict to user
do not silently choose Groq
```

Groq is useful for:
- semantic categorization
- title normalization
- domain suggestions
- multi-intent splitting
- uncertain natural-language structure

Regex is authoritative for clearly expressed:
- amount
- currency
- obvious direction
- explicit dates/times
- strong keywords

---

# 10. TRANSACTION SUGGESTION BLOCKS

If a financial action is detected, render a structured suggestion below the raw Note / AI review.

## Complete transaction

Example:

```text
┌──────────────────────────────────┐
│ Suggested transaction            │
│                                  │
│ Apples                           │
│ Expense / Debit                  │
│ ৳200                             │
│ Today, 5:00 PM                   │
│                                  │
│ [ Edit ]       [ Save expense ]  │
└──────────────────────────────────┘
```

Only after confirmation should it affect the balance.

## Missing amount

Note:

```text
I bought apples.
```

Show:

```text
┌──────────────────────────────────┐
│ Complete this transaction        │
│                                  │
│ Apples                           │
│ Amount: [              ]         │
│ Currency: [ BDT ▼ ]              │
│                                  │
│ [ Skip ]      [ Save expense ]   │
└──────────────────────────────────┘
```

## Missing direction

Note:

```text
5000 taka from Rahim
```

Show:

```text
Was this money received or spent?

[ + Income ]   [ - Expense ]
```

Do not guess.

---

# 11. GROQ ACCESS — BYOK + LIMITED FREE TRIAL

The core notepad must **always save Notes**, even if AI access is unavailable.

Do not make raw note capture dependent on Groq uptime, quota, or user key.

AI organization can require one of:

```text
1. User-provided Groq API key
2. Limited free trial credits
```

## Priority

```text
valid user session key
      ↓
use BYOK

else trial credits available
      ↓
use server trial quota

else
      ↓
save Note normally
show:
"AI organization unavailable — add your Groq key or categorize manually."
```

The user's Groq key remains memory-only.

Do not store it in:
- PostgreSQL
- localStorage
- sessionStorage
- cookies
- URLs
- logs

---

# 12. FREE TRIAL ENTITLEMENT

Add a small entitlement table if a limited server-funded trial is required.

Conceptually:

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
- usage increments atomically;
- failed validation/provider requests should follow an explicitly documented charge policy;
- do not trust a frontend counter;
- do not expose server Groq key;
- rate-limit free trial analysis;
- trial applies to AI analysis, not raw Note capture.

`AIProcessingRun.credential_source` should distinguish:

```text
USER_SESSION
TRIAL
SERVER
NONE
```

Never record the actual key.

---

# 13. REGISTRATION / AUTH UI

Registration screen:

```text
Name
Email
Password
Confirm password

[ Create account ]

──────── OR ────────

[ Continue with Google ]
```

After successful signup / first Google login, show onboarding rather than a giant registration form.

---

# 14. PROFESSION / PERSONALIZATION

Onboarding should ask:

```text
What best describes you?

[ Student ]
[ Employed ]
[ Both ]
[ Other ]
[ Prefer not to say ]
```

Store this as a user preference.

Do not make Profession part of authentication identity.

Do not infer it from Notes.

Do not force the user to answer.

## Why it exists

Profession influences:
- default dashboard emphasis
- initial priority profile
- suggested onboarding examples
- Study vs Work weighting in the future priority engine

It must **not** override explicit note meaning.

Example:

A Student writes:

```text
Client meeting tomorrow
```

Do not force it into Education merely because the user is a Student.

---

# 15. PRIORITY SETTINGS

Extend Settings with:

```text
Priority profile

[ Balanced ]
[ Study first ]
[ Work first ]
[ Custom later ]
```

Suggested mapping:

```text
Student
→ default: Study first

Employed
→ default: Work first

Both / Other / Prefer not to say
→ default: Balanced
```

The user can change this at any time.

Do not silently change their profile later.

## Optional settings

Keep V1 simple:

```text
Include overdue tasks        ON
Include upcoming events      ON
Include shopping tasks       ON
Show finance attention       ON
```

Do not create dozens of sliders unless needed.

---

# 16. PRIORITY ENGINE CONTRACT

Part 4.5 stores preferences and establishes the contract.

The full What Matters Now scoring engine may remain in Part 6, but it must consume these preferences.

Conceptually:

```text
base deterministic urgency score
      +
priority-profile domain boost
      +
explicit user importance
      +
Part 5 nearby-shopping context when enabled
      ↓
ranked overview
```

Examples:

### Study first

Education Tasks/Events get a modest boost.

### Work first

Work Tasks/Events get a modest boost.

### Balanced

No profession/domain boost.

The boost must never overpower:
- overdue status
- very near deadlines
- explicit HIGH importance

Priority remains explainable.

Every result should expose reasons such as:

```text
Overdue
Due today
High importance
Study priority preference
Work priority preference
```

No opaque AI priority score.

---

# 17. USER PREFERENCES DATA

Extend the existing `user_preferences` model with fields such as:

```text
profession
priority_profile
onboarding_completed_at
onboarding_tour_version
```

Possible values:

```text
profession:
STUDENT
EMPLOYED
BOTH
OTHER
PREFER_NOT_TO_SAY

priority_profile:
BALANCED
STUDY_FIRST
WORK_FIRST
```

Use Django TextChoices / CharField + database check constraints.

Do not use PostgreSQL native ENUMs.

---

# 18. SIDEBAR INFORMATION ARCHITECTURE CHANGE

The Dashboard becomes an expandable navigation group.

The entire sidebar still retains the Part 4 ChatGPT/Claude-style collapse/expand behavior.

Expanded sidebar:

```text
Dashboard                       ▾
  Overview
  Tasks
  Events
  Shopping
  Transactions
  Study

Search
Places
Settings

-------------------------------
Logout
```

When the Dashboard group is collapsed:

```text
Dashboard                       ▸
Search
Places
Settings
Logout
```

When the entire sidebar is collapsed:
- show top-level icons only;
- Dashboard icon may open a compact popover containing its child destinations;
- tooltips identify all icons.

Do not have a separate top-level `Your Space` navigation item after this change.

---

# 19. DASHBOARD PAGE

Dashboard should contain:

```text
Overview / Today
Quick Capture
What Matters / upcoming overview
Your Categorized Summary
Finance snapshot
```

## Your Categorized Summary

This replaces the old standalone `Your Space` presentation while keeping the same high-quality card interaction.

Cards:

```text
Tasks
Events
Shopping
Transactions
Study
```

Each compact card shows:
- category icon
- count
- 3–5 recent/important rows
- date/status/amount where useful
- Add button
- View all

Clicking the card:
- expands into large modal/sheet;
- full list appears;
- X / Escape / safe backdrop closes;
- focus returns;
- mobile uses near-full-screen sheet.

---

# 20. MANUAL ADD ACTIONS

Each category card/modal must allow manual creation without Groq.

Examples:

```text
Tasks
[ + Add task ]

Events
[ + Add event ]

Shopping
[ + Add shopping item ]

Transactions
[ + Add transaction ]

Study
[ + Add study item ]
```

## Manual Task/Event/Shopping/Study

Use structured forms.

Do not send to Groq unless the user explicitly asks AI to help.

Preserve ownership and raw-source principles.

If current NoteItem requires a Note FK, create a user-visible/manual source Note from the user's actual entered title/description rather than a hidden invented Note.

Mark the source as manual in bounded metadata or a dedicated source field if implemented.

## Manual Transaction

Form:

```text
Type:
[ Expense / Debit ] [ Income / Credit ]

Label
Amount
Currency
Date/time
Optional category/domain
```

Manual transaction is confirmed immediately after valid submission.

No AI needed.

---

# 21. TRANSACTION / FINANCE UI

Inside `Transactions` card/modal:

Header:

```text
Current balance       ৳24,300
This month spent      ৳4,700
This month income     ৳20,000
```

Tabs:

```text
All
Expenses
Income
```

Transaction row:

```text
Apples
Shopping
22 Sep, 5:00 PM                     - ৳200
```

Credit:

```text
Salary
Finance
30 Sep                              + ৳20,000
```

Use:
- minus sign / debit styling for money out
- plus sign / credit styling for money in
- accessible text, not color alone

Do not use Groq for totals.

---

# 22. FINANCE SUMMARY TECHNIQUES

Provide useful but simple money management.

V1:

```text
Current balance
Total income this month
Total expense this month
Largest recent expenses
Recent transactions
Expenses by primary Domain/category
```

Optional simple period filters:

```text
This week
This month
Last month
Custom range
```

Do not add:
- tax accounting
- bank integration
- debt schedules
- investment portfolio
- financial forecasting
- budget recommendation AI

unless scope changes later.

---

# 23. SEARCH INTEGRATION

Part 4 Universal Search must understand Transactions.

Regex/query parser should support:

```text
where did I spend the most money?
how much did I spend this month?
show my salary entries
income last month
expenses over 1000 taka
what did I buy for university?
```

Execution:

```text
structured finance query
      ↓
finance_transactions
+ source NoteItem/Domain joins where necessary
      ↓
deterministic sorting/aggregation
```

Search Notes left panel should show the related source Note when one exists.

Manual Transactions without a source Note may show a Transaction result card.

Strict Ask My Notes should use deterministic finance answers whenever possible.

Groq must not calculate balance.

---

# 24. FIRST-LOGIN ONBOARDING TOUR

A brand-new AppUser should receive a short interactive tour.

Do not create a long blocking wizard.

Use 4–6 focused cards/spotlights.

Recommended sequence:

## 1. Quick Capture

Target the Note input.

Message:

```text
Write anything you need to remember.
Your raw note is always saved first.
```

Example:

```text
I have a quiz tomorrow at 10am.
```

## 2. AI organization

Target AI analyze/review.

Explain:

```text
Use your Groq key or the limited trial to organize a note into Tasks, Events, Shopping, Transactions and other categories.
```

## 3. Categorized Summary

Target Dashboard → Your Categorized Summary.

Explain:

```text
Your confirmed items appear here automatically.
You can also add items manually.
```

## 4. Universal Search

Target Search bar.

Explain:

```text
Search by meaning or ask a question about your saved notes.
```

## 5. Transactions

Target Transactions card.

Explain:

```text
Track money in and money out.
Confirmed credits and debits update your balance.
```

## 6. Settings

Target Settings.

Explain:

```text
Choose your priority profile, profession preference and AI access.
```

Part 5 may later append a new-feature tour for Places/Location Reminders.

---

# 25. ONBOARDING TOUR UX

Requirements:
- first login only by default;
- Skip available immediately;
- Next / Back;
- keyboard accessible;
- responsive;
- reduced-motion friendly;
- spotlight target must remain visible;
- never trap the user permanently;
- progress indicator;
- Replay tour from Settings;
- version tour with `onboarding_tour_version`.

If a target does not exist on the current viewport/route:
- navigate safely;
- wait for target;
- then continue.

Do not rely on brittle pixel coordinates.

Use element refs / data attributes such as:

```text
data-tour="quick-capture"
data-tour="universal-search"
data-tour="transactions"
```

---

# 26. FIRST-LOGIN FLOW

Suggested:

```text
Sign up / Continue with Google
        ↓
AppUser provisioned
        ↓
light onboarding preferences
  - profession
  - default currency/timezone if not already set
  - initial priority profile
        ↓
AI access choice
  - use limited trial
  - add Groq API key
  - skip for now
        ↓
interactive product tour
        ↓
Dashboard
```

Do not force a Groq key before a user can save their first Note.

---

# 27. SETTINGS PAGE ADDITIONS

Add sections:

## Profile
- display name
- Profession

## Priorities
- Balanced
- Study first
- Work first

## Finance
- default currency
- optional opening balance action

## AI access
- Groq key status for current session only
- Clear current key
- remaining trial analyses
- explanation that key is not saved

## Onboarding
- Replay product tour

## Notifications / Location
- placeholders only until Part 5 if not yet implemented

---

# 28. TRANSACTION CORRECTION

Users must be able to edit:
- label
- amount
- currency
- direction
- date/time
- category/domain where supported

Changing a confirmed transaction must update balance deterministically.

Do not let Groq overwrite an edited confirmed transaction automatically during later re-analysis.

If source Note is re-analyzed and the financial suggestion differs:
- keep the existing confirmed transaction;
- show a review/conflict notice;
- require explicit user action to replace/update it.

---

# 29. DUPLICATE PREVENTION

A Note must not create the same financial Transaction repeatedly.

Use:

```text
UNIQUE(note_item_id)
```

for Note-derived Transactions where possible.

Analyze/retry flow:
- no transaction exists -> create suggestion
- confirmed transaction exists -> do not duplicate
- analysis changed -> show update suggestion only
- rejected/skipped suggestion -> do not silently recreate during the same revision

Use Note revision / analysis revision to prevent stale suggestions.

---

# 30. SECURITY / PRIVACY

## Finance
- Transactions are private user data.
- Every transaction query must be AppUser scoped.
- Admin UI must not expose personal transaction contents or amounts.
- Do not put full finance history into operational logs.

## AI
- user Groq key remains non-persistent;
- trial server key backend only;
- rate-limit trial;
- sanitize provider errors;
- never log Authorization/API-key headers.

## Profession
- optional;
- user-editable;
- no sensitive inference;
- never use it to override explicit note facts.

## Onboarding
- do not embed secrets/user note content in analytics events.

---

# 31. BACKEND ENDPOINTS

Approximate additions:

```text
GET    /api/v1/transactions/
POST   /api/v1/transactions/
GET    /api/v1/transactions/:id/
PATCH  /api/v1/transactions/:id/
DELETE /api/v1/transactions/:id/

GET    /api/v1/finance/summary/

GET    /api/v1/preferences/
PATCH  /api/v1/preferences/

GET    /api/v1/ai/entitlement/
```

Existing Note analyze/review endpoint may return:

```text
transaction_suggestion
```

as part of review data.

Do not create a separate Groq call solely for the transaction card.

---

# 32. FRONTEND COMPONENTS

Suggested additions:

```text
components/
  dashboard/
    DashboardNavGroup.tsx
    CategorizedSummary.tsx
    CategorySummaryCard.tsx

  finance/
    TransactionCard.tsx
    TransactionList.tsx
    TransactionForm.tsx
    TransactionSuggestion.tsx
    BalanceSummary.tsx
    FinanceFilters.tsx

  onboarding/
    FirstRunOnboarding.tsx
    ProfessionStep.tsx
    AiAccessStep.tsx
    ProductTour.tsx
    TourCard.tsx
    TourSpotlight.tsx

  settings/
    ProfessionSettings.tsx
    PrioritySettings.tsx
    AiAccessSettings.tsx
```

Reuse the motion system from `fluid-interactive-website-prompt.md`.

---

# 33. MOTION / INTERACTION

## Dashboard accordion

When Dashboard nav is opened:

```text
chevron rotates
child rows fade/slide in
sidebar height/layout settles
```

Keep duration short.

## Categorized Summary cards

Hover:
- subtle lift
- accent
- small arrow movement

Open:
- card-to-modal/sheet expansion

## Transaction suggestion

When AI analysis completes:
- suggestion block slides/fades in;
- extracted amount/product fields highlight briefly;
- no flashy money animation.

## Balance

Only intentional headline balance may animate once on change.

Do not animate every ledger amount.

## Tour

Use:
- spotlight fade
- card slide
- target pulse once
- no endless blinking

Reduced-motion mode uses immediate state changes.

---

# 34. TESTING — REGEX / NOTE PRE-PARSER

Required cases:

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
- date/time cues
- task/event cues
- amount normalization
- currency normalization
- CREDIT/DEBIT direction
- ambiguous direction remains unresolved
- label extraction
- missing amount detection
- no invented values

Test Unicode, spacing, punctuation, uppercase/lowercase.

Test regex performance against long/malicious strings.

---

# 35. TESTING — TRANSACTIONS

Backend tests:
- user isolation
- positive amount constraint
- CREDIT adds to balance
- DEBIT subtracts
- different currencies not combined
- duplicate NoteItem transaction blocked
- deletion policy
- manual transaction
- opening balance
- edit recalculates summary
- invalid direction
- invalid currency
- zero/negative stored amount rejected
- Note-derived ownership match

Finance summary tests:
- current balance
- monthly income
- monthly expense
- largest expense
- primary-domain aggregation

---

# 36. TESTING — GROQ MERGE SAFETY

Mock provider outputs.

Case:

```text
Note says: bought apple 200 taka
Regex: DEBIT 200 BDT
Groq incorrectly returns CREDIT 250 BDT
```

Expected:

```text
review conflict
no silent override
```

Case:

```text
Groq invents price for "I bought apples."
```

Expected:

```text
price rejected
user prompted for amount
```

Case:

```text
Groq invents salary amount
```

Expected:

```text
no transaction saved
```

Explicit deterministic values must win.

---

# 37. TESTING — TRIAL / BYOK

Test:
- raw Note saves with no AI access;
- valid in-memory user key uses BYOK;
- no user key + trial available uses trial;
- exhausted trial does not call server-funded AI;
- exhausted trial still saves Note;
- manual categorization remains available;
- trial usage increments atomically;
- logout clears in-memory key;
- hard refresh clears key;
- no API key exists in persistence/logs.

---

# 38. TESTING — PRIORITY PREFERENCES

Test:
- Student defaults to Study first;
- Employed defaults to Work first;
- Both defaults Balanced;
- user can override;
- preference persists;
- profession does not force wrong Note category;
- Part 6 scoring contract accepts preference;
- overdue/high-importance still outranks modest profile boost.

---

# 39. TESTING — DASHBOARD / MANUAL ADD

Frontend:
- Dashboard accordion open/close;
- child category navigation;
- full sidebar collapse still works;
- categorized cards render;
- Add Task/Event/Shopping/Transaction/Study;
- category modal opens/closes;
- manual Transaction updates balance;
- raw/manual source behavior correct;
- responsive layout;
- keyboard/focus behavior;
- reduced motion.

---

# 40. TESTING — ONBOARDING

Test:
- new user receives onboarding;
- existing completed user does not;
- Skip works;
- Back/Next works;
- target spotlight follows correct element;
- missing target handled safely;
- keyboard navigation;
- focus management;
- mobile;
- reduced motion;
- Replay Tour from Settings;
- incremented tour version can offer updated tour without corrupting old state.

---

# 41. PLAYWRIGHT E2E

Minimum end-to-end flow:

1. register or mock authenticated new user;
2. select Student;
3. select Study-first priority;
4. choose trial AI access;
5. complete/skip tour;
6. Quick Capture:
   `I have a quiz tomorrow at 10am.`
7. analyze + confirm Event;
8. Quick Capture:
   `I need to buy eggs.`
9. confirm Shopping Task;
10. Quick Capture:
    `I bought apple at 200 taka.`
11. confirm DEBIT transaction;
12. Quick Capture:
    `I just got my salary 20k.`
13. confirm CREDIT transaction;
14. open Dashboard → Transactions;
15. verify balance = income - expense;
16. manually add a Transaction;
17. verify balance updates;
18. open Search and query largest expense;
19. verify deterministic result;
20. open Settings and change priority profile;
21. verify persisted preference;
22. logout.

No console/hydration errors.

---

# 42. ACCEPTANCE CRITERIA

Part 4.5 is complete only when:

1. raw Notes save even without Groq access.
2. BYOK remains session-only.
3. limited trial quota works server-side.
4. no intent-classifier model is introduced.
5. strict regex pre-parser extracts explicit facts.
6. Groq cannot override explicit amount/currency/direction/date facts silently.
7. financial suggestions require confirmation before affecting balance.
8. incomplete transactions prompt for missing information.
9. a dedicated Transaction ledger exists.
10. CREDIT and DEBIT are stored separately from amount sign.
11. balance is computed deterministically.
12. multi-currency values are not incorrectly summed.
13. duplicate Note-derived transactions are blocked.
14. transaction labels contain concise product/source text rather than full raw Notes.
15. profession preference exists and is optional.
16. priority profile exists in Settings.
17. profession only sets default priority behavior; it does not override explicit categorization.
18. Dashboard is an expandable sidebar group.
19. category destinations live under Dashboard.
20. Dashboard contains `Your Categorized Summary`.
21. summary contains Tasks, Events, Shopping, Transactions and Study.
22. manual add exists for key categories.
23. first-login onboarding exists.
24. tour can be skipped and replayed.
25. onboarding version is stored.
26. finance/user data remains user isolated.
27. admin surfaces do not expose personal finance content.
28. regex, finance, trial, preference, onboarding and E2E tests pass.
29. Part 5 location behavior has not been implemented early.
30. Part 6 What Matters Now later consumes the preference contract defined here.

---

# 43. DELIVERABLE BEFORE IMPLEMENTATION

Before modifying code, provide:

1. current Part 4 architecture summary;
2. implemented database gap analysis for Transactions / preferences / AI entitlement;
3. exact migrations;
4. transaction model + constraints;
5. finance deletion/cascade policy;
6. regex/pre-parser rule table;
7. deterministic-vs-Groq merge rules;
8. transaction suggestion state machine;
9. free-trial quota design;
10. BYOK fallback flow;
11. Dashboard/sidebar revised information architecture;
12. Categorized Summary UX;
13. manual-add flows;
14. profession / priority-preference design;
15. Part 6 priority-engine contract;
16. onboarding flow + tour targets;
17. API additions;
18. frontend files/components;
19. backend files/services;
20. full testing matrix;
21. migration/security risks.

Then wait for:

`IMPLEMENT PART 4.5 — STEP A`
