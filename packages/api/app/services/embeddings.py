import asyncio
from functools import partial

try:
    import voyageai

    _voyageai_available = True
except ImportError:
    _voyageai_available = False


class EmbeddingService:
    """Voyage AI embedding client for generating text embeddings."""

    def __init__(self, api_key: str, model: str = "voyage-3-lite"):
        if not _voyageai_available:
            raise RuntimeError(
                "voyageai package is not installed. Install it with: pip install voyageai"
            )
        if not api_key:
            raise ValueError(
                "Voyage AI API key is required. Set VOYAGE_API_KEY in your environment."
            )
        self.client = voyageai.Client(api_key=api_key)
        self.model = model

    async def embed_text(self, text: str) -> list[float]:
        """Embed a single text string."""
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, partial(self.client.embed, [text], model=self.model)
        )
        return result.embeddings[0]

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple texts in one API call."""
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, partial(self.client.embed, texts, model=self.model)
        )
        return result.embeddings
