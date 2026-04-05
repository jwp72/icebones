import asyncpg
from pgvector.asyncpg import register_vector

from app.config import settings

_pool: asyncpg.Pool | None = None

SCHEMA_SQL = """
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

-- Unique constraint for upsert support
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_documents_source_heading_chunk'
    ) THEN
        ALTER TABLE documents
            ADD CONSTRAINT uq_documents_source_heading_chunk
            UNIQUE (source_file, heading_path, chunk_index);
    END IF;
END $$;
"""


async def init_pool() -> asyncpg.Pool:
    """Create the connection pool and run schema setup."""
    global _pool

    _pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=2,
        max_size=10,
        init=_init_connection,
    )

    async with _pool.acquire() as conn:
        await conn.execute(SCHEMA_SQL)

    return _pool


async def _init_connection(conn: asyncpg.Connection) -> None:
    """Register the pgvector type on each new connection."""
    await register_vector(conn)


async def close_pool() -> None:
    """Close the connection pool."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    """Return the current connection pool. Raises if not initialized."""
    if _pool is None:
        raise RuntimeError("Database pool is not initialized. Call init_pool() first.")
    return _pool
