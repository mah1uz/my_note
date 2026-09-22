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

# STEP 07 — PART 3.5 DETERMINISTIC NOTE PRE-PARSER

## Goal

Extract **explicit evidence** from raw Notes before Groq semantic analysis.

The pre-parser is not the categorizer by itself.

---

# Suggested structure

```text
notes/services/preparser/
  parser.py
  task_cues.py
  event_cues.py
  shopping_cues.py
  finance_cues.py
  labels.py
```

Reuse shared money/date/quantity primitives from Step 06.

---

# Output shape

Return evidence objects, not only naked values.

Concept:

```json
{
  "money": [
    {
      "raw": "200 taka",
      "amount": "200.0000",
      "currency": "BDT",
      "start": 18,
      "end": 26,
      "strength": "EXPLICIT"
    }
  ],
  "finance_direction": {
    "value": "DEBIT",
    "evidence": "bought",
    "strength": "STRONG_CUE"
  },
  "event_cues": [],
  "task_cues": [],
  "shopping_cues": [],
  "date_hints": [],
  "time_hints": [],
  "quantities": []
}
```

Strengths:

```text
EXPLICIT
STRONG_CUE
WEAK_CUE
AMBIGUOUS
```

---

# Cue examples

Task:

```text
need to
have to
must
remember to
submit
finish
send
```

Event:

```text
quiz
exam
meeting
interview
class
appointment
presentation
```

Shopping:

```text
buy
need to get
out of
grocery
groceries
```

Do not create a giant product dictionary.

Debit:

```text
bought
purchased
spent
paid
charged
bill
fee
rent
fare
```

Credit:

```text
salary
got paid
received
credited
earned
refund
cashback
bonus
allowance
```

Ambiguous:

```text
5000 taka from Rahim
```

direction remains unresolved.

---

# Label candidate extraction

Grounded examples:

```text
bought apple at 200 taka
→ Apple

paid 1200 for internet
→ Internet

spent 500 on transport
→ Transport

got salary 20k
→ Salary
```

If unreliable:

```text
Transaction
```

Never invent a product/source.

---

# What NOT to do

Do not use regex rules like:

```text
egg always means Shopping
book always means Education
doctor always means Health
```

Semantic categorization belongs to Groq + user review.

---

# Required tests

At minimum:

```text
I have a quiz tomorrow at 10am.
I need to buy eggs.
Interview call on 29 September.
I bought apple at 200 taka.
I paid 1200 tk for internet.
I spent $20 on lunch.
I just got my salary 20k.
I received 2 lakh taka.
5000 taka from Rahim.
I bought apples.
Bought 300gm chilli for 50 taka.
Salary 20k and paid rent 8k.
```

Verify:
- explicit spans;
- amounts;
- currencies;
- quantities;
- date/time hints;
- direction;
- ambiguity;
- label candidates;
- no invented values.

---

# Acceptance criteria

- [ ] explicit evidence is structured.
- [ ] ambiguous direction stays ambiguous.
- [ ] raw Note is unchanged.
- [ ] label candidates are grounded.
- [ ] regex remains deterministic/tested.
- [ ] no semantic overreach via giant dictionaries.

Wait for:

`IMPLEMENT STEP 08 — GROQ SCHEMA AND EVIDENCE GROUNDING`
