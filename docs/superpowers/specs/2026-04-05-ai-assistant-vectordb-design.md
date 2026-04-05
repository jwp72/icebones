# IceBones AI Assistant — Vector DB + Retrieval API

## Overview

Add an AI-powered assistant to IceBones that helps users learn the editor, build skeletons, and troubleshoot issues. The assistant uses retrieval-augmented generation (RAG) — it searches the IceBones documentation via pgvector semantic search, then sends relevant context to an LLM to generate accurate, grounded answers.

This spec covers the backend infrastructure: pgvector database, document ingestion pipeline, semantic search API, and LLM-agnostic chat endpoint. The editor-side chat UI is a future addition that consumes this API.

## Architecture

```
Editor (React) or any client
  └─ HTTP requests
       │
       v
FastAPI Service (packages/api/)
  ├─ POST /api/chat        → RAG pipeline (embed query → search → LLM → response)
  ├─ POST /api/search      → Vector similarity search (returns chunks)
  ├─ POST /api/ingest      → Index documentation into pgvector
  ├─ GET  /api/health      → Service health check
  └─ GET  /api/stats       → Document/chunk counts
       │
       ├─── Voyage AI API (embeddings: voyage-3-lite, 512 dimensions)
       ├─── LLM API (configurable: Claude, GPT-4, etc.)
       │
       v
PostgreSQL 16 + pgvector (Docker for dev, hosted for prod)
  └─ documents table with vector(512) column
```

## Tech Stack

- **API framework:** FastAPI (Python 3.12+)
- **Database:** PostgreSQL 16 with pgvector extension
- **Embeddings:** Voyage AI voyage-3-lite (512 dimensions, ~$0.02/1M tokens)
- **LLM:** Abstracted behind an interface. Default implementation uses Claude (Anthropic API). Swappable to OpenAI, local models, etc.
- **Dev infrastructure:** Docker Compose for PostgreSQL + pgvector
- **Python dependencies:** fastapi, uvicorn, asyncpg, pgvector, voyageai, anthropic, tiktoken, pydantic

## Database Schema

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  source_file VARCHAR(255) NOT NULL,
  heading_path VARCHAR(500) NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  token_count INTEGER NOT NULL DEFAULT 0,
  embedding vector(512) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cosine similarity index for fast vector search
CREATE INDEX idx_documents_embedding ON documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- Index for filtering by source file
CREATE INDEX idx_documents_source ON documents (source_file);

-- Unique constraint to prevent duplicate chunks
CREATE UNIQUE INDEX idx_documents_unique_chunk
  ON documents (source_file, heading_path, chunk_index);
```

The `lists = 10` parameter for ivfflat is appropriate for our small corpus (~50-100 chunks). Increase to `sqrt(n)` if the corpus grows past 1,000 chunks.

## Document Ingestion Pipeline

### Chunking Strategy

Documentation is split into chunks at markdown heading boundaries:

1. Parse each `.md` file
2. Split at `##` and `###` headings
3. Each chunk includes:
   - The heading text as context prefix
   - The full heading path (e.g., "Editor Guide > Viewport > Navigation")
   - The content under that heading
4. If a chunk exceeds ~500 tokens, split at paragraph boundaries within it
5. Each chunk retains its source file path for attribution

### Chunking Example

From `docs/editor-guide.md`:

```
Chunk 1:
  source_file: "docs/editor-guide.md"
  heading_path: "Editor Guide > Toolbar"
  content: "## Toolbar\n\nThe toolbar sits at the top of the editor window..."
  chunk_index: 0

Chunk 2:
  source_file: "docs/editor-guide.md"
  heading_path: "Editor Guide > Viewport > Navigation"
  content: "### Navigation\n\nPan the viewport by holding..."
  chunk_index: 0
```

### Ingestion Flow

```
POST /api/ingest
  { "docs_path": "/app/docs" }   (absolute path inside container; defaults to the mounted docs directory)
       │
       v
1. Scan for .md files in docs/ and packages/*/README.md
2. Parse each file into chunks (heading-based splitting)
3. For each chunk:
   a. Count tokens (tiktoken)
   b. Generate embedding via Voyage AI
   c. Upsert into documents table (unique on source_file + heading_path + chunk_index)
4. Return summary: { files_processed, chunks_created, chunks_updated }
```

The ingestion endpoint is idempotent — running it again updates existing chunks and adds new ones without duplicates.

## API Endpoints

### POST /api/ingest

Indexes documentation into the vector database.

**Request:**
```json
{
  "docs_path": "docs/"
}
```

**Response:**
```json
{
  "files_processed": 8,
  "chunks_created": 47,
  "chunks_updated": 0,
  "total_tokens": 12340
}
```

### POST /api/search

Semantic search over indexed documentation. Returns the most relevant chunks.

**Request:**
```json
{
  "query": "How do I create a bone in the editor?",
  "top_k": 5,
  "threshold": 0.3
}
```

**Response:**
```json
{
  "results": [
    {
      "content": "### Bone Creation\n\nSelect the Bone tool from the toolbar...",
      "source_file": "docs/editor-guide.md",
      "heading_path": "Editor Guide > Toolbar > Bone Tool",
      "score": 0.87,
      "token_count": 120
    }
  ]
}
```

