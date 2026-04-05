from fastapi import APIRouter, HTTPException

from app.config import settings
from app.database import get_pool
from app.models import SearchRequest, SearchResponse, SearchResult
from app.services.embeddings import EmbeddingService
from app.services.vector_store import VectorStore

router = APIRouter(tags=["search"])


@router.post("/search", response_model=SearchResponse)
async def semantic_search(request: SearchRequest):
    """Embed query and perform vector similarity search."""
    try:
        embedding_service = EmbeddingService(
            api_key=settings.voyage_api_key, model=settings.embedding_model
        )
    except (RuntimeError, ValueError) as e:
        raise HTTPException(status_code=500, detail=str(e))

    pool = get_pool()
    store = VectorStore(pool)

    # Embed the query
    try:
        query_embedding = await embedding_service.embed_text(request.query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding API error: {e}")

    # Search
    results = await store.search(
        embedding=query_embedding,
        top_k=request.top_k,
        threshold=request.threshold,
    )

    return SearchResponse(
        results=[
            SearchResult(
                content=r["content"],
                source_file=r["source_file"],
                heading_path=r["heading_path"],
                score=r["score"],
                token_count=r["token_count"],
            )
            for r in results
        ]
    )
