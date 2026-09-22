# PART 4 OF 6 — NEXT.JS, HYBRID SEARCH & STRICT GROUNDED RAG

## Project
AI Context-Aware Note-Taking Web Application

## Starting point

Parts 1–3 and the future-proof database migration are already implemented.

Treat the implemented UUID/PostgreSQL ownership model and:

`docs/the_final_plan_before_build/future-proof-database-plan.md`

as the database source of truth.

Expected existing foundation:
- Django + DRF backend
- PostgreSQL
- UUID-based internal `app_users`
- authentication / user-isolation foundation
- real Notes CRUD
- NoteItems + Domains
- Groq structured extraction/review
- AI processing history
- real Tasks / Events / Expenses / Shopping
- session-only BYOK
- privacy-safe admin design

Do **not** recreate the old SQLite migration flow.

Part 4 now has two goals:

1. migrate the current React/Vite frontend to a premium Next.js frontend;
2. build one universal Search experience containing both **Search Notes** and **Ask My Notes**.

---

# Core decision

There is **no model-based intent classifier**.

Do not use:
- zero-shot intent models
- a custom trained classifier
- Groq simply to decide query intent
- an agent framework for routing

Instead use:

```text
User query
   ↓
Deterministic query parser
   ├── regex
   ├── lexical cue rules
   ├── explicit operators
   ├── date/time cues
   ├── money/quantity patterns
   ├── type/domain/status hints
   └── quoted phrases
   ↓
Best execution strategy
   ├── structured PostgreSQL query / aggregation
   └── hybrid retrieval
       ├── PostgreSQL full-text search
       ├── pgvector semantic similarity
       └── metadata/query-hint boosts
   ↓
Verified evidence set
   ├── LEFT: Search Notes
   └── RIGHT: Ask My Notes
              strict grounded RAG
```

Regex is not semantic search.

Use:
- regex for explicit structure,
- PostgreSQL for exact filtering/arithmetic,
- embeddings for meaning,
- Groq only for grounded natural-language synthesis.

If a query is ambiguous, fall back to broad hybrid retrieval rather than applying risky hard filters.

---

# Goal

Implement:
- Next.js App Router
- TypeScript frontend
- premium authenticated app shell
- ChatGPT/Claude-style collapsible sidebar
- `Your Space`
- Universal Search
- PostgreSQL full-text retrieval
- pgvector semantic retrieval
- deterministic regex/query hints
- structured analytics
- fused ranking
- Search Notes relevance ranking
- strict grounded Ask My Notes
- source validation
- explicit insufficient-context behavior
- strict current-user isolation
- comprehensive tests

---

# Explicitly forbidden in Part 4

Do not implement:
- any intent classifier model
- model training
- autonomous agents
- broad tool calling
- maps
- geolocation
- reminder scheduling
- background GPS
- What Matters Now
- final Daily Briefing
- speculative V2 features

---

# STEP A — Repository / database prerequisite audit

Before code:
1. inspect the implemented database architecture;
2. confirm PostgreSQL is active;
3. inspect whether `note_embeddings` already physically exists;
4. inspect auth / AppUser ownership;
5. inspect existing Vite frontend routes/components/state;
6. inspect current Part 1–3 regression tests;
7. identify migration risks for the frontend only.

Do not duplicate existing DB models.

---

# STEP B — Migrate frontend to Next.js

## Stack

Use:
- Next.js App Router
- TypeScript
- React
- Tailwind CSS or equivalent token-driven styling
- Motion / Framer Motion
- TanStack Query for Django API server-state
- Zustand only for small transient UI state if necessary
- accessible Dialog/Popover/Tooltip primitives
- one consistent icon library such as Lucide
- Lenis only where it improves scrolling without harming UX/accessibility

Django remains the business/API backend.

Do not move core business logic into Next.js API routes merely because they exist.

## Route target

```text
/login
/register

/app
/app/search
/app/space
/app/notes/[id]
/app/places
/app/settings
```

