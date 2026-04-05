from fastapi import APIRouter, HTTPException

from app.config import settings
from app.database import get_pool
from app.models import ChatRequest, ChatResponse, ChatSource
from app.services.embeddings import EmbeddingService
from app.services.llm import get_llm_provider
from app.services.vector_store import VectorStore

router = APIRouter(tags=["chat"])

SYSTEM_PROMPT_TEMPLATE = """You are IceBones Assistant, an expert on the IceBones 2D skeletal animation editor and runtime. \
Answer questions using the documentation provided below. Be helpful, specific, and include code \
examples when relevant. If the answer isn't in the provided documentation, say so honestly rather \
than guessing.

Documentation context:
---
{context}
---"""


def _build_context(results: list[dict]) -> str:
    """Build the documentation context string from search results."""
    parts = []
    for r in results:
        parts.append(
            f"{r['content']}\n[Source: {r['source_file']} > {r['heading_path']}]"
        )
    return "\n\n".join(parts)


@router.post("/chat", response_model=ChatResponse)
async def rag_chat(request: ChatRequest):
    """Full RAG pipeline: embed query, search docs, build prompt, call LLM."""
    # 1. Initialize services
    try:
        embedding_service = EmbeddingService(
            api_key=settings.voyage_api_key, model=settings.embedding_model
        )
    except (RuntimeError, ValueError) as e:
        raise HTTPException(status_code=500, detail=str(e))

    try:
        llm = get_llm_provider(
            provider=settings.llm_provider,
            anthropic_key=settings.anthropic_api_key,
            openai_key=settings.openai_api_key,
        )
    except (RuntimeError, ValueError) as e:
        raise HTTPException(status_code=500, detail=str(e))

    pool = get_pool()
    store = VectorStore(pool)

    # 2. Embed the user's message
    try:
        query_embedding = await embedding_service.embed_text(request.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding API error: {e}")

    # 3. Vector search for top-K relevant chunks
    results = await store.search(
        embedding=query_embedding,
        top_k=settings.search_top_k,
        threshold=settings.search_threshold,
    )

    # 4. Build system prompt with retrieved context
    context = _build_context(results)
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(context=context)

    # 5. Build messages including conversation history
    messages: list[dict] = []
    for msg in request.history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": request.message})

    # 6. Call LLM
    try:
        answer, model_name = await llm.chat(
            system=system_prompt, messages=messages, max_tokens=1024
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM API error: {e}")

    # 7. Return answer + sources
    sources = [
        ChatSource(
            source_file=r["source_file"],
            heading_path=r["heading_path"],
            score=r["score"],
        )
        for r in results
    ]

    return ChatResponse(answer=answer, sources=sources, model=model_name)
