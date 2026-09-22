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

# STEP 04 — PART 3.4 AI LOG SPLIT + ADMIN/PRIVACY HARDENING

## Goal

Replace the legacy mixed-content `AIProcessingLog` with:

```text
AIProcessingRun
AIProcessingArtifact
```

without losing operational history or exposing sensitive payloads.

---

# A. Expand first

Create:

## AIProcessingRun

Operational metadata only:

```text
id
note FK
source_run FK nullable
operation
provider
model_name
prompt_version
note_revision
credential_source
status
error_code
sanitized error_message
latency_ms
input_chars
output_chars
created_at
completed_at
```

## AIProcessingArtifact

Sensitive:

```text
id
run OneToOne
input_snapshot nullable
raw_response
parsed_response
confirmed_response
created_at
```

Do not remove old `AIProcessingLog` yet.

---

# B. Data migration

Map old rows:

```text
safe metadata
→ Run

private payloads
→ Artifact
```

Verify:

```text
old row count
=
new run count
```

Artifact count may differ only if old rows genuinely had no private payload.

---

# C. Runtime switch

Update:
- Groq analysis service;
- review/confirm pipeline;
- retry/re-analysis lineage;
- NoteItem references if any;
- tests.

New runtime must write only Run + Artifact.

---

# D. Privacy

Do not directly register in normal Django Admin:

```text
Note
NoteItem
AIProcessingArtifact
future Transaction
future Embedding
future precise Place
```

If operational AI data is exposed to staff, use a safe projection from `AIProcessingRun`.

Sanitize provider errors.

Never store:
- API keys;
- JWTs;
- Authorization headers;
- database URLs.

---

# E. Contract phase-out

Only after:
- migration validation;
- runtime tests;
- row-count verification;

remove legacy `AIProcessingLog` via normal migration.

---

# Required tests

- existing old log rows migrated;
- Analyze creates Run;
- sensitive output goes to Artifact;
- confirmation snapshot stored where intended;
- failed provider run stores sanitized metadata;
- no API key in Run/Artifact;
- sensitive model absent from admin;
- guessed admin URL for Artifact inaccessible;
- re-analysis lineage works;
- stale revision handling unchanged;
- cross-user operations unchanged.

---

# Commands

```bash
python manage.py check
python manage.py makemigrations --check
python manage.py test --keepdb -v 1
git diff --check
```

Frontend regression:

```bash
npm test
npm run build
```

---

## Acceptance criteria

- [ ] legacy AI log is fully migrated or safely retained until verified.
- [ ] runtime uses Run + Artifact.
- [ ] sensitive artifacts are private.
- [ ] operational errors are sanitized.
- [ ] no Part-3 AI behavior regressed.
- [ ] no secret is persisted.

Wait for:

`IMPLEMENT STEP 05 — PART 3.4 FINAL GATE`
