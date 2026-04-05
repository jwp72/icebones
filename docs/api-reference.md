# IceBones AI Assistant -- API Reference

## Overview

The IceBones AI Assistant is a Retrieval-Augmented Generation (RAG) API built on FastAPI. It ingests Markdown documentation, generates vector embeddings via Voyage AI, stores them in PostgreSQL with pgvector, and serves semantic search and LLM-powered chat endpoints.

**Base URL:** `http://localhost:8000/api`

**Authentication:** None. The API currently has no authentication layer. CORS is configured to allow all origins. When deploying to production, you should add authentication middleware and restrict CORS origins.

**Content Type:** All request and response bodies are `application/json`.

---

## Quick Start

### 1. Clone the repository

```bash
git clone <repo-url> icebones
cd icebones
```

### 2. Set environment variables

Copy the example env file and fill in your API keys:

```bash
cp .env.example .env
```

Edit `.env`:

```env
VOYAGE_API_KEY=pa-your-voyage-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
LLM_PROVIDER=claude
```

### 3. Start the services

```bash
docker compose up -d
```

This starts PostgreSQL (with pgvector) and the FastAPI service. The API will be available at `http://localhost:8000`.

### 4. Ingest documentation

```bash
curl -X POST http://localhost:8000/api/ingest
```

This scans the mounted `docs/` directory for Markdown files, chunks them, generates embeddings, and stores everything in the database.

### 5. Make your first query

```bash
curl -X POST http://localhost:8000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "How do I create a skeleton?"}'
```

---

## Endpoints

### GET /api/health

Check API health and database connectivity.

#### Request

No request body.

#### Response

**200 OK**

```json
{
  "status": "healthy",
  "database": "connected",
  "document_count": 42
}
```

| Field            | Type   | Description                                    |
| ---------------- | ------ | ---------------------------------------------- |
| `status`         | string | Always `"healthy"` on success                  |
| `database`       | string | Always `"connected"` on success                |
| `document_count` | int    | Total number of document chunks in the database |

**503 Service Unavailable**

```json
{
  "detail": {
    "status": "unhealthy",
    "database": "disconnected",
    "error": "connection refused"
  }
}
```

#### cURL Example

```bash
curl http://localhost:8000/api/health
```

#### TypeScript Example

```typescript
const response = await fetch('http://localhost:8000/api/health');
const data: HealthResponse = await response.json();
console.log(data.status); // "healthy"
```

---

### GET /api/stats

Return corpus statistics about the ingested documents.

#### Request

No request body.

#### Response

**200 OK**

```json
{
  "total_chunks": 42,
  "total_files": 4,
  "avg_token_count": 287.5,
  "last_ingested": "2026-04-05T12:30:00+00:00"
}
```

| Field             | Type         | Description                                            |
| ----------------- | ------------ | ------------------------------------------------------ |
| `total_chunks`    | int          | Total number of document chunks stored                 |
| `total_files`     | int          | Number of distinct source files ingested               |
| `avg_token_count` | float        | Average token count per chunk (cl100k_base encoding)   |
| `last_ingested`   | string\|null | ISO 8601 timestamp of the most recently updated chunk, or `null` if no documents exist |

**503 Service Unavailable**

```json
{
  "detail": "connection refused"
}
```

#### cURL Example

```bash
curl http://localhost:8000/api/stats
```

#### TypeScript Example

```typescript
const response = await fetch('http://localhost:8000/api/stats');
const data: StatsResponse = await response.json();
console.log(`${data.total_chunks} chunks across ${data.total_files} files`);
```

---

### POST /api/ingest

Scan a directory for Markdown (`.md`) files, split them into chunks by heading, generate vector embeddings via Voyage AI, and upsert them into the pgvector database.

Documents are chunked at `##` and `###` heading boundaries. Chunks that exceed the configured `CHUNK_MAX_TOKENS` limit (default 500) are further split at paragraph boundaries. Each chunk is embedded using the Voyage AI model specified by `EMBEDDING_MODEL` (default `voyage-3-lite`, 512 dimensions).

Chunks are upserted using a unique constraint on `(source_file, heading_path, chunk_index)`, so re-ingesting the same documents updates existing chunks rather than creating duplicates. After ingestion, the ivfflat index is rebuilt automatically.

#### Request Body

All fields are optional. Sending an empty body `{}` or no body at all is valid.

```json
{
  "docs_path": "/path/to/docs"
}
```

