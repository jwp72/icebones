import os
import logging

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.database import get_pool
from app.models import IngestRequest, IngestResponse
from app.services.chunker import chunk_markdown
from app.services.embeddings import EmbeddingService
from app.services.vector_store import VectorStore

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ingest"])

EMBED_BATCH_SIZE = 20  # Max texts per Voyage API call


@router.post("/ingest", response_model=IngestResponse)
async def ingest_documents(request: IngestRequest = IngestRequest()):
    """Scan docs_path for .md files, chunk, embed, and upsert into pgvector."""
    docs_path = request.docs_path or settings.docs_path

    if not os.path.isdir(docs_path):
        raise HTTPException(
            status_code=400, detail=f"docs_path does not exist: {docs_path}"
        )

    # Collect all markdown files
    md_files: list[str] = []
    for root, _dirs, files in os.walk(docs_path):
        for fname in sorted(files):
            if fname.endswith(".md"):
                md_files.append(os.path.join(root, fname))

    if not md_files:
        raise HTTPException(
            status_code=400, detail=f"No .md files found in: {docs_path}"
        )

    # Initialize services
    try:
        embedding_service = EmbeddingService(
            api_key=settings.voyage_api_key, model=settings.embedding_model
        )
    except (RuntimeError, ValueError) as e:
        raise HTTPException(status_code=500, detail=str(e))

    pool = get_pool()
    store = VectorStore(pool)

    files_processed = 0
    chunks_created = 0
    chunks_updated = 0
    total_tokens = 0

    for filepath in md_files:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        # Use relative path from docs_path as source_file
        source_file = os.path.relpath(filepath, docs_path).replace("\\", "/")

        chunks = chunk_markdown(
            content, source_file, max_tokens=settings.chunk_max_tokens
        )

        if not chunks:
            continue

        files_processed += 1

        # Embed in batches
        for batch_start in range(0, len(chunks), EMBED_BATCH_SIZE):
            batch = chunks[batch_start : batch_start + EMBED_BATCH_SIZE]
            texts = [c["content"] for c in batch]

            try:
                embeddings = await embedding_service.embed_batch(texts)
            except Exception as e:
                logger.error(f"Embedding failed for batch in {source_file}: {e}")
                raise HTTPException(
                    status_code=500, detail=f"Embedding API error: {e}"
                )

            for chunk, emb in zip(batch, embeddings):
                is_new = await store.upsert_chunk(chunk, emb)
                if is_new:
                    chunks_created += 1
                else:
                    chunks_updated += 1
                total_tokens += chunk["token_count"]

    # Build/rebuild the ivfflat index after ingestion
    await store.ensure_index()

    logger.info(
        f"Ingestion complete: {files_processed} files, "
        f"{chunks_created} created, {chunks_updated} updated, "
        f"{total_tokens} tokens"
    )

    return IngestResponse(
        files_processed=files_processed,
        chunks_created=chunks_created,
        chunks_updated=chunks_updated,
        total_tokens=total_tokens,
    )
