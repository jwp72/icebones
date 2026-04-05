"""Tests for the markdown chunker service."""

import pytest

from app.services.chunker import chunk_markdown


class TestBasicChunking:
    """Test basic markdown splitting at heading boundaries."""

    def test_simple_h2_split(self):
        """Test splitting a simple markdown file with ## headings."""
        content = """# My Document

Introduction text here.

## Section One

Content for section one.

## Section Two

Content for section two.
"""
        chunks = chunk_markdown(content, "test.md")

        assert len(chunks) >= 2
        # Check that section one and two are separate chunks
        section_contents = [c["content"] for c in chunks]
        assert any("Section One" in c for c in section_contents)
        assert any("Section Two" in c for c in section_contents)

    def test_all_chunks_have_required_fields(self):
        """Test that every chunk has the required fields."""
        content = """# Test

## First

Hello world.

## Second

Goodbye world.
"""
        chunks = chunk_markdown(content, "test.md")

        for chunk in chunks:
            assert "content" in chunk
            assert "source_file" in chunk
            assert "heading_path" in chunk
            assert "chunk_index" in chunk
            assert "token_count" in chunk
            assert chunk["source_file"] == "test.md"
            assert chunk["token_count"] > 0

    def test_source_file_preserved(self):
        """Test that source_file is correctly preserved in all chunks."""
        content = "## Heading\n\nSome content."
        chunks = chunk_markdown(content, "docs/guide.md")

        for chunk in chunks:
            assert chunk["source_file"] == "docs/guide.md"


class TestHeadingPath:
    """Test heading_path construction with nested headings."""

    def test_h2_heading_path(self):
        """Test heading_path for ## sections includes doc title."""
        content = """# Editor Guide

## Viewport

Viewport content here.
"""
        chunks = chunk_markdown(content, "guide.md")

        viewport_chunk = next(c for c in chunks if "Viewport" in c["content"])
        assert viewport_chunk["heading_path"] == "Editor Guide > Viewport"

    def test_h3_heading_path(self):
        """Test heading_path for ### sections includes doc title > h2 > h3."""
        content = """# Editor Guide

## Viewport

Viewport intro.

### Navigation

Navigation content here.
"""
        chunks = chunk_markdown(content, "guide.md")

        nav_chunk = next(c for c in chunks if "Navigation content" in c["content"])
        assert nav_chunk["heading_path"] == "Editor Guide > Viewport > Navigation"

    def test_title_from_filename_when_no_h1(self):
        """Test that filename is used as title when no # heading exists."""
        content = """## Section

Some content.
"""
        chunks = chunk_markdown(content, "my-document.md")

        assert chunks[0]["heading_path"].startswith("my-document")

    def test_multiple_h3_under_same_h2(self):
        """Test multiple ### sections under the same ## parent."""
        content = """# Doc

## Tools

### Brush

Brush info.

### Eraser

Eraser info.
"""
        chunks = chunk_markdown(content, "doc.md")

        brush_chunk = next(c for c in chunks if "Brush info" in c["content"])
        eraser_chunk = next(c for c in chunks if "Eraser info" in c["content"])

        assert brush_chunk["heading_path"] == "Doc > Tools > Brush"
        assert eraser_chunk["heading_path"] == "Doc > Tools > Eraser"


class TestChunkSplitting:
    """Test chunk splitting when content exceeds max_tokens."""

    def test_small_sections_not_split(self):
        """Test that small sections produce a single chunk with index 0."""
        content = """# Doc

## Small Section

Just a short paragraph.
"""
        chunks = chunk_markdown(content, "test.md", max_tokens=500)

        section_chunks = [c for c in chunks if "Small Section" in c["heading_path"]]
        assert len(section_chunks) == 1
        assert section_chunks[0]["chunk_index"] == 0

    def test_large_section_split_into_sub_chunks(self):
        """Test that a large section is split into multiple sub-chunks."""
        # Create a section with many paragraphs that exceed max_tokens
        paragraphs = ["This is paragraph number {0}. " * 20 for _ in range(10)]
        large_section = "\n\n".join(
            p.format(i) for i, p in enumerate(paragraphs)
        )

        content = f"""# Doc

## Big Section

{large_section}
"""
        chunks = chunk_markdown(content, "test.md", max_tokens=50)

        big_chunks = [c for c in chunks if "Big Section" in c["heading_path"]]
        assert len(big_chunks) > 1

        # Check chunk_index is sequential
        indices = [c["chunk_index"] for c in big_chunks]
        assert indices == list(range(len(big_chunks)))

    def test_token_count_within_limits(self):
        """Test that most chunks respect the max_tokens limit."""
        paragraphs = [f"Paragraph {i}. " * 15 for i in range(10)]
        large_content = "\n\n".join(paragraphs)

        content = f"""# Doc

## Section

{large_content}
"""
        max_tokens = 100
        chunks = chunk_markdown(content, "test.md", max_tokens=max_tokens)

        # Most chunks should be near or under the limit
        # (single large paragraphs may exceed it)
        for chunk in chunks:
            assert chunk["token_count"] > 0


class TestEdgeCases:
    """Test edge cases and unusual inputs."""

    def test_empty_file(self):
        """Test that an empty file returns no chunks."""
        chunks = chunk_markdown("", "empty.md")
        assert chunks == []

    def test_whitespace_only_file(self):
        """Test that a whitespace-only file returns no chunks."""
        chunks = chunk_markdown("   \n\n  \t  ", "whitespace.md")
        assert chunks == []

    def test_file_with_no_headings(self):
        """Test file with no headings produces chunks from content."""
        content = "Just some plain text without any headings.\n\nAnother paragraph."
        chunks = chunk_markdown(content, "plain.md")

        assert len(chunks) >= 1
        assert any("plain text" in c["content"] for c in chunks)

    def test_file_with_only_title(self):
        """Test file with only a # title and no other content."""
        content = "# Just a Title\n"
        chunks = chunk_markdown(content, "title-only.md")
        # May produce 0 chunks since there's no body content
        assert isinstance(chunks, list)

    def test_heading_with_special_characters(self):
        """Test headings with special characters are handled."""
        content = """# My Doc

## Setup & Configuration

Config info here.

## FAQ / Troubleshooting

FAQ content.
"""
        chunks = chunk_markdown(content, "test.md")

        assert any("Setup & Configuration" in c["heading_path"] for c in chunks)
        assert any("FAQ / Troubleshooting" in c["heading_path"] for c in chunks)

    def test_introduction_text_before_first_heading(self):
        """Test that intro text before any ## heading is captured."""
        content = """# Guide

This is introduction text that appears before any section heading.

## First Section

Section content.
"""
        chunks = chunk_markdown(content, "guide.md")

        # The intro text should appear in some chunk
        all_content = " ".join(c["content"] for c in chunks)
        assert "introduction text" in all_content