| Field      | Type         | Required | Default              | Description                                      |
| ---------- | ------------ | -------- | -------------------- | ------------------------------------------------ |
| `docs_path`| string\|null | No       | `DOCS_PATH` env var  | Filesystem path to scan for `.md` files. Defaults to the `DOCS_PATH` setting (which defaults to `docs/` or `/app/docs` in Docker). |

#### Response

**200 OK**

```json
{
  "files_processed": 4,
  "chunks_created": 38,
  "chunks_updated": 4,
  "total_tokens": 12500
}
```

| Field             | Type | Description                                          |
| ----------------- | ---- | ---------------------------------------------------- |
| `files_processed` | int  | Number of `.md` files that contained content         |
| `chunks_created`  | int  | Number of new chunks inserted                        |
| `chunks_updated`  | int  | Number of existing chunks updated                    |
| `total_tokens`    | int  | Total token count across all processed chunks        |

**400 Bad Request**

Returned when `docs_path` does not exist or contains no `.md` files.

```json
{
  "detail": "docs_path does not exist: /bad/path"
}
```

```json
{
  "detail": "No .md files found in: /empty/dir"
}
```

**500 Internal Server Error**

Returned when the embedding API fails or the Voyage AI key is missing/invalid.

```json
{
  "detail": "Embedding API error: 401 Unauthorized"
}
```

#### cURL Example

```bash
# Ingest from the default docs_path
curl -X POST http://localhost:8000/api/ingest

# Ingest from a custom path
curl -X POST http://localhost:8000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"docs_path": "/app/custom-docs"}'
```

#### TypeScript Example

```typescript
const response = await fetch('http://localhost:8000/api/ingest', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({}), // use defaults
});
const data: IngestResponse = await response.json();
console.log(`Processed ${data.files_processed} files, created ${data.chunks_created} chunks`);
```

---

### POST /api/search

Embed a natural-language query using Voyage AI and perform a cosine similarity search against the document vector store. Returns the top matching document chunks ranked by relevance score.

#### Request Body

```json
{
  "query": "How do I animate a bone?",
  "top_k": 5,
  "threshold": 0.3
}
```

| Field       | Type   | Required | Default | Description                                                |
| ----------- | ------ | -------- | ------- | ---------------------------------------------------------- |
| `query`     | string | **Yes**  | --      | The natural-language search query                          |
| `top_k`     | int    | No       | `5`     | Maximum number of results to return                        |
| `threshold`  | float  | No       | `0.3`   | Minimum cosine similarity score (0.0 to 1.0). Results below this score are excluded. |

#### Response

**200 OK**

```json
{
  "results": [
    {
      "content": "## Animation\n\nTo animate a bone, select it in the viewport and...",
      "source_file": "editor-guide.md",
      "heading_path": "Editor Guide > Animation",
      "score": 0.87,
      "token_count": 245
    },
    {
      "content": "### Keyframes\n\nKeyframes define the bone transforms at specific...",
      "source_file": "editor-guide.md",
      "heading_path": "Editor Guide > Animation > Keyframes",
      "score": 0.74,
      "token_count": 189
    }
  ]
}
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `results` | array | List of matching document chunks, ordered by descending score |

Each result object:

| Field         | Type   | Description                                                      |
| ------------- | ------ | ---------------------------------------------------------------- |
| `content`     | string | The full text of the matching chunk (includes heading)           |
| `source_file` | string | Relative path of the source Markdown file                        |
| `heading_path`| string | Hierarchical heading trail, e.g. `"Doc Title > Section > Subsection"` |
| `score`       | float  | Cosine similarity score (0.0 to 1.0, higher is more relevant)   |
| `token_count` | int    | Number of tokens in this chunk (cl100k_base encoding)            |

**422 Unprocessable Entity**

Returned when required fields are missing or have invalid types.

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "query"],
      "msg": "Field required"
    }
  ]
}
```

**500 Internal Server Error**

Returned when the embedding API call fails.

```json
{
  "detail": "Embedding API error: ..."
}
```

#### cURL Example

```bash
curl -X POST http://localhost:8000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How do I create a skeleton?",
    "top_k": 3,
    "threshold": 0.4
  }'
```

#### TypeScript Example

```typescript
const response = await fetch('http://localhost:8000/api/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'How do I create a skeleton?',
    top_k: 3,
    threshold: 0.4,
  }),
});
const data: SearchResponse = await response.json();
data.results.forEach(r => {
  console.log(`[${r.score.toFixed(2)}] ${r.heading_path}`);
});
```

---

### POST /api/chat

Full RAG chat endpoint. Embeds the user's message, retrieves relevant documentation via vector search, constructs a system prompt with the retrieved context, and calls the configured LLM to generate a grounded answer. Supports multi-turn conversation via the `history` field.