### POST /api/chat

RAG-powered chat. Retrieves relevant documentation, sends to LLM, returns answer.

**Request:**
```json
{
  "message": "How do I add team colors to equipment?",
  "conversation_id": "optional-session-id",
  "history": [
    { "role": "user", "content": "previous question" },
    { "role": "assistant", "content": "previous answer" }
  ]
}
```

**Response:**
```json
{
  "answer": "To add team colors to equipment in IceBones, you use the slot color tinting system...",
  "sources": [
    {
      "source_file": "docs/runtime-guide.md",
      "heading_path": "Runtime Guide > Color Tinting",
      "score": 0.91
    }
  ],
  "model": "claude-sonnet-4-20250514"
}
```

### GET /api/health

Health check. Returns database connection status and document count.

### GET /api/stats

Returns corpus statistics: total documents, chunks, average token count, last ingestion time.

## RAG Pipeline

The chat endpoint follows this flow:

```
User message
    │
    v
1. Embed the query with Voyage AI (voyage-3-lite)
    │
    v
2. Vector search: top-5 chunks by cosine similarity (threshold > 0.3)
    │
    v
3. Build prompt:
   ┌──────────────────────────────────────┐
   │ System: You are IceBones Assistant,  │
   │ an expert on the IceBones 2D         │
   │ skeletal animation editor. Answer    │
   │ questions using the documentation    │
   │ provided. If the answer isn't in the │
   │ documentation, say so.               │
   │                                      │
   │ Context from documentation:          │
   │ [chunk 1 content]                    │
   │ Source: editor-guide.md > Viewport   │
   │                                      │
   │ [chunk 2 content]                    │
   │ Source: runtime-guide.md > Skins     │
   │ ...                                  │
   ├──────────────────────────────────────┤
   │ Conversation history (if provided)   │
   ├──────────────────────────────────────┤
   │ User: How do I add team colors?      │
   └──────────────────────────────────────┘
    │
    v
4. Send to LLM (configurable provider)
    │
    v
5. Return answer + source attributions
```

## LLM Abstraction

The LLM call is behind an interface so providers are swappable:

```python
class LLMProvider(Protocol):
    async def chat(
        self,
        system: str,
        messages: list[dict],
        max_tokens: int = 1024,
    ) -> str: ...

class ClaudeProvider(LLMProvider):
    """Default: uses Anthropic API."""

class OpenAIProvider(LLMProvider):
    """Alternative: uses OpenAI API."""
```

Configuration via environment variables:
```
LLM_PROVIDER=claude          # or "openai"
ANTHROPIC_API_KEY=sk-...
OPENAI_API_KEY=sk-...
VOYAGE_API_KEY=pa-...
DATABASE_URL=postgresql://...
```

## Docker Compose (Development)

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: icebones
      POSTGRES_USER: icebones
      POSTGRES_PASSWORD: icebones
    volumes:
      - pgdata:/var/lib/postgresql/data

  api:
    build: ./packages/api
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://icebones:icebones@postgres:5432/icebones
      VOYAGE_API_KEY: ${VOYAGE_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on:
      - postgres

volumes:
  pgdata:
```

## File Structure

```
packages/api/
├── Dockerfile
├── requirements.txt
├── pyproject.toml
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app, CORS, lifespan
│   ├── config.py             # Settings from environment
│   ├── database.py           # asyncpg connection pool, pgvector setup
│   ├── models.py             # Pydantic request/response models
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── ingest.py         # POST /api/ingest
│   │   ├── search.py         # POST /api/search
│   │   ├── chat.py           # POST /api/chat
│   │   └── health.py         # GET /api/health, /api/stats
│   ├── services/
│   │   ├── __init__.py
│   │   ├── chunker.py        # Markdown parsing and chunking
│   │   ├── embeddings.py     # Voyage AI embedding client
│   │   ├── vector_store.py   # pgvector CRUD operations
│   │   └── llm.py            # LLM provider abstraction
│   └── tests/
│       ├── test_chunker.py   # Chunking logic tests
│       ├── test_search.py    # Search endpoint tests
│       └── test_ingest.py    # Ingestion pipeline tests
docker-compose.yml            # PostgreSQL + API for development
.env.example                  # Template for required env vars
```

## Verification Plan

1. **Docker setup:** `docker compose up` starts PostgreSQL with pgvector extension enabled
2. **Ingestion:** `POST /api/ingest` processes all 8 documentation files, creates ~50 chunks, returns counts
3. **Search:** `POST /api/search { "query": "how to create a bone" }` returns relevant chunks from editor-guide.md with scores > 0.5
4. **Chat:** `POST /api/chat { "message": "How do I export my animation?" }` returns a coherent answer referencing the correct documentation with source attribution
5. **Idempotency:** Running ingestion twice produces the same chunk count (upserts, not duplicates)
6. **Round-trip:** Modify a doc file, re-ingest, search for new content, verify it appears
7. **LLM swap:** Change `LLM_PROVIDER` env var, verify chat still works with different provider
