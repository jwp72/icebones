from pathlib import Path
from pydantic_settings import BaseSettings

# Find .env at repo root (two levels up from packages/api/app/)
_env_file = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    database_url: str = "postgresql://icebones:icebones@localhost:5433/icebones"
    voyage_api_key: str = ""
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    openrouter_api_key: str = ""
    openrouter_model: str = "anthropic/claude-sonnet-4"
    llm_provider: str = "claude"  # "claude", "openai", or "openrouter"
    docs_path: str = "docs/"
    embedding_model: str = "voyage-3-lite"
    embedding_dimensions: int = 512
    chunk_max_tokens: int = 500
    search_top_k: int = 5
    search_threshold: float = 0.3

    class Config:
        env_file = str(_env_file)


settings = Settings()