The LLM is instructed to answer using only the retrieved documentation context and to say so honestly if the answer is not found in the provided docs.

#### Request Body

```json
{
  "message": "How do I export an animation as a sprite sheet?",
  "conversation_id": "conv-abc123",
  "history": [
    {
      "role": "user",
      "content": "What file formats does IceBones support?"
    },
    {
      "role": "assistant",
      "content": "IceBones uses a JSON-based format for skeletons and animations..."
    }
  ]
}
```

| Field             | Type         | Required | Default | Description                                                 |
| ----------------- | ------------ | -------- | ------- | ----------------------------------------------------------- |
| `message`         | string       | **Yes**  | --      | The user's current message/question                         |
| `conversation_id` | string\|null | No       | `null`  | Optional identifier for the conversation (for future use)   |
| `history`         | array        | No       | `[]`    | Previous conversation messages for multi-turn context       |

Each `history` message:

| Field     | Type   | Required | Description                              |
| --------- | ------ | -------- | ---------------------------------------- |
| `role`    | string | **Yes**  | Either `"user"` or `"assistant"`         |
| `content` | string | **Yes**  | The message text                         |

#### Response

**200 OK**

```json
{
  "answer": "To export an animation as a sprite sheet, open the Export panel...",
  "sources": [
    {
      "source_file": "editor-guide.md",
      "heading_path": "Editor Guide > Export > Sprite Sheets",
      "score": 0.91
    },
    {
      "source_file": "getting-started.md",
      "heading_path": "Getting Started > Exporting",
      "score": 0.72
    }
  ],
  "model": "claude-sonnet-4-20250514"
}
```

| Field     | Type   | Description                                      |
| --------- | ------ | ------------------------------------------------ |
| `answer`  | string | The LLM-generated answer grounded in documentation |
| `sources` | array  | Document chunks used as context, ordered by relevance |
| `model`   | string | The LLM model that generated the answer          |

Each source object:

| Field         | Type   | Description                                                  |
| ------------- | ------ | ------------------------------------------------------------ |
| `source_file` | string | Relative path of the source Markdown file                    |
| `heading_path`| string | Hierarchical heading trail                                   |
| `score`       | float  | Cosine similarity score of this chunk to the user's message  |

**422 Unprocessable Entity**

Returned when the `message` field is missing.

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "message"],
      "msg": "Field required"
    }
  ]
}
```

**500 Internal Server Error**

Returned when the embedding API or LLM API call fails.

```json
{
  "detail": "LLM API error: 401 Unauthorized"
}
```

#### cURL Example

```bash
# Simple question (no history)
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I create a skeleton?"
  }'

# Multi-turn conversation
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I add bones to it?",
    "history": [
      {"role": "user", "content": "How do I create a skeleton?"},
      {"role": "assistant", "content": "To create a skeleton in IceBones..."}
    ]
  }'
```

#### TypeScript Example

```typescript
const response = await fetch('http://localhost:8000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'How do I create a skeleton?',
    history: [],
  }),
});
const data: ChatResponse = await response.json();
console.log(data.answer);
console.log(`Model: ${data.model}`);
data.sources.forEach(s => {
  console.log(`  Source: ${s.source_file} (${s.score.toFixed(2)})`);
});
```

---

## Configuration

All settings are configurable via environment variables. The API uses Pydantic Settings, which reads from a `.env` file or the process environment.

| Variable               | Type   | Default                                                    | Description                                                  |
| ---------------------- | ------ | ---------------------------------------------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`         | string | `postgresql://icebones:icebones@localhost:5432/icebones`   | PostgreSQL connection string (must have pgvector extension)   |
| `VOYAGE_API_KEY`       | string | `""` (empty)                                               | **Required.** Voyage AI API key for generating embeddings    |
| `ANTHROPIC_API_KEY`    | string | `""` (empty)                                               | Anthropic API key. **Required if `LLM_PROVIDER=claude`.**    |
| `OPENAI_API_KEY`       | string | `""` (empty)                                               | OpenAI API key. **Required if `LLM_PROVIDER=openai`.**       |
| `LLM_PROVIDER`         | string | `"claude"`                                                 | LLM provider for the chat endpoint. `"claude"` or `"openai"` |
| `DOCS_PATH`            | string | `"docs/"`                                                  | Filesystem path to Markdown documentation for ingestion      |
| `EMBEDDING_MODEL`      | string | `"voyage-3-lite"`                                          | Voyage AI embedding model name                               |
| `EMBEDDING_DIMENSIONS` | int    | `512`                                                      | Embedding vector dimensions (must match the model)           |
| `CHUNK_MAX_TOKENS`     | int    | `500`                                                      | Maximum token count per document chunk                       |
| `SEARCH_TOP_K`         | int    | `5`                                                        | Default number of results for chat endpoint vector search    |
| `SEARCH_THRESHOLD`     | float  | `0.3`                                                      | Default minimum similarity score for chat endpoint search    |

