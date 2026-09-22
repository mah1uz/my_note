# PART 3.5 - TRANSACTIONS, PARSING, PERSONALIZATION AND ONBOARDING

## Starting assumption

Part 3 already contains the required database/auth/schema foundation. Use the existing models and fields exactly as implemented.

Do not create:
- new finance tables;
- new entitlement tables;
- new preference columns;
- new ownership models;
- schema migrations from this plan.

If required persistence is missing, report the mismatch.

## 1. Product principle

```text
capture first
-> structure second
-> validate
-> user confirmation before authoritative derived actions
```

Raw Note text is never silently overwritten by AI.

## 2. Finance authority

Use the existing authoritative Transaction implementation.

Rules:
- CREDIT = money entering;
- DEBIT = money leaving;
- amount is positive Decimal;
- only confirmed Transactions affect finance totals;
- NoteItem amount/currency remain extraction/source context;
- AI suggestions are not financial truth until confirmed;
- re-analysis never silently overwrites a confirmed Transaction.

User-facing finance destination:

```text
Transactions
  All
  Expenses
  Income
```

## 3. Finance calculations

For each currency independently:

```text
balance = SUM(CREDIT) - SUM(DEBIT)
```

Use deterministic backend aggregation.

Never:
- use Groq for arithmetic;
- use float for money;
- silently sum unlike currencies.

Period boundaries use the current user's timezone.

## 4. Deterministic Note pre-parser

Keep parsing modular:

```text
preparser/
  parser
  money
  dates
  task_cues
  event_cues
  finance_cues
  labels
```

Output deterministic evidence such as:
- task hints;
- event hints;
- shopping hints;
- amount/currency;
- clear debit/credit cues;
- explicit date/time;
- label hints.

Use hints conservatively when wording is ambiguous.

## 5. Money parsing

Support, where covered by tests:

```text
200 taka
200 tk
BDT 200
20k
20 thousand
1.5k
2 lakh / 2 lac
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

Use Decimal and bounded/regex-safe parsing.

Do not infer an unsafe currency from ambiguous symbols.

## 6. Finance cues

Common DEBIT hints:

```text
bought, purchased, spent, paid, cost, charged, bill, fee, rent, fare
```

Common CREDIT hints:

```text
salary, got paid, received, credited, earned, income, refund, cashback, bonus, allowance
```

Ambiguous example:

```text
5000 taka from Rahim
```

Do not guess direction. Require review.

## 7. Transaction label extraction

Labels must be grounded in the Note.

Examples:

```text
I bought apple at 200 taka -> Apple
I paid 1200 taka for internet -> Internet
I spent 500 on transport -> Transport
I got my salary 20k -> Salary
```

If uncertain, use a neutral editable label rather than inventing one.

## 8. Deterministic evidence vs Groq

Pipeline:

```text
Raw Note saved
-> deterministic pre-parser
-> Groq structured analysis
-> schema validation
-> merge
-> user review
-> confirmed state
```

Groq may help with:
- semantic categorization;
- title normalization;
- domain suggestions;
- multi-intent splitting;
- ambiguous structure.

Groq must not silently override explicit:
- amount;
- currency;
- obvious direction;
- explicit date/time.

Conflict example:

```text
pre-parser: DEBIT 200 BDT
Groq:       CREDIT 250 BDT
```

Expected: visible conflict/review, no silent ledger change.

## 9. Suggestion state

Conceptually:

```text
NONE
 -> SUGGESTED
 -> user edits: SUGGESTED
 -> user rejects/skips: rejected for current revision
 -> user confirms: authoritative Transaction
```

If a confirmed source-linked Transaction already exists:
- do not duplicate it;
- changed AI output becomes an explicit update suggestion only.

## 10. Manual operation

Users must be able to create and manage supported Tasks, Events, Shopping items, Transactions, and Study items without Groq.

A valid manual Transaction becomes authoritative through the existing persistence path.

## 11. AI access

Use the existing BYOK/trial implementation if present.

Priority:

```text
session user key
-> remaining trial/server entitlement
-> AI unavailable but raw Note still saves
```

BYOK must not be persisted in database, localStorage, sessionStorage, cookies, URLs, or logs.

Trial usage must remain backend-authoritative and race-safe using the current implementation.

## 12. Preferences and onboarding

Use existing preference fields/state only.

Supported logical concepts:
- profession optional;
- priority profile: BALANCED / STUDY_FIRST / WORK_FIRST;
- onboarding completion;
- tour version/replay if already represented.

Do not infer profession from Notes.

Profile boosts later remain modest and never outrank urgent deadlines or explicit high importance.

## 13. Dashboard and navigation

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

Logout
```

Dashboard may show:
- Quick Capture;
- Categorized Summary;
- finance snapshot.

No top-level `Your Space`.

## 14. API behavior

Use existing endpoint conventions. Finance behavior should support, where already exposed:
- list/create/read/update/delete Transactions;
- deterministic finance summary;
- filters such as direction/currency/date/domain;
- preferences;
- AI entitlement state.

All access is current-user scoped.

Do not add new persistence merely to match an endpoint sketch.

## 15. Tests

Finance:
- owner isolation;
- positive Decimal amount;
- CREDIT/DEBIT effect;
- currencies separate;
- duplicate source-linked confirmation blocked by existing rules;
- edit recalculates summary;
- timezone boundaries;
- finance source is Transaction, not NoteItem amount.

Parser/merge:
- BDT/USD forms;
- credit/debit wording;
- dates/times;
- ambiguity;
- missing amount;
- Unicode/case/punctuation;
- malicious/long input;
- deterministic-vs-Groq conflict.

AI access:
- Note saves without AI;
- session key precedence;
- trial exhaustion still permits Note saving;
- no secret persistence;
- provider failure follows existing policy.

Onboarding:
- optional profession;
- priority override;
- skip/replay where implemented;
- keyboard/mobile/reduced-motion behavior.

## 16. Acceptance

Part 3.5 is complete when behavior is correct on the existing schema, tests pass, AI cannot silently override authoritative facts, manual operation remains available, and no schema/framework migration was introduced.
