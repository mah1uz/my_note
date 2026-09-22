# POST-PART-3 EXECUTION INDEX

## Purpose

This folder breaks the reconciled roadmap into **small, sequential, executable implementation steps**.

Run them in numeric order.

Do not skip a gate because a later feature looks more interesting.

The central novelty of the project is:

> turning raw everyday notes into trustworthy, reviewable, structured personal data.

Therefore the categorization pipeline is stabilized and measured **before** search, RAG, reminders, or deployment.

---

# Canonical sequence

```text
00  Execution index
01  Pre-flight roadmap/document corrections
02  Part 3.4 actual-schema audit
03  Part 3.4 UUID + NoteItemDomain hardening
04  Part 3.4 AI log split + admin/privacy hardening
05  Part 3.4 regression gate + docs

06  Part 3.5 shared parsing primitives
07  Part 3.5 deterministic Note pre-parser
08  Part 3.5 Groq schema + evidence grounding
09  Part 3.5 reconciliation + cross-field validation
10  Part 3.5 categorization evaluation baseline
11  Part 3.5 FinanceTransaction ledger
12  Part 3.5 transaction suggestion + finance services
13  Part 3.5 AI trial entitlement
14  Part 3.5 profession + priority + dashboard + manual add + onboarding
15  Part 3.5 final quality gate + docs

16  Part 4A Vite → Next.js migration
17  Part 4B pgvector + FTS + deterministic query parser
18  Part 4C hybrid retrieval + Universal Search
19  Part 4D strict grounded Ask My Notes

20  Part 5 Places + reminders + active-session location
21  Part 6 final intelligence + evaluation + deployment
```

---

# Global rule

Each step must end with:

```text
files changed
migrations created
tests executed
test results
manual smoke tests
known deviations
next safe step
```

If any acceptance criterion fails:

```text
STOP
fix the current step
rerun tests
```

Do not continue to the next file.

---

# Global commands

Backend:

```bash
cd /mnt/d/A1/my_note/backend
source .venv/bin/activate
python manage.py check
python manage.py makemigrations --check
python manage.py test --keepdb -v 1
```

Current Vite frontend:

```bash
cd /mnt/d/A1/my_note/frontend
npm test
npm run build
```

Repository:

```bash
git diff --check
```

After Next.js cutover, use the final Next.js package's test/build/typecheck/lint commands.

---

# Global non-negotiables

- Raw Note is always preserved.
- User ownership is never client-controlled.
- Cross-user access remains impossible.
- Session BYOK is never persisted.
- Explicit regex/parser facts cannot be silently overwritten by Groq.
- Income is not modeled as a negative expense.
- Transactions become finance truth in Part 3.5.
- Search retrieval does not depend on Groq.
- RAG must abstain when evidence is insufficient.
- Live GPS never enters RAG/Groq/embeddings.
- Do not introduce a model intent classifier.
- Do not add agents, Redis, Celery, LangChain, LlamaIndex, or a separate vector DB unless a later measured requirement justifies them.
