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

# STEP 12 — PART 3.5 TRANSACTION SUGGESTIONS + FINANCE SERVICES

## Goal

Connect categorization to the financial ledger safely.

---

# Suggestion lifecycle

```text
categorization result
↓
SUGGESTED
├─ edit
├─ reject for current revision
└─ confirm
   ↓
FinanceTransaction row
```

A suggestion is not a ledger row.

---

# Complete suggestion

Example:

```text
Apples
Expense / Debit
৳200
Today

[Edit] [Save expense]
```

---

# Missing amount

```text
I bought apples.
```

Show:

```text
Apples
Amount [     ]
Currency [BDT]

[Skip] [Save expense]
```

Do not invent amount.

---

# Missing direction

```text
5000 taka from Rahim
```

Ask:

```text
[+ Income] [- Expense]
```

---

# Re-analysis

If a confirmed transaction already exists:
- keep it authoritative;
- do not duplicate;
- do not auto-overwrite;
- show explicit update/conflict suggestion if source changed.

---

# FinanceService

Create one reusable service.

Suggested responsibilities:

```text
balance_by_currency(user)
period_summary(user, range)
largest_expenses(user, range)
domain_totals(user, range)
transaction_history(user, filters)
```

Part 4 Search and Part 6 dashboard must reuse this service.

---

# Timezone

`this month`, `today`, etc.:

1. resolve boundary in AppUser timezone;
2. convert to aware timestamps;
3. query PostgreSQL.

---

# API

Approximate:

```text
GET/POST /api/v1/transactions/
GET/PATCH/DELETE /api/v1/transactions/:id/
GET /api/v1/finance/summary/
```

Owner-scoped.

---

# Required tests

Suggestion:
- complete debit;
- complete credit;
- missing amount;
- missing direction;
- edit before confirm;
- reject;
- re-analysis no duplicate;
- stale revision rejected.

Finance:
- BDT balance;
- USD separate;
- monthly income;
- monthly spending;
- largest expense;
- domain totals;
- timezone month boundary;
- manual transaction edits update summary.

---

# Acceptance criteria

- [ ] user confirmation required for Note-derived financial impact.
- [ ] incomplete data never silently invented.
- [ ] finance service is single source for aggregates.
- [ ] re-analysis cannot rewrite ledger automatically.
- [ ] API is owner-scoped.
- [ ] timezone period summaries are tested.

Wait for:

`IMPLEMENT STEP 13 — AI TRIAL ENTITLEMENT`
