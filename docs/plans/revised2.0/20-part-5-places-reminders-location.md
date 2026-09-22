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

# STEP 20 — PART 5 PLACES + REMINDERS + ACTIVE-SESSION LOCATION

## Goal

Add contextual Places/reminders without contaminating search/privacy boundaries.

---

# Sequence

```text
A. verify Place/Reminder schema
B. Place CRUD
C. map UI
D. notification permission
E. centralized time reminder runtime
F. geolocation hook
G. Haversine
H. entry/exit/cooldown
I. Shopping Place assignment
J. nearby Shopping aggregation
K. privacy/error/E2E gate
```

---

# Hard rules

- Location Mode OFF by default.
- `watchPosition()` only after explicit enable.
- live GPS stays browser memory only.
- no movement-history table.
- no live GPS in Groq.
- no live GPS in RAG.
- no live GPS in embeddings.
- no live GPS in logs.

---

# Place semantics

```text
NoteItem.assigned_place
= where item belongs

Reminder.place
= where alert fires
```

They may differ.

---

# Shopping aggregation

```text
TASK
+ Shopping Domain
+ pending
```

Group by assigned Place.

Nearby alert:

```text
3 things to get at Agora: Eggs, Bread, Shampoo
```

One alert, not one per item.

---

# Web limitation

Document honestly:

> V1 reminders are active-session/browser reminders. Full background push while the browser is closed is not guaranteed.

---

# Tests

Backend:
- cross-user Place;
- cross-user Reminder;
- validation;
- delete behavior.

Frontend:
- permission denied;
- unsupported;
- watcher start/stop;
- Haversine boundary;
- no spam;
- aggregated Shopping;
- map lazy-load;
- no hydration errors.

Privacy:
- no coordinate in search/RAG/embedding payload;
- no movement history.

---

# Acceptance criteria

- [ ] Places user scoped.
- [ ] reminders valid/user scoped.
- [ ] location mode opt-in.
- [ ] watcher clears.
- [ ] no GPS history.
- [ ] nearby shopping aggregated.
- [ ] Search/RAG privacy unchanged.
- [ ] web limitation documented.

Wait for:

`IMPLEMENT STEP 21 — PART 6 FINAL SYSTEM`
