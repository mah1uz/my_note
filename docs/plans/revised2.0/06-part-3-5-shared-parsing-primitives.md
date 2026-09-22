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

# STEP 06 — PART 3.5 SHARED PARSING PRIMITIVES

## Goal

Build deterministic parsing primitives that will be reused by:

```text
Note categorization pre-parser
Search query parser
Finance normalization
```

Do not implement high-level categorization yet.

---

# Suggested structure

```text
backend/common/parsing/
  __init__.py
  money.py
  currency.py
  dates.py
  quantities.py
  text.py
```

If the existing repo has a better shared utilities location, use it.

---

# Money parsing

Support at minimum:

```text
৳200
200 taka
200 tk
BDT 200
20k
20 k
1.5k
20 thousand
2 lakh
2 lac
$20
USD 20
20 dollars
```

Use Python `Decimal`.

Examples:

```text
20k      -> Decimal("20000")
1.5k     -> Decimal("1500")
2 lakh   -> Decimal("200000")
```

Do not parse using float intermediate values.

---

# Currency normalization

Initial aliases:

```text
৳ / taka / tk / bdt
→ BDT

$ / usd / dollar / dollars
→ USD
```

Do not guess unsupported currency.

---

# Date/time primitives

Support explicit and relative cues:

```text
today
tomorrow
yesterday
Friday
next Friday
29 September
Sep 29
2026-09-29
10am
10:30 PM
```

Rules:
- resolve with `AppUser.timezone`;
- preserve date-only when no time exists;
- do not invent midnight as a semantic time;
- functions should accept deterministic "now" for tests.

---

# Quantity primitives

Examples:

```text
300gm
300 g
2 kg
3 bottles
12 eggs
```

Normalize unit vocabulary where safe.

---

# Text normalization

For parser working copies:
- Unicode normalize;
- collapse repeated whitespace;
- preserve raw Note separately;
- avoid destructive transliteration.

---

# Regex safety

- bound input length;
- avoid catastrophic backtracking;
- no unbounded nested patterns;
- test hostile repeated strings.

---

# Required tests

Money:

```text
20k
1.5k
2 lakh
200 taka
৳200
USD 20
$20
```

Dates:
- timezone boundary;
- month boundary;
- Friday/next Friday;
- date-only vs datetime.

Quantities:
- `300gm`;
- `2 kg`;
- malformed values.

Safety:
- 10k+ repeated punctuation/characters;
- Unicode;
- empty text;
- malformed numbers.

---

# Acceptance criteria

- [ ] Decimal-only money parsing.
- [ ] deterministic currency normalization.
- [ ] timezone-aware date resolution.
- [ ] no fake midnight semantics.
- [ ] reusable quantity parser.
- [ ] regex safety tests pass.
- [ ] no Groq dependency introduced.

Wait for:

`IMPLEMENT STEP 07 — DETERMINISTIC NOTE PRE-PARSER`
