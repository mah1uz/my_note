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

# STEP 11 — PART 3.5 FINANCETRANSACTION LEDGER

## Goal

Introduce the authoritative financial ledger after categorization rules are stable.

---

# Model

Conceptual:

```text
FinanceTransaction
  id UUID PK
  user FK -> AppUser
  note_item FK nullable
  primary_domain FK nullable
  direction
  amount
  currency
  label
  transaction_at
  source_kind
  created_at
  updated_at
```

Directions:

```text
CREDIT
DEBIT
```

Source kinds:

```text
NOTE_DERIVED
MANUAL
OPENING_BALANCE
```

Every row is authoritative/confirmed.

Suggestions do not live in this table.

---

# Constraints

- amount > 0;
- Decimal/NUMERIC only;
- valid direction;
- normalized currency;
- unique non-null source NoteItem;
- owner matches source NoteItem's AppUser;
- one opening balance per user/currency;
- Note-derived row cascades with source item;
- manual transaction has null source NoteItem.

---

# Finance authority

After this step:

```text
FinanceTransaction
= source of truth for:
balance
income
spending
largest expense
finance history
```

`NoteItem.amount/currency` remains semantic/extraction context.

---

# Income mapping

```text
I got salary 20k.
```

Semantic item:

```text
INFORMATION
Finance Domain
```

Ledger after confirmation:

```text
CREDIT
20000
BDT
Salary
```

Do not create negative Expense.

---

# Opening balance

One per user/currency.

Positive:

```text
CREDIT
```

Negative starting debt:

```text
DEBIT
```

No mutable `current_balance` DB column.

---

# Required tests

- CREDIT adds;
- DEBIT subtracts;
- amount must be positive;
- no float;
- currency normalized;
- different currencies separate;
- duplicate NoteItem link rejected;
- opening-balance uniqueness;
- owner/source mismatch rejected;
- NoteItem deletion cascades Note-derived row;
- manual row works with no NoteItem;
- cross-user transaction access denied.

---

# Acceptance criteria

- [ ] authoritative ledger exists.
- [ ] no draft suggestions are stored as transactions.
- [ ] finance truth no longer depends on NoteItem amount.
- [ ] income/expense directions are correct.
- [ ] opening balance policy works.
- [ ] all ownership/constraint tests pass.

Wait for:

`IMPLEMENT STEP 12 — TRANSACTION SUGGESTIONS AND FINANCE SERVICES`
