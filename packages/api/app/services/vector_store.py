import json

import asyncpg
import numpy as np


class VectorStore:
    """pgvector-backed document store for semantic search."""

    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool

    async def upsert_chunk(self, chunk: dict, embedding: list[float]) -> bool:
        """
        Insert or update a document chunk.
        Returns True if created (inserted), False if updated.
        """
        embedding_array = np.array(embedding, dtype=np.float32)

        async with self.pool.acquire() as conn:
            # Try insert; on conflict update content/token_count/embedding/metadata
            result = await conn.fetchval(
                """
                INSERT INTO documents (content, source_file, heading_path, chunk_index,
                                       token_count, embedding, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (source_file, heading_path, chunk_index) DO UPDATE
                SET content = EXCLUDED.content,
                    token_count = EXCLUDED.token_count,
                    embedding = EXCLUDED.embedding,
                    metadata = EXCLUDED.metadata,
                    updated_at = NOW()
                RETURNING (xmax = 0) AS is_insert
                """,
                chunk["content"],
                chunk["source_file"],
                chunk["heading_path"],
                chunk["chunk_index"],
                chunk["token_count"],
                embedding_array,
                json.dumps(chunk.get("metadata", {})),
            )
            return bool(result)

    async def search(
        self,
        embedding: list[float],
        top_k: int = 5,
        threshold: float = 0.3,
    ) -> list[dict]:
        """Vector similarity search using cosine distance."""
        embedding_array = np.array(embedding, dtype=np.float32)

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT content, source_file, heading_path, token_count,
                       1 - (embedding <=> $1::vector) AS score
                FROM documents
                WHERE 1 - (embedding <=> $1::vector) > $2
                ORDER BY score DESC
                LIMIT $3
                """,
                embedding_array,
                threshold,
                top_k,
            )

        return [
            {
                "content": row["content"],
                "source_file": row["source_file"],
                "heading_path": row["heading_path"],
                "token_count": row["token_count"],
                "score": float(row["score"]),
            }
            for row in rows
        ]

    async def get_stats(self) -> dict:
        """Return corpus statistics."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT
                    COUNT(*) AS total_chunks,
                    COUNT(DISTINCT source_file) AS total_files,
                    COALESCE(AVG(token_count), 0) AS avg_token_count,
                    MAX(updated_at) AS last_ingested
                FROM documents
                """
            )

        return {
            "total_chunks": row["total_chunks"],
            "total_files": row["total_files"],
            "avg_token_count": float(row["avg_token_count"]),
            "last_ingested": (
                row["last_ingested"].isoformat() if row["last_ingested"] else None
            ),
        }

    async def get_count(self) -> int:
        """Return total document count."""
        async with self.pool.acquire() as conn:
            return await conn.fetchval("SELECT COUNT(*) FROM documents")

    async def ensure_index(self) -> None:
        """Create or rebuild the ivfflat index based on current data size."""
        count = await self.get_count()
        if count == 0:
            return

        lists = max(1, int(count**0.5))  # sqrt(n) lists

        async with self.pool.acquire() as conn:
            await conn.execute("DROP INDEX IF EXISTS idx_documents_embedding")
            await conn.execute(
                f"""
                CREATE INDEX idx_documents_embedding
                ON documents
                USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = {lists})
                """
            )