---

## Data Flow

### Ingestion Pipeline

```
Markdown files on disk
    |
    v
[1. File Scanner] -- walks docs_path, finds all *.md files
    |
    v
[2. Chunker] -- splits each file at ## and ### headings
    |           -- oversized chunks are further split at paragraph boundaries
    |           -- each chunk records: content, source_file, heading_path, chunk_index, token_count
    |
    v
[3. Embedding Service] -- sends chunk text to Voyage AI (voyage-3-lite)
    |                    -- batches of 20 texts per API call
    |                    -- returns 512-dimensional float vectors
    |
    v
[4. Vector Store] -- upserts into PostgreSQL `documents` table
    |              -- unique key: (source_file, heading_path, chunk_index)
    |              -- existing chunks are updated, new chunks are inserted
    |
    v
[5. Index Builder] -- rebuilds ivfflat index with lists = sqrt(N)
```

### Search Pipeline

```
User query (string)
    |
    v
[1. Embedding Service] -- embeds query via Voyage AI -> 512-dim vector
    |
    v
[2. Vector Store] -- cosine similarity search against documents table
    |              -- filters by threshold, returns top_k results
    |
    v
[3. Response] -- returns ranked list of (content, source_file, heading_path, score, token_count)
```

### Chat (RAG) Pipeline

```
User message + optional conversation history
    |
    v
[1. Embedding Service] -- embeds user message -> 512-dim vector
    |
    v
[2. Vector Store] -- retrieves top_k relevant chunks (default 5, threshold 0.3)
    |
    v
[3. Context Builder] -- formats retrieved chunks into a documentation context string
    |                  -- each chunk includes its source attribution
    |
    v
[4. Prompt Assembly] -- builds system prompt with IceBones persona + documentation context
    |                  -- appends conversation history + current message as user messages
    |
    v
[5. LLM Call] -- sends to Claude (claude-sonnet-4-20250514) or GPT-4o
    |           -- max_tokens: 1024
    |
    v
[6. Response] -- returns (answer, sources, model)
```

---

## Integration Guide

### Angular Service

Create an Angular service to interact with the IceBones API. The following example includes typed interfaces that match the API models.

#### TypeScript Interfaces

```typescript
// icebones.models.ts

export interface HealthResponse {
  status: string;
  database: string;
  document_count: number;
}

export interface StatsResponse {
  total_chunks: number;
  total_files: number;
  avg_token_count: number;
  last_ingested: string | null;
}

export interface IngestRequest {
  docs_path?: string;
}

export interface IngestResponse {
  files_processed: number;
  chunks_created: number;
  chunks_updated: number;
  total_tokens: number;
}

export interface SearchRequest {
  query: string;
  top_k?: number;
  threshold?: number;
}

export interface SearchResult {
  content: string;
  source_file: string;
  heading_path: string;
  score: number;
  token_count: number;
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
  history?: ChatMessage[];
}

export interface ChatSource {
  source_file: string;
  heading_path: string;
  score: number;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  model: string;
}
```

#### Angular Service

```typescript
// icebones.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  HealthResponse,
  StatsResponse,
  IngestResponse,
  SearchRequest,
  SearchResponse,
  ChatRequest,
  ChatResponse,
} from './icebones.models';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class IceBonesService {
  private baseUrl = environment.iceBonesApiUrl; // e.g. 'http://localhost:8000/api'

  constructor(private http: HttpClient) {}

  getHealth(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.baseUrl}/health`);
  }

  getStats(): Observable<StatsResponse> {
    return this.http.get<StatsResponse>(`${this.baseUrl}/stats`);
  }

  ingest(docsPath?: string): Observable<IngestResponse> {
    const body = docsPath ? { docs_path: docsPath } : {};
    return this.http.post<IngestResponse>(`${this.baseUrl}/ingest`, body);
  }

  search(query: string, topK = 5, threshold = 0.3): Observable<SearchResponse> {
    const body: SearchRequest = { query, top_k: topK, threshold };
    return this.http.post<SearchResponse>(`${this.baseUrl}/search`, body);
  }

  chat(message: string, history: { role: string; content: string }[] = []): Observable<ChatResponse> {
    const body: ChatRequest = { message, history };
    return this.http.post<ChatResponse>(`${this.baseUrl}/chat`, body);
  }
}
```

#### Example Component Usage

```typescript
// ask-icebones.component.ts

