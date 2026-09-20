# Part 4 Testing and Corrections

## Status

Not implemented yet. PostgreSQL, pgvector, embeddings, semantic search, and RAG do not exist in the current project.

## Planned verification

- SQLite-to-PostgreSQL migration tests.
- pgvector setup verification.
- Embedding creation, update, and deletion lifecycle tests.
- Deterministic semantic relevance fixtures.
- Empty and low-confidence result tests.
- RAG grounding and insufficient-context tests.
- Source-note citation tests.
- User-isolation tests for vector search and RAG context.
- Frontend loading, error, empty, results, and source-reference tests.

## Corrections recorded so far

- The Part 4 plan was updated to require deterministic retrieval tests and to avoid external provider/model requirements in ordinary tests.
- No Part 4 implementation correction has been made because implementation has not started.
