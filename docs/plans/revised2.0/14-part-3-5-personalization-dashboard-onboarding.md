# My Notes — Sequential Execution Step

> Execute this file **only after all previous numbered step files have passed their acceptance gates**.
>
> Before changing code, read:
> 1. `architecture-consistency-roadmap.md`
> 2. `after_part_3_plan.md`
> 3. `future-proof-database-plan.md`
> 4. the relevant reconciled part plan
> 5. this step file
>
> Inspect the actual repository before assuming a planned model/file already exists.

# STEP 14 — PART 3.5 PERSONALIZATION + DASHBOARD + MANUAL ADD + ONBOARDING

## Goal

Finish Part 3.5 product behavior while still on React/Vite.

Do not migrate to Next.js yet.

---

# Preferences

Add/store:

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

onboarding_completed_at
onboarding_tour_version
```

Profession is optional.

Suggested default:

```text
Student -> Study first
Employed -> Work first
Both/Other/Prefer not -> Balanced
```

User can override.

Profession must never force Note categorization.

---

# Navigation semantics

Final target naming:

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

At this stage Search/Places are unfinished.

Do not present fake functionality:
- hide them; or
- visibly mark them coming next.

---

# Categorized Summary

Dashboard cards:

```text
Tasks
Events
Shopping
Transactions
Study
```

Rules:

```text
Shopping = TASK + Shopping Domain
Study = Education Domain
Transactions = FinanceTransaction
```

Do not create new STUDY or SHOPPING types.

---

# Manual add

### Task
Creates TASK.

### Event
Creates EVENT.

### Shopping
Creates TASK + Shopping Domain.

### Study
Ask subtype:
- Task;
- Event;
- Information.

Automatically include Education Domain.

### Transaction
Creates authoritative manual FinanceTransaction.

No Groq required.

If NoteItem needs Note FK:
- create a visible manual source Note from user's entered content;
- do not invent hidden text.

---

# First-user onboarding

Flow:

```text
first login
↓
profession optional
↓
default currency/timezone confirmation
↓
priority profile
↓
AI access:
  trial / BYOK / skip
↓
short tour
↓
Dashboard
```

Do not require Groq key before Note capture.

---

# Tour v1

Target only features that actually exist now:

1. Quick Capture
2. AI analyze/review
3. Categorized Summary
4. Transactions
5. Settings

Do not spotlight Universal Search until Part 4.

Requirements:
- Skip;
- Back/Next;
- keyboard;
- mobile;
- reduced motion;
- replay from Settings;
- stable data/ref targets;
- versioned.

---

# Priority contract for Part 6

Store preference only now.

Part 6 later computes:

```text
base urgency
+ modest preference boost
+ explicit importance
+ optional nearby-shopping client boost
```

Study/Work preference never overrides:
- overdue;
- urgent deadline;
- HIGH importance.

---

# Required tests

Preferences:
- profession optional;
- default mapping;
- override persists;
- profession does not recategorize.

Manual add:
- Task;
- Event;
- Shopping;
- Study Task/Event/Information;
- Transaction.

Dashboard:
- category counts;
- Transaction summary;
- no fake Search/Places.

Tour:
- new user sees;
- existing user does not;
- skip;
- replay;
- keyboard;
- missing target safe;
- mobile;
- reduced motion.

---

# Acceptance criteria

- [ ] preferences persist.
- [ ] categorization remains independent from profession.
- [ ] final category terminology is established.
- [ ] manual add works without AI.
- [ ] onboarding is short/replayable.
- [ ] no Next.js code introduced yet.
- [ ] no fake Search/Places experience.

Wait for:

`IMPLEMENT STEP 15 — PART 3.5 FINAL QUALITY GATE`
