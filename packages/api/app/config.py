from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://icebones:icebones@localhost:5432/icebones"
    voyage_api_key: str = ""
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    llm_provider: str = "claude"  # "claude" or "openai"
    docs_path: str = "docs/"
    embedding_model: str = "voyage-3-lite"
    embedding_dimensions: int = 512
    chunk_max_tokens: int = 500
    search_top_k: int = 5
    search_threshold: float = 0.3

    class Config:
        env_file = ".env"


settings = Settings()
