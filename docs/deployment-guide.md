# IceBones AI Assistant -- Deployment and Operations Guide

## Local Development

### Prerequisites

- Docker and Docker Compose
- A Voyage AI API key (required for all embedding operations)
- An Anthropic or OpenAI API key (required for the chat endpoint)

### Step-by-Step Setup

1. **Clone the repository:**

   ```bash
   git clone <repo-url> icebones
   cd icebones
   ```

2. **Create your `.env` file:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your API keys:

   ```env
   VOYAGE_API_KEY=pa-your-voyage-key
   ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
   LLM_PROVIDER=claude
   ```

3. **Start services:**

   ```bash
   docker compose up -d
   ```

   This starts two services:
   - **postgres** -- PostgreSQL 16 with pgvector extension on port 5432
   - **api** -- FastAPI application on port 8000

4. **Wait for health check:**

   ```bash
   curl http://localhost:8000/api/health
   ```

   Expected response: `{"status":"healthy","database":"connected","document_count":0}`

5. **Ingest documentation:**

   ```bash
   curl -X POST http://localhost:8000/api/ingest
   ```

6. **Verify ingestion:**

   ```bash
   curl http://localhost:8000/api/stats
   ```

### Stopping Services

```bash
docker compose down        # Stop services, keep data
docker compose down -v     # Stop services and delete database volume
```

### Viewing Logs

```bash
docker compose logs -f api       # API logs
docker compose logs -f postgres  # Database logs
```

### Rebuilding After Code Changes

```bash
docker compose up -d --build api
```

---

## Environment Variables

| Variable               | Required | Default                                                  | Description                                                  |
| ---------------------- | -------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`         | No       | `postgresql://icebones:icebones@localhost:5432/icebones` | PostgreSQL connection string. Docker Compose overrides this to `postgresql://icebones:icebones@postgres:5432/icebones`. |
| `VOYAGE_API_KEY`       | **Yes**  | --                                                       | Voyage AI API key for generating embeddings. Required for ingest, search, and chat. |
| `ANTHROPIC_API_KEY`    | Conditional | --                                                    | Required when `LLM_PROVIDER=claude`. Used by the chat endpoint. |
| `OPENAI_API_KEY`       | Conditional | --                                                    | Required when `LLM_PROVIDER=openai`. Used by the chat endpoint. |
| `LLM_PROVIDER`         | No       | `claude`                                                 | Which LLM to use for chat. Options: `claude`, `openai`.      |
| `DOCS_PATH`            | No       | `docs/`                                                  | Path to Markdown documentation directory. Docker Compose sets this to `/app/docs`. |
| `EMBEDDING_MODEL`      | No       | `voyage-3-lite`                                          | Voyage AI model for embeddings. Changing this requires re-ingesting all documents. |
| `EMBEDDING_DIMENSIONS` | No       | `512`                                                    | Vector dimensions. Must match the embedding model output size. |
| `CHUNK_MAX_TOKENS`     | No       | `500`                                                    | Maximum token count per chunk. Uses cl100k_base tokenizer.   |
| `SEARCH_TOP_K`         | No       | `5`                                                      | Default top-K for the chat endpoint's internal vector search. |
| `SEARCH_THRESHOLD`     | No       | `0.3`                                                    | Default minimum similarity threshold for the chat endpoint's internal vector search. |

---

## Database

### PostgreSQL with pgvector

The API uses PostgreSQL 16 with the pgvector extension for vector similarity search. The Docker Compose setup uses the `pgvector/pgvector:pg16` image, which has the extension pre-installed.

### Schema

The schema is created automatically on startup via the `init_pool()` function. It consists of a single table:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
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

CREATE INDEX IF NOT EXISTS idx_documents_source ON documents (source_file);

ALTER TABLE documents
  ADD CONSTRAINT uq_documents_source_heading_chunk
  UNIQUE (source_file, heading_path, chunk_index);
```

### Columns

| Column         | Type                     | Description                                             |
| -------------- | ------------------------ | ------------------------------------------------------- |
| `id`           | `SERIAL PRIMARY KEY`     | Auto-incrementing primary key                           |
| `content`      | `TEXT`                   | Full text of the document chunk                         |
| `source_file`  | `VARCHAR(255)`           | Relative path of the source Markdown file               |
| `heading_path` | `VARCHAR(500)`           | Heading breadcrumb, e.g. `"Doc Title > Section > Sub"`  |
| `chunk_index`  | `INTEGER`                | Sub-chunk index within a section (0 if not split)       |
| `token_count`  | `INTEGER`                | Token count using cl100k_base encoding                  |
| `embedding`    | `vector(512)`            | 512-dimensional float vector from Voyage AI             |
| `metadata`     | `JSONB`                  | Reserved for future use (default `{}`)                  |
| `created_at`   | `TIMESTAMP WITH TIME ZONE` | Row creation timestamp                               |
| `updated_at`   | `TIMESTAMP WITH TIME ZONE` | Last update timestamp (updated on re-ingestion)      |

### Indexes

| Index Name                  | Type      | Columns                                         | Notes                                        |
| --------------------------- | --------- | ----------------------------------------------- | -------------------------------------------- |
| `documents_pkey`            | B-tree    | `id`                                            | Primary key                                  |
| `idx_documents_source`      | B-tree    | `source_file`                                   | Fast lookups by source file                  |
| `uq_documents_source_heading_chunk` | B-tree (unique) | `(source_file, heading_path, chunk_index)` | Enables upsert behavior during ingestion     |
| `idx_documents_embedding`   | ivfflat   | `embedding` (cosine ops)                        | ANN index for vector search. Rebuilt after each ingestion with `lists = sqrt(N)`. |

### Connecting Directly

```bash
# From host while Docker Compose is running
psql postgresql://icebones:icebones@localhost:5432/icebones

