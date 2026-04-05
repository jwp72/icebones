from typing import Protocol

try:
    import anthropic

    _anthropic_available = True
except ImportError:
    _anthropic_available = False

try:
    import openai

    _openai_available = True
except ImportError:
    _openai_available = False


class LLMProvider(Protocol):
    async def chat(
        self, system: str, messages: list[dict], max_tokens: int = 1024
    ) -> tuple[str, str]:
        """Returns (response_text, model_name)"""
        ...


class ClaudeProvider:
    """Anthropic Claude LLM provider."""

    def __init__(self, api_key: str):
        if not _anthropic_available:
            raise RuntimeError(
                "anthropic package is not installed. Install it with: pip install anthropic"
            )
        if not api_key:
            raise ValueError(
                "Anthropic API key is required. Set ANTHROPIC_API_KEY in your environment."
            )
        self.client = anthropic.AsyncAnthropic(api_key=api_key)

    async def chat(
        self, system: str, messages: list[dict], max_tokens: int = 1024
    ) -> tuple[str, str]:
        model = "claude-sonnet-4-20250514"
        response = await self.client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
        )
        return response.content[0].text, model


class OpenAIProvider:
    """OpenAI GPT LLM provider."""

    def __init__(self, api_key: str):
        if not _openai_available:
            raise RuntimeError(
                "openai package is not installed. Install it with: pip install openai"
            )
        if not api_key:
            raise ValueError(
                "OpenAI API key is required. Set OPENAI_API_KEY in your environment."
            )
        self.client = openai.AsyncOpenAI(api_key=api_key)

    async def chat(
        self, system: str, messages: list[dict], max_tokens: int = 1024
    ) -> tuple[str, str]:
        model = "gpt-4o"
        all_messages = [{"role": "system", "content": system}] + messages
        response = await self.client.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            messages=all_messages,
        )
        return response.choices[0].message.content, model


def get_llm_provider(
    provider: str, anthropic_key: str, openai_key: str
) -> LLMProvider:
    """Factory function to create the appropriate LLM provider."""
    if provider == "claude":
        return ClaudeProvider(anthropic_key)
    elif provider == "openai":
        return OpenAIProvider(openai_key)
    else:
        raise ValueError(f"Unknown LLM provider: {provider}")