import { Component } from '@angular/core';
import { IceBonesService } from '../services/icebones.service';
import { ChatMessage, ChatResponse } from '../services/icebones.models';

@Component({
  selector: 'app-ask-icebones',
  template: `
    <div class="chat-container">
      <div *ngFor="let msg of messages" [class]="msg.role">
        {{ msg.content }}
      </div>
      <input [(ngModel)]="userInput" (keyup.enter)="send()" placeholder="Ask IceBones..." />
      <button (click)="send()" [disabled]="loading">Send</button>
    </div>
  `,
})
export class AskIceBonesComponent {
  messages: ChatMessage[] = [];
  userInput = '';
  loading = false;

  constructor(private icebones: IceBonesService) {}

  send(): void {
    if (!this.userInput.trim() || this.loading) return;

    const userMessage = this.userInput;
    this.messages.push({ role: 'user', content: userMessage });
    this.userInput = '';
    this.loading = true;

    this.icebones.chat(userMessage, this.messages.slice(0, -1)).subscribe({
      next: (response: ChatResponse) => {
        this.messages.push({ role: 'assistant', content: response.answer });
        this.loading = false;
      },
      error: (err) => {
        console.error('IceBones chat error:', err);
        this.loading = false;
      },
    });
  }
}
```

---

## Error Handling

### HTTP Status Codes

| Status | Meaning                    | When                                                        |
| ------ | -------------------------- | ----------------------------------------------------------- |
| 200    | OK                         | Request succeeded                                           |
| 400    | Bad Request                | Invalid `docs_path` or no `.md` files found during ingest   |
| 422    | Unprocessable Entity       | Request body validation failed (missing required fields, wrong types) |
| 500    | Internal Server Error      | Embedding API failure, LLM API failure, or missing API keys |
| 503    | Service Unavailable        | Database is unreachable (health and stats endpoints)        |

### Error Response Format

FastAPI uses two error response formats:

**Application errors** (raised via `HTTPException`):

```json
{
  "detail": "Human-readable error message"
}
```

**Validation errors** (Pydantic):

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "query"],
      "msg": "Field required",
      "input": {}
    }
  ]
}
```

### Handling Errors in TypeScript

```typescript
async function callIceBones<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    const error = await response.json();
    const message = typeof error.detail === 'string'
      ? error.detail
      : JSON.stringify(error.detail);
    throw new Error(`IceBones API error (${response.status}): ${message}`);
  }

  return response.json();
}
```

---

## Rate Limits and Performance

### External API Costs

The IceBones API calls two external services that have associated costs:

**Voyage AI (Embeddings)**
- Used by: `/api/ingest`, `/api/search`, `/api/chat`
- Model: `voyage-3-lite` (512 dimensions)
- Cost: See [Voyage AI pricing](https://www.voyageai.com/pricing)
- Ingestion batches 20 texts per API call to minimize round trips
- Each search or chat request makes exactly 1 embedding API call (for the query)

**Anthropic Claude / OpenAI GPT**
- Used by: `/api/chat` only
- Default model: `claude-sonnet-4-20250514` (Anthropic) or `gpt-4o` (OpenAI)
- Max tokens per response: 1024
- Cost: See provider pricing pages

### Expected Latencies

| Endpoint        | Typical Latency | Notes                                           |
| --------------- | --------------- | ----------------------------------------------- |
| `GET /health`   | < 50ms          | Single database query                            |
| `GET /stats`    | < 50ms          | Single aggregate query                           |
| `POST /ingest`  | 10-60s          | Depends on number of files; embedding API calls dominate |
| `POST /search`  | 200-500ms       | 1 embedding call + 1 database query              |
| `POST /chat`    | 2-8s            | 1 embedding call + 1 database query + 1 LLM call |

### Recommendations

- **Cache search results** on the frontend for repeated queries within a session.
- **Debounce** search input if implementing search-as-you-type; the embedding API is called on every request.
- **Limit `top_k`** to what you actually display. Fewer results means less context sent to the LLM.
- **Use `threshold`** to filter low-relevance results. A threshold of `0.4` or higher produces more precise results at the cost of recall.
- **Batch ingestion** happens automatically (20 chunks per embedding API call). Re-ingest only when documentation changes.
- **Monitor token usage** via the `/api/stats` endpoint's `avg_token_count` field and the ingest response's `total_tokens` field.
