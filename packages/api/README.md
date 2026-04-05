# IceBones AI Assistant API

A Retrieval-Augmented Generation (RAG) API for the IceBones documentation. Built with FastAPI, pgvector, Voyage AI embeddings, and Claude/GPT for chat. Ingests Markdown documentation, chunks it by heading structure, generates vector embeddings, and serves semantic search and LLM-powered chat endpoints.

## Quick Start

1. **Clone and configure:**

   ```bash
   git clone <repo-url> icebones
   cd icebones
   cp .env.example .env
   # Edit .env with your VOYAGE_API_KEY and ANTHROPIC_API_KEY
   ```

2. **Start services:**

   ```bash
   docker compose up -d
   ```

3. **Ingest documentation:**

   ```bash
   curl -X POST http://localhost:8000/api/ingest
   ```

4. **Query:**

   ```bash
   curl -X POST http://localhost:8000/api/search \
     -H "Content-Type: application/json" \
     -d '{"query": "How do I create a skeleton?"}'
   ```

## API Endpoints

| Method | Path          | Description                                    |
| ------ | ------------- | ---------------------------------------------- |
| GET    | `/api/health` | Health check -- API and database status        |
| GET    | `/api/stats`  | Corpus statistics (chunk count, file count, etc.) |
| POST   | `/api/ingest` | Ingest Markdown files into the vector store    |
| POST   | `/api/search` | Semantic similarity search over documents      |
| POST   | `/api/chat`   | RAG chat -- search + LLM-generated answer      |

## Configuration

| Variable             | Default          | Description                                    |
| -------------------- | ---------------- | ---------------------------------------------- |
| `DATABASE_URL`       | `postgresql://icebones:icebones@localhost:5432/icebones` | PostgreSQL connection string |
| `VOYAGE_API_KEY`     | (required)       | Voyage AI API key for embeddings               |
| `ANTHROPIC_API_KEY`  | (required if claude) | Anthropic API key for chat                 |
| `OPENAI_API_KEY`     | (optional)       | OpenAI API key for chat                        |
| `LLM_PROVIDER`       | `claude`         | LLM provider: `claude` or `openai`             |
| `DOCS_PATH`          | `docs/`          | Path to Markdown documentation                 |
| `EMBEDDING_MODEL`    | `voyage-3-lite`  | Voyage AI embedding model                      |
| `EMBEDDING_DIMENSIONS` | `512`          | Vector dimensions (must match model)           |
| `CHUNK_MAX_TOKENS`   | `500`            | Max tokens per document chunk                  |
| `SEARCH_TOP_K`       | `5`              | Default top-K for chat vector search           |
| `SEARCH_THRESHOLD`   | `0.3`            | Default similarity threshold for chat search   |

## Development

### Running Without Docker

Requires Python 3.12+ and a PostgreSQL instance with pgvector.

```bash
cd packages/api
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

Set environment variables (or create a `.env` file in `packages/api/`):

```bash
export DATABASE_URL=postgresql://icebones:icebones@localhost:5432/icebones
export VOYAGE_API_KEY=pa-your-key
export ANTHROPIC_API_KEY=sk-ant-your-key
```

Start the server:

```bash
uvicorn app.main:app --reload --port 8000
```

### Running Tests

```bash
cd packages/api
pytest
```

### Project Structure

```
packages/api/
  app/
    main.py           # FastAPI app, CORS, router registration
    config.py          # Pydantic Settings (env vars)
    database.py        # asyncpg pool, schema creation
    models.py          # Request/response Pydantic models
    routers/
      health.py        # GET /api/health, GET /api/stats
      ingest.py        # POST /api/ingest
      search.py        # POST /api/search
      chat.py          # POST /api/chat
    services/
      chunker.py       # Markdown heading-based chunking
      embeddings.py    # Voyage AI embedding client
      llm.py           # Claude / OpenAI LLM providers
      vector_store.py  # pgvector upsert, search, stats
  Dockerfile
  requirements.txt
```

## Full Documentation

- [API Reference](../../docs/api-reference.md) -- complete endpoint documentation with examples
- [Deployment Guide](../../docs/deployment-guide.md) -- deployment, operations, and troubleshooting
