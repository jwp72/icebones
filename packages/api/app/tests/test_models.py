"""Tests for Pydantic request/response models."""

import pytest

from app.models import (
    IngestRequest,
    IngestResponse,
    SearchRequest,
    SearchResponse,
    SearchResult,
    ChatMessage,
    ChatRequest,
    ChatResponse,
    ChatSource,
    HealthResponse,
    StatsResponse,
)


class TestIngestModels:
    """Test Ingest request/response models."""

    def test_ingest_request_defaults(self):
        req = IngestRequest()
        assert req.docs_path is None

    def test_ingest_request_with_path(self):
        req = IngestRequest(docs_path="/custom/path")
        assert req.docs_path == "/custom/path"

    def test_ingest_response_valid(self):
        resp = IngestResponse(
            files_processed=5,
            chunks_created=42,
            chunks_updated=3,
            total_tokens=12000,
        )
        assert resp.files_processed == 5
        assert resp.chunks_created == 42
        assert resp.chunks_updated == 3
        assert resp.total_tokens == 12000


class TestSearchModels:
    """Test Search request/response models."""

    def test_search_request_defaults(self):
        req = SearchRequest(query="how to animate")
        assert req.query == "how to animate"
        assert req.top_k == 5
        assert req.threshold == 0.3

    def test_search_request_custom_params(self):
        req = SearchRequest(query="test", top_k=10, threshold=0.5)
        assert req.top_k == 10
        assert req.threshold == 0.5

    def test_search_result_valid(self):
        result = SearchResult(
            content="Some documentation text.",
            source_file="guide.md",
            heading_path="Guide > Section",
            score=0.87,
            token_count=15,
        )
        assert result.score == 0.87
        assert result.source_file == "guide.md"

    def test_search_response_with_results(self):
        results = [
            SearchResult(
                content="Text 1",
                source_file="a.md",
                heading_path="A > B",
                score=0.9,
                token_count=10,
            ),
            SearchResult(
                content="Text 2",
                source_file="b.md",
                heading_path="B > C",
                score=0.8,
                token_count=20,
            ),
        ]
        resp = SearchResponse(results=results)
        assert len(resp.results) == 2

    def test_search_response_empty(self):
        resp = SearchResponse(results=[])
        assert resp.results == []


class TestChatModels:
    """Test Chat request/response models."""

    def test_chat_message_valid(self):
        msg = ChatMessage(role="user", content="Hello")
        assert msg.role == "user"
        assert msg.content == "Hello"

    def test_chat_request_defaults(self):
        req = ChatRequest(message="What is IceBones?")
        assert req.message == "What is IceBones?"
        assert req.conversation_id is None
        assert req.history == []

    def test_chat_request_with_history(self):
        history = [
            ChatMessage(role="user", content="Hi"),
            ChatMessage(role="assistant", content="Hello!"),
        ]
        req = ChatRequest(
            message="Follow up question",
            conversation_id="abc-123",
            history=history,
        )
        assert len(req.history) == 2
        assert req.conversation_id == "abc-123"

    def test_chat_source_valid(self):
        source = ChatSource(
            source_file="guide.md",
            heading_path="Guide > Intro",
            score=0.92,
        )
        assert source.score == 0.92

    def test_chat_response_valid(self):
        resp = ChatResponse(
            answer="IceBones is a 2D skeletal animation tool.",
            sources=[
                ChatSource(
                    source_file="readme.md",
                    heading_path="README > Overview",
                    score=0.95,
                )
            ],
            model="claude-sonnet-4-20250514",
        )
        assert resp.answer.startswith("IceBones")
        assert len(resp.sources) == 1
        assert resp.model == "claude-sonnet-4-20250514"

    def test_chat_response_no_sources(self):
        resp = ChatResponse(
            answer="I don't know.",
            sources=[],
            model="gpt-4o",
        )
        assert resp.sources == []


class TestHealthModels:
    """Test Health/Stats response models."""

    def test_health_response_valid(self):
        resp = HealthResponse(
            status="healthy",
            database="connected",
            document_count=150,
        )
        assert resp.status == "healthy"
        assert resp.document_count == 150

    def test_stats_response_valid(self):
        resp = StatsResponse(
            total_chunks=200,
            total_files=10,
            avg_token_count=245.5,
            last_ingested="2025-01-15T10:30:00+00:00",
        )
        assert resp.total_chunks == 200
        assert resp.total_files == 10
        assert resp.avg_token_count == 245.5
        assert resp.last_ingested is not None

    def test_stats_response_null_last_ingested(self):
        resp = StatsResponse(
            total_chunks=0,
            total_files=0,
            avg_token_count=0.0,
            last_ingested=None,
        )
        assert resp.last_ingested is None
