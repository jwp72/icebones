import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_pool, close_pool
from app.routers.health import router as health_router
from app.routers.ingest import router as ingest_router
from app.routers.search import router as search_router
from app.routers.chat import router as chat_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create DB pool + schema. Shutdown: close pool."""
    logger.info("Starting up — initializing database pool...")
    await init_pool()
    logger.info("Database pool ready.")
    yield
    logger.info("Shutting down — closing database pool...")
    await close_pool()
    logger.info("Database pool closed.")


app = FastAPI(
    title="IceBones AI Assistant",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(ingest_router, prefix="/api")
app.include_router(search_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
