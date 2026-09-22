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

# STEP 09 — PART 3.5 EVIDENCE RECONCILIATION + CROSS-FIELD VALIDATION

## Goal

Create the core logic that makes categorization reliable:

```text
parser evidence
+
Groq semantic output
+
existing confirmed user data
↓
review-ready result
```

Do not hide this logic inside views/serializers.

---

# Suggested services

```text
notes/services/categorization/
  reconcile.py
  validators.py
  conflicts.py
```

---

# Precedence

Use:

```text
1. explicit raw-note facts
2. deterministic normalization of explicit facts
3. existing user-confirmed data
4. validated Groq semantic interpretation
5. weak heuristics
6. null / user clarification
```

---

# Conflict behavior

## Amount

Raw/parser:

```text
200 BDT
```

Groq:

```text
250 BDT
```

Result:

```text
200 BDT
conflict flag
```

## Date

Raw/parser:

```text
29 September
```

Groq:

```text
28 September
```

Result:

```text
29 September
conflict flag
```

## Semantic enrichment

Raw:

```text
Buy database textbook.
```

Parser:
- Shopping cue

Groq:
- Shopping + Education

Result:
- both Domains allowed.

---

# Cross-field validation

### Shopping

```text
TASK + Shopping Domain
```

valid.

### Expense

`EXPENSE` does not automatically mean authoritative Transaction.

### Income

Prefer:

```text
INFORMATION + Finance Domain
```

future CREDIT suggestion.

### Missing amount

```text
I bought apples.
```

amount stays null.

### Event time

```text
Meeting Friday.
```

date-only if no time.

Do not invent midnight.

### Primary Domain

At most one.

If ambiguous, user can choose.

---

# Multi-intent splitting

Required fixture:

```text
Tomorrow I have class at 10,
buy eggs afterwards,
and I spent 250 taka on books.
```

Expected exactly:
1. Event / Education
2. Task / Shopping
3. Expense / Education + Finance

No fourth invented item.

---

# User correction authority

When existing confirmed user data is present:
- re-analysis may suggest changes;
- user confirmation outranks model output;
- confirmed finance later must never be silently overwritten.

---

# Required tests

### Conflict tests

- amount contradiction;
- currency contradiction;
- date contradiction;
- time contradiction;
- direction contradiction.

### Multi-intent

- 3-item mixed note;
- salary + rent + task;
- two events in one Note.

### Ambiguity

- `Get that thing tomorrow.`
- `5000 taka from Rahim.`

### Negative cases

- `I love database systems.` => not Task.
- `Quiz was yesterday.` => do not create upcoming Task.

---

# Acceptance criteria

- [ ] explicit facts always win.
- [ ] semantic multi-domain enrichment remains possible.
- [ ] conflict state is reviewable.
- [ ] unknown fields remain null.
- [ ] multi-intent splitting is stable.
- [ ] user-confirmed data is higher authority than AI.
- [ ] logic is service-layer, not duplicated across endpoints.

Wait for:

`IMPLEMENT STEP 10 — CATEGORIZATION EVALUATION BASELINE`
