from pydantic import BaseModel


# --- Ingest ---

class IngestRequest(BaseModel):
    docs_path: str | None = None  # defaults to settings.docs_path


class IngestResponse(BaseModel):
    files_processed: int
    chunks_created: int
    chunks_updated: int
    total_tokens: int


# --- Search ---

class SearchRequest(BaseModel):
    query: str
    top_k: int = 5
    threshold: float = 0.3


class SearchResult(BaseModel):
    content: str
    source_file: str
    heading_path: str
    score: float
    token_count: int


class SearchResponse(BaseModel):
    results: list[SearchResult]


# --- Chat ---

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    history: list[ChatMessage] = []


class ChatSource(BaseModel):
    source_file: str
    heading_path: str
    score: float


class ChatResponse(BaseModel):
    answer: str
    sources: list[ChatSource]
    model: str


# --- Health / Stats ---

class HealthResponse(BaseModel):
    status: str
    database: str
    document_count: int


class StatsResponse(BaseModel):
    total_chunks: int
    total_files: int
    avg_token_count: float
    last_ingested: str | None
