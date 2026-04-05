from fastapi import APIRouter, HTTPException

from app.database import get_pool
from app.models import HealthResponse, StatsResponse
from app.services.vector_store import VectorStore

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Check API health and database connectivity."""
    try:
        pool = get_pool()
        store = VectorStore(pool)
        count = await store.get_count()
        return HealthResponse(
            status="healthy",
            database="connected",
            document_count=count,
        )
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={"status": "unhealthy", "database": "disconnected", "error": str(e)},
        )


@router.get("/stats", response_model=StatsResponse)
async def get_stats():
    """Return corpus statistics."""
    try:
        pool = get_pool()
        store = VectorStore(pool)
        stats = await store.get_stats()
        return StatsResponse(**stats)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