# Useful queries
SELECT COUNT(*) FROM documents;
SELECT DISTINCT source_file FROM documents;
SELECT source_file, heading_path, token_count FROM documents ORDER BY source_file, heading_path;
```

---

## Docker Compose

### Service Architecture

```
docker-compose.yml
|
+-- postgres (pgvector/pgvector:pg16)
|     Port: 5432
|     Volume: pgdata (persistent)
|     Health check: pg_isready every 5s
|
+-- api (./packages/api)
      Port: 8000
      Depends on: postgres (healthy)
      Volumes: docs mounted read-only
```

### Services

**postgres**

- Image: `pgvector/pgvector:pg16`
- Port: `5432:5432`
- Credentials: `icebones` / `icebones` / database `icebones`
- Volume: `pgdata` persists data across restarts
- Health check: `pg_isready -U icebones` every 5 seconds (5 retries)

**api**

- Build context: `./packages/api`
- Port: `8000:8000`
- Runtime: Python 3.12, Uvicorn ASGI server
- Environment variables are passed through from the host `.env` file
- Depends on `postgres` being healthy before starting

### Mounted Volumes

The API container mounts documentation files as read-only volumes:

| Host Path                         | Container Path                          | Purpose                   |
| --------------------------------- | --------------------------------------- | ------------------------- |
| `./docs/`                         | `/app/docs/`                            | Main documentation folder |
| `./packages/core/README.md`       | `/app/docs/packages-core-readme.md`     | Core package README       |
| `./packages/pixi/README.md`       | `/app/docs/packages-pixi-readme.md`     | Pixi package README       |
| `./packages/editor/README.md`     | `/app/docs/packages-editor-readme.md`   | Editor package README     |
| `./README.md`                     | `/app/docs/project-readme.md`           | Project root README       |

All documentation is mounted read-only (`:ro`). The API reads these files during ingestion but never writes to them.

---

## Production Deployment

### Database Options

For production, use a managed PostgreSQL service with pgvector support:

| Provider   | pgvector Support | Notes                                      |
| ---------- | ---------------- | ------------------------------------------ |
| **Supabase** | Built-in       | Free tier available. Enable pgvector via SQL: `CREATE EXTENSION vector;` |
| **Neon**     | Built-in       | Serverless PostgreSQL. pgvector available on all plans. |
| **Railway**  | Via template   | Use the PostgreSQL + pgvector template.    |
| **AWS RDS**  | Manual install | Available on RDS for PostgreSQL 15+.       |

Set `DATABASE_URL` to the managed database connection string.

### API Deployment Options

The FastAPI application can be deployed as a container or directly:

**Railway / Render / Fly.io**

1. Push the repo to GitHub.
2. Connect the repo to the platform.
3. Set the build context to `packages/api/`.
4. Set environment variables (`VOYAGE_API_KEY`, `ANTHROPIC_API_KEY`, `DATABASE_URL`, `LLM_PROVIDER`, `DOCS_PATH`).
5. Deploy.

**Google Cloud Run**

```bash
# Build and push
gcloud builds submit --tag gcr.io/PROJECT/icebones-api packages/api/

# Deploy
gcloud run deploy icebones-api \
  --image gcr.io/PROJECT/icebones-api \
  --port 8000 \
  --set-env-vars "DATABASE_URL=...,VOYAGE_API_KEY=...,ANTHROPIC_API_KEY=..." \
  --allow-unauthenticated
```

**Self-hosted (Uvicorn)**

```bash
cd packages/api
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### CORS Configuration

The API currently allows all origins (`allow_origins=["*"]`). For production, modify `packages/api/app/main.py` to restrict origins:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://your-hockeyquest-domain.com",
        "http://localhost:4200",  # Angular dev server
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Documentation Ingestion in Production

In production, documentation files are not automatically available in the container filesystem. You have two options:

1. **Mount at build time** -- COPY docs into the Docker image and set `DOCS_PATH` accordingly.
2. **Upload via API** -- Use the `POST /api/ingest` endpoint with a `docs_path` pointing to a directory accessible by the API container.

For option 1, add to the Dockerfile:

```dockerfile
COPY ../../docs/ ./docs/
ENV DOCS_PATH=/app/docs
```

Then trigger ingestion after deployment:

```bash
curl -X POST https://your-api-host/api/ingest
```

---

## Monitoring

### Health Endpoint

Poll `GET /api/health` to check that the API is running and the database is reachable.

```bash
# Simple uptime check
curl -s http://localhost:8000/api/health | jq .status
# Returns: "healthy"
```

A `503` response indicates the database is unreachable.

### Stats Endpoint

Use `GET /api/stats` to monitor the document corpus:

```bash
curl -s http://localhost:8000/api/stats | jq .
```

**What to watch:**

| Metric           | Healthy Sign                           | Action if Unhealthy                      |
| ---------------- | -------------------------------------- | ---------------------------------------- |
| `total_chunks`   | > 0 after ingestion                    | Re-run ingestion                         |
| `total_files`    | Matches expected number of doc files   | Check mounted volumes                    |
| `avg_token_count`| 100--400 range                         | Adjust `CHUNK_MAX_TOKENS` if too high/low |
| `last_ingested`  | Recent timestamp                       | Re-run ingestion if stale                |

### Application Logs

The API logs to stdout using Python's `logging` module at `INFO` level. Key log events:

- `Starting up -- initializing database pool...` -- API is starting
- `Database pool ready.` -- Startup complete
- `Ingestion complete: X files, Y created, Z updated, N tokens` -- Ingestion finished
- `Shutting down -- closing database pool...` -- Graceful shutdown

---

## Updating Documentation

When the source Markdown documentation changes, re-ingest to update the vector store:

```bash
curl -X POST http://localhost:8000/api/ingest
```

The ingestion process is idempotent:

- Existing chunks (matched by `source_file + heading_path + chunk_index`) are updated with new content and embeddings.
- New chunks are inserted.
- The ivfflat index is rebuilt after ingestion.

**Note:** Ingestion does not delete chunks for sections that have been removed from the documentation. If you significantly restructure the docs, consider clearing the database first:

```bash
# Connect to the database and truncate
psql postgresql://icebones:icebones@localhost:5432/icebones -c "TRUNCATE documents RESTART IDENTITY;"

# Then re-ingest
curl -X POST http://localhost:8000/api/ingest
```

---

## Troubleshooting

### API won't start -- "Database pool is not initialized"

**Cause:** The API started before PostgreSQL was ready.

**Fix:** Ensure the `depends_on` health check is in place in `docker-compose.yml`. If running outside Docker, wait for PostgreSQL to be ready before starting the API.

```bash
# Check if PostgreSQL is accepting connections
pg_isready -h localhost -p 5432 -U icebones
```

### Ingestion returns 400 -- "docs_path does not exist"

**Cause:** The `DOCS_PATH` environment variable or the `docs_path` request field points to a nonexistent directory.

**Fix:**
- Check that the `docs/` directory is mounted correctly in Docker Compose.
- Verify with: `docker compose exec api ls /app/docs/`

### Ingestion returns 500 -- "Embedding API error"

**Cause:** The Voyage AI API key is missing, invalid, or the service is unavailable.

**Fix:**
- Verify `VOYAGE_API_KEY` is set: `docker compose exec api env | grep VOYAGE`
- Test the key outside the app: `curl -H "Authorization: Bearer $VOYAGE_API_KEY" https://api.voyageai.com/v1/embeddings`

### Chat returns 500 -- "LLM API error"

**Cause:** The LLM provider API key is missing or invalid.

**Fix:**
- Check which provider is configured: `echo $LLM_PROVIDER`
- If `claude`: verify `ANTHROPIC_API_KEY` is set.
- If `openai`: verify `OPENAI_API_KEY` is set.

### Search returns empty results

**Cause:** No documents have been ingested, or the similarity threshold is too high.

**Fix:**
1. Check stats: `curl http://localhost:8000/api/stats` -- if `total_chunks` is 0, run ingestion.
2. Lower the `threshold` in your search request (try `0.1` or `0.0`).
3. Verify the query is related to the ingested documentation content.

### Database connection refused

**Cause:** PostgreSQL is not running or the `DATABASE_URL` is incorrect.

**Fix:**
- Check if the postgres container is running: `docker compose ps`
- Check postgres logs: `docker compose logs postgres`
- Verify the connection string in your `.env` file.

### High latency on chat endpoint

**Cause:** LLM API response times vary based on load and response length.

**Recommendations:**
- Use `claude-sonnet-4-20250514` (default) rather than larger models.
- Reduce `SEARCH_TOP_K` to send less context to the LLM.
- Consider implementing response streaming (not currently supported by the API).

### pgvector extension not available

**Cause:** Using a PostgreSQL instance without pgvector installed.

**Fix:**
- For Docker: use the `pgvector/pgvector:pg16` image.
- For managed PostgreSQL: check provider documentation for enabling pgvector.
- For self-hosted: install pgvector following the [pgvector README](https://github.com/pgvector/pgvector).