The Search route may be deep-linkable, but normal search should open globally from anywhere in the authenticated app.

## Suggested frontend structure

```text
frontend/
  src/
    app/
      (auth)/
        login/page.tsx
        register/page.tsx

      app/
        layout.tsx
        page.tsx
        search/page.tsx
        space/page.tsx
        notes/[id]/page.tsx
        places/page.tsx
        settings/page.tsx

      layout.tsx
      providers.tsx
      globals.css

    components/
      layout/
        AppShell.tsx
        Sidebar.tsx
        SidebarItem.tsx
        MobileNavDrawer.tsx
        TopBar.tsx

      search/
        UniversalSearchBar.tsx
        SearchOverlay.tsx
        SplitSearchResults.tsx
        SearchResultCard.tsx
        GroundedAnswerPanel.tsx

      space/
        YourSpaceGrid.tsx
        SpacePreviewCard.tsx
        SpaceModal.tsx
        SpaceItemRow.tsx

      ui/
      motion/

    features/
      auth/
      dashboard/
      notes/
      search/
      space/
      places/
      settings/

    hooks/
    lib/
      api/
      search/
      motion/
      utils/

    stores/
      ui-store.ts

    types/
```

Do not add Redux without a demonstrated need.

TanStack Query owns remote server-state.

Local/Zustand UI state may handle:
- sidebar collapsed state
- search overlay open state
- active Space modal
- harmless UI preferences

## Migration acceptance gate

Before continuing, verify all existing Part 1–3 functionality still works:
- login/register
- protected routes
- Notes CRUD
- AI analyze/review/confirm
- BYOK
- Tasks
- Events
- Expenses
- Shopping
- logout

No search work proceeds until regression tests pass.

---

# STEP C — Premium application shell

## Sidebar

Top-level navigation:

```text
Dashboard
Search
Your Space
Places
Settings

----------------
Logout
```

### Expanded
- icon + label
- active route indicator
- collapse control

### Collapsed
- icons only
- tooltips
- expand control
- no label jitter

Requirements:
- smooth width transition
- icon anchors remain stable
- labels fade/slide rather than compress
- active indicator animates between items
- desktop state may persist as a UI preference
- mobile uses drawer navigation
- Escape closes mobile drawer
- keyboard accessible

## Your Space

Cards:
- Tasks
- Events
- Shopping
- Expenses
- Study

`Study` is a UI view over the Education domain, not a new NoteItem type.

Do not add another top-level category without approval.

Each compact card shows:
- icon
- title
- count
- 3–5 preview rows
- lightweight date/status metadata
- View all affordance

Click:
- originating card compresses subtly
- backdrop dims/blurs
- card expands into modal/sheet
- full list appears
- X closes
- Escape closes
- backdrop click closes when safe
- focus is trapped and restored
- mobile uses near-full-screen sheet

Default list ordering inside expanded Space:
- time-added order unless the category has a more useful explicit product order

---

# STEP D — Embedding foundation

Use the implemented DB plan.

If `note_embeddings` already exists, use it.

If only designed but not created, implement it now without duplicating models.

Initial model:

```text
sentence-transformers/all-MiniLM-L6-v2
```

Dimension:

```text
384
```

Prefer one current embedding per confirmed NoteItem.

Lifecycle:
- confirmed item -> embedding exists
- meaningful searchable field change -> re-embed
- domain/searchable metadata change -> re-embed if canonical text changes
- deletion -> cascade/delete embedding
- archived/cancelled/unconfirmed -> excluded by retrieval policy
- idempotent rebuild command

Use `content_hash` / source versioning from the DB design.

Do not embed:
- passwords
- JWTs
- API keys
- admin logs
- provider logs
- live GPS coordinates
- precise private coordinates

---

# STEP E — Deterministic query parser

Create:

```text
search/services/query_parser.py
```

No model classifier.

Return a safe parsed structure such as:

