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

# STEP 10 — PART 3.5 CATEGORIZATION EVALUATION BASELINE

## Goal

Measure the project's main novelty before more features depend on it.

Create an offline labelled categorization dataset and evaluation harness.

---

# Dataset

Recommended:

```text
150–250 examples
```

Coverage:

- simple Tasks
- Events
- Expenses
- Information
- Shopping
- Education/Study
- Work
- Health
- Travel
- multi-intent
- income/CREDIT
- ambiguous notes
- relative dates
- quantities
- noisy/spelling variants
- prompt-injection-like content

Do not use private production Notes unless intentionally anonymized.

---

# Ground-truth schema

For each Note store expected:
- item count;
- item types;
- Domains;
- primary Domain where applicable;
- dates/times;
- amount/currency;
- quantity/unit;
- transaction direction hint if explicit;
- ambiguity flags.

---

# Metrics

## Structural

```text
item-count exact accuracy
item-type macro precision
item-type macro recall
item-type macro F1
Domain multi-label precision/recall/F1
primary-domain accuracy
```

## Fields

```text
amount exact accuracy
currency accuracy
date accuracy
time accuracy
quantity/unit accuracy
transaction-direction accuracy
```

## Safety

```text
schema validity
unsupported-field invention rate
conflict detection rate
ambiguous-case abstention rate
```

---

# Initial target guidance

Targets are quality gates, not numbers to fake.

Suggested:

```text
Item-type macro F1               >= .90
Domain multi-label F1            >= .85
Explicit amount accuracy         >= .98
Currency accuracy                >= .98
Explicit date extraction         >= .95
Direction accuracy               >= .95 on unambiguous cases
```

Hard blockers:

```text
accepted invalid schema          = 0
explicit amount silently changed = 0
explicit date silently changed   = 0
cross-user leak                  = 0
raw Note loss on failure         = 0
```

---

# Evaluation modes

At minimum compare:

```text
Groq-only baseline where available
vs
regex + Groq + reconciliation
```

This supports the capstone claim that the hybrid categorization pipeline improves reliability.

---

# Output

Produce:

```text
docs/evaluation/categorization-dataset.*
docs/evaluation/categorization-results.md
```

or the project's chosen equivalent.

Record:
- date;
- model;
- prompt version;
- parser version;
- number of examples;
- metrics;
- known weak classes.

---

# Acceptance criteria

- [ ] labelled dataset exists.
- [ ] evaluation is reproducible.
- [ ] baseline metrics recorded.
- [ ] hard blocker rates are zero in fixtures.
- [ ] weak categories are documented honestly.
- [ ] no training is required.

Wait for:

`IMPLEMENT STEP 11 — FINANCE TRANSACTION LEDGER`
