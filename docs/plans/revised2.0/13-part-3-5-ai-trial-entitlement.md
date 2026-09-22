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

# STEP 13 — PART 3.5 AI TRIAL ENTITLEMENT

## Goal

Allow limited server-funded AI usage without making Note capture depend on Groq.

---

# Priority

```text
session BYOK present
→ USER_SESSION

else trial available
→ reserve trial
→ use backend server key

else
→ save raw Note
→ AI unavailable
→ manual organization remains available
```

Never use server key as unlimited fallback.

---

# Model

```text
UserAiEntitlement
  id UUID
  user OneToOne
  trial_limit
  trial_used
  trial_started_at
  trial_expires_at nullable
  timestamps
```

---

# Concurrency

Quota check and reservation must be atomic.

Use:
- row lock; or
- conditional atomic update.

Do not:

```text
read trial_used
if below limit:
  increment later
```

which races.

---

# Charge policy

Recommended:

```text
local validation rejects before provider call
→ no charge

provider request initiated
→ charge 1

provider timeout/failure after request began
→ remains charged
```

Document it.

---

# Security

- frontend count is display-only;
- backend controls quota;
- rate-limit trial endpoint/analysis;
- never expose backend Groq key;
- credential source stored, never credential itself.

---

# Required tests

- BYOK wins over trial;
- trial used without BYOK;
- exhausted trial blocks server-funded AI;
- exhausted trial still saves Note;
- simultaneous requests cannot overspend quota;
- expiry enforced;
- refresh/logout clears BYOK;
- no key in DB/logs;
- charge policy tested.

---

# Acceptance criteria

- [ ] Note capture works without AI.
- [ ] quota is backend authoritative.
- [ ] race condition is prevented.
- [ ] server key never becomes public fallback.
- [ ] no BYOK persistence.

Wait for:

`IMPLEMENT STEP 14 — PERSONALIZATION, DASHBOARD, MANUAL ADD, ONBOARDING`