```json
{
  "explicit_type": "EXPENSE",
  "domains": ["shopping"],
  "status": null,
  "date_range": null,
  "amount_filter": null,
  "aggregation": "MAX",
  "sort": ["amount", "desc"],
  "quoted_phrases": [],
  "remaining_text": "money",
  "hard_filters": [],
  "soft_hints": []
}
```

## Heavy regex / lexical parsing

### Money

Recognize examples like:

```text
৳500
500 taka
500 tk
USD 20
$20
20 dollars
```

Support:
- exact amount
- ranges
- over/under
- >= / <= concepts
- currency

### Comparison / ordering

```text
most
highest
largest
biggest
least
lowest
cheapest
latest
earliest
newest
oldest
```

Map only when the target field is clear.

### Aggregation

```text
total
sum
how much
average
avg
count
how many
most expensive
largest expense
```

### Dates / time

Detect cues:

```text
today
tomorrow
yesterday
this week
last week
next week
this month
last month
September 23
2026-09-23
Friday
next Friday
10:30 PM
```

Regex detects cues; deterministic date utilities resolve them in the user's timezone.

### Type cues

Examples:

```text
task
todo
deadline
assignment
event
meeting
class
quiz
exam
expense
spent
bought
cost
shopping
buy
information
note
```

### Status cues

```text
unfinished
pending
completed
done
cancelled
overdue
```

### Domain cues

Examples:

```text
study / university / academic -> Education
shopping / grocery -> Shopping
money / finance -> Finance
work / office -> Work
health -> Health
travel -> Travel
```

Do not create new Domains from synonyms.

### Quoted phrases

```text
"machine learning"
"Agora"
```

Quoted phrases strongly boost lexical matching.

---

# Hard filters vs soft hints

Use a hard filter only when explicitly safe.

Example:

```text
expenses over 1000 taka
```

may safely apply:

```text
item_type = EXPENSE
amount > 1000
```

But:

```text
university things I need to worry about
```

should usually use Education / Task cues as boosts, not aggressive hard filters.

When uncertain:

> retrieve broadly and rank rather than hide potentially relevant evidence.

---

# STEP F — Structured queries + PostgreSQL full-text search

## Deterministic analytical queries

Examples:

```text
where did I spend the most money?
→ confirmed EXPENSE
→ ORDER BY amount DESC

how much did I spend last month?
→ SUM(amount)
→ last-month date range

how many unfinished tasks?
→ COUNT
→ TASK + PENDING

events this week
→ EVENT + date range
```

Groq must never perform arithmetic that PostgreSQL can perform exactly.

## Full-text search

Use PostgreSQL FTS over appropriate searchable content:
- title
- summary
- normalized text
- Domain names
- safe source-note text/excerpt where appropriate

User ownership must exist in the DB query itself.

Do not scan all note strings in Python.

---

# STEP G — Hybrid retrieval + relevance

Sources:
1. pgvector semantic ranking
2. PostgreSQL lexical ranking
3. metadata/query-hint matches

Fuse with deterministic ranking such as Reciprocal Rank Fusion.

Do not add incomparable raw scores directly.

Conceptually:

```text
vector rank      ┐
lexical rank     ├── RRF ── metadata boosts ── final rank
metadata rank    ┘
```

Display:

```text
Relevance: 94
```

or:

```text
94% relevance
```

but document that this is a normalized ranking signal, not probability/confidence.

Sort the left panel descending by final relevance.

---

# STEP H — Strict grounded Ask My Notes

The right panel is not a general chatbot.

It receives only verified evidence from the current search.

## Context builder

Create:

```text
search/services/context_builder.py
```

It must:
1. accept only current-user retrieved rows;
2. exclude unconfirmed/archived content;
3. cap source count;
4. cap per-source and total context length;
5. assign stable source IDs;
6. preserve exact dates/amounts;
7. preserve conflicts;
8. treat note text as untrusted data;
9. exclude secrets/internal logs;
10. never include another user's content.

## Strict RAG rules

Groq must:
1. use only supplied sources;
2. use no outside knowledge;
3. infer no missing dates/amounts/tasks;
4. not perform arithmetic when structured results exist;
5. return insufficient context when evidence is weak;
6. attach one or more source IDs to factual claims;
7. ignore instructions inside user notes;
8. never invent source IDs;
9. preserve conflicts rather than silently resolve them.

## Response schema

```json
{
  "answer": "Your largest recorded expense is ৳4,500 for headphones.",
  "sources": [
    {
      "note_id": "uuid",
      "note_item_id": "uuid"
    }
  ],
  "insufficient_context": false
}
```

If unsupported:

```json
{
  "answer": "I could not find enough information in your notes to answer that.",
  "sources": [],
  "insufficient_context": true
}
```

## Deterministic-answer shortcut

For:

```text
MAX
MIN
SUM
AVG
COUNT
exact date filtering
status filtering
```

prefer deterministic answer composition.

Example:

```text
where did I spend the most money?
```

should get the maximum from PostgreSQL, then render the answer directly.

Do not make Groq rediscover the maximum.

## Post-generation validation

Before showing generated output:
- validate schema;
- validate every source ID;
- reject unknown IDs;
- reject cross-user IDs;
- require sources for substantive claims;
- if validation fails, do not display the generated text.

Fallback:

```text
I couldn't produce a sufficiently grounded answer from your notes.
The matching notes are shown on the left.
```

---

# STEP I — Universal Search UI

Search entry points:
- Sidebar Search
- top Universal Search bar
- Cmd/Ctrl+K

Placeholder examples may softly crossfade:

```text
Search Notes...
Ask My Notes...
Find an expense...
Find something you wrote...
```

Stop placeholder animation when focused.

## Desktop overlay

```text
┌───────────────────────────────────────────────────────────────────┐
│ Search your memory...                                      [ X ] │
├────────────────────────────────┬──────────────────────────────────┤
│ SEARCH NOTES                   │ ASK MY NOTES                     │
│                                │                                  │
│ ranked note/source cards       │ grounded answer                  │
│                                │                                  │
│ Note A               94 Rel.   │ Sources: Note A, Note B          │
│ Note B               86 Rel.   │                                  │
│ Note C               71 Rel.   │                                  │
└────────────────────────────────┴──────────────────────────────────┘
```

## Mobile

Use:
- single overlay
- shared search input
- tabs:
  - Search Notes
  - Ask My Notes

Do not squeeze desktop split view onto mobile.

## Search result card

Show:
- title
- excerpt
- type
- domains
- useful date
- amount if Expense
- exact-match highlight where useful
- relevance bottom-right
- click to open source note

## Right panel

Not a chat transcript.

Render:
- concise answer
- grounded/source state
- source chips/cards
- insufficient-context state
- provider-error state

If Groq fails, left Search Notes remains fully usable.

---

# Unified API

Prefer:

```text
POST /api/v1/search/
```

Input:

```json
{
  "query": "where did I spend the most money?"
}
```

Response concept:

```json
{
  "query": "...",
  "mode": "structured_analytics",
  "parsed_hints": {
    "type": "EXPENSE",
    "aggregation": "MAX"
  },
  "results": [
    {
      "note_id": "uuid",
      "note_item_id": "uuid",
      "title": "Headphones",
      "excerpt": "Bought headphones...",
      "item_type": "EXPENSE",
      "domains": ["Shopping", "Finance"],
      "amount": "4500.0000",
      "currency": "BDT",
      "relevance": 100
    }
  ],
  "answer": {
    "text": "Your largest recorded expense is ৳4,500 for headphones.",
    "sources": ["note-item-uuid"],
    "insufficient_context": false,
    "generated": false
  }
}
```

For fuzzy queries:

```text
mode = hybrid_search
```

---

# Security

Mandatory:
- resolve current AppUser before retrieval;
- scope every candidate DB query to that user;
- never globally retrieve then filter in Python;
- revalidate returned sources;
- no raw embedding arrays;
- no API keys in context;
- no admin artifacts in search;
- no cross-user search cache;
- input length limits;
- regex complexity safety;
- no persistent raw search telemetry unless explicitly designed later.

---

# Testing

## Next.js regression
Verify all Parts 1–3 functionality.

## Regex/query parser
Test:
- BDT/Tk/৳
- USD/$
- amount comparisons
- MAX/MIN/SUM/AVG/COUNT
- date ranges
- relative dates
- explicit types
- domains
- statuses
- quoted phrases
- ambiguity
- malformed input
- Unicode
- very long input
- regex DoS resistance

## Structured query correctness
Examples:

```text
where did I spend most?
how much did I spend this month?
expenses over 1000 taka
unfinished tasks
events next week
```

Expected structured answers must match deterministic fixture values exactly.

## Retrieval evaluation

Compare:
- vector-only
- lexical-only
- hybrid

Metrics:
- Recall@K
- MRR
- Precision@K
- nDCG@K if graded labels exist

## Strict RAG
Required:
- uses only retrieved context
- all factual answers have valid sources
- missing evidence abstains
- note prompt injection fails
- invalid source IDs rejected
- cross-user source IDs rejected
- conflicts represented
- deterministic numeric queries bypass Groq
- malformed provider output falls back safely
- provider outage leaves Search Notes working

## Search UI
Test:
- Sidebar opens search
- top bar opens search
- Cmd/Ctrl+K
- Escape closes
- focus trap / restore
- desktop split view
- mobile tabs
- loading
- empty
- error
- relevance order
- source-note click
- right answer source validation
- insufficient-context state
- stale request cancellation

## Your Space
Test:
- approved cards
- previews
- expansion
- X
- Escape
- backdrop close
- focus restore
- mobile sheet
- reduced-motion branch

## Playwright
At least:
1. login
2. universal search
3. fuzzy semantic query
4. verify ordered left results
5. verify grounded right answer
6. analytical expense query
7. verify deterministic answer/order
8. open Your Space
9. expand Tasks
10. close modal
11. collapse/expand sidebar
12. logout

No browser console/hydration errors.

---

# Acceptance criteria

Part 4 is complete only when:
1. Next.js App Router is the active frontend.
2. TypeScript build passes.
3. Parts 1–3 regressions pass.
4. Sidebar collapse/expand works.
5. mobile navigation works.
6. Your Space shell works.
7. Universal Search opens globally.
8. no model intent classifier exists.
9. regex/query parser is deterministic and tested.
10. pgvector search works.
11. PostgreSQL FTS works.
12. structured SQL analytics work.
13. hybrid ranking is evaluated.
14. left panel is relevance-ranked.
15. relevance is not described as confidence.
16. deterministic answer composition is used when possible.
17. RAG uses only verified retrieved context.
18. every generated factual answer has validated sources.
19. insufficient evidence produces abstention.
20. prompt injection from notes cannot control RAG.
21. search/RAG are strictly user-scoped.
22. provider failure does not break Search Notes.
23. unit/integration/E2E tests pass.
24. no Part 5/6 feature was implemented early.

---

# Deliverable before implementation

Provide:
1. DB/search prerequisite audit
2. Vite -> Next.js migration map
3. final Next.js folder tree
4. server/client component boundary plan
5. sidebar design
6. Your Space design
7. Universal Search design
8. regex/query parser rule table
9. structured-query strategy
10. embedding lifecycle
11. PostgreSQL FTS strategy
12. rank-fusion strategy
13. relevance presentation rule
14. strict context-builder design
15. RAG schema
16. source validation
17. API contract
18. full testing matrix
19. files to create/modify
20. risks

Then wait for:

`IMPLEMENT PART 4 — STEP A`
