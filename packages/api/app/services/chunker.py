import re
import tiktoken

_encoding = tiktoken.get_encoding("cl100k_base")


def _count_tokens(text: str) -> int:
    """Count tokens using the cl100k_base encoding."""
    return len(_encoding.encode(text))


def chunk_markdown(
    content: str, source_file: str, max_tokens: int = 500
) -> list[dict]:
    """
    Split markdown content into chunks at ## and ### headings.

    Returns list of:
    {
        "content": str,        # The chunk text (includes heading)
        "source_file": str,
        "heading_path": str,   # e.g. "Editor Guide > Viewport > Navigation"
        "chunk_index": int,    # Sub-chunk index if split within a section
        "token_count": int
    }
    """
    if not content or not content.strip():
        return []

    lines = content.split("\n")

    # Extract document title from the first # heading, or fall back to filename
    doc_title = _extract_title(lines, source_file)

    # Parse into sections based on ## and ### headings
    sections = _split_into_sections(lines)

    # Build chunks from sections
    chunks: list[dict] = []

    for section in sections:
        heading_path = _build_heading_path(doc_title, section["h2"], section["h3"])
        section_text = section["content"]

        if not section_text.strip():
            continue

        token_count = _count_tokens(section_text)

        if token_count <= max_tokens:
            chunks.append(
                {
                    "content": section_text,
                    "source_file": source_file,
                    "heading_path": heading_path,
                    "chunk_index": 0,
                    "token_count": token_count,
                }
            )
        else:
            # Split at paragraph boundaries (double newline)
            sub_chunks = _split_by_paragraphs(section_text, max_tokens)
            for idx, sub_chunk in enumerate(sub_chunks):
                tc = _count_tokens(sub_chunk)
                if sub_chunk.strip():
                    chunks.append(
                        {
                            "content": sub_chunk,
                            "source_file": source_file,
                            "heading_path": heading_path,
                            "chunk_index": idx,
                            "token_count": tc,
                        }
                    )

    return chunks


def _extract_title(lines: list[str], source_file: str) -> str:
    """Extract the document title from the first # heading."""
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("# ") and not stripped.startswith("## "):
            return stripped[2:].strip()
    # Fall back to filename without extension
    name = source_file.rsplit("/", 1)[-1]
    name = name.rsplit("\\", 1)[-1]
    if "." in name:
        name = name.rsplit(".", 1)[0]
    return name


def _split_into_sections(lines: list[str]) -> list[dict]:
    """
    Split lines into sections based on ## and ### headings.

    Each section records its h2 and h3 context plus the content lines.
    """
    sections: list[dict] = []
    current_h2: str | None = None
    current_h3: str | None = None
    current_lines: list[str] = []

    for line in lines:
        stripped = line.strip()

        # Detect ## heading (but not ### or #)
        if re.match(r"^#{2}\s+", stripped) and not stripped.startswith("###"):
            # Flush previous section
            if current_lines:
                sections.append(
                    {
                        "h2": current_h2,
                        "h3": current_h3,
                        "content": "\n".join(current_lines),
                    }
                )
            current_h2 = stripped.lstrip("#").strip()
            current_h3 = None
            current_lines = [line]

        elif re.match(r"^#{3}\s+", stripped) and not stripped.startswith("####"):
            # Flush previous section
            if current_lines:
                sections.append(
                    {
                        "h2": current_h2,
                        "h3": current_h3,
                        "content": "\n".join(current_lines),
                    }
                )
            current_h3 = stripped.lstrip("#").strip()
            current_lines = [line]

        elif re.match(r"^#\s+", stripped) and not stripped.startswith("##"):
            # Top-level heading — skip it from content (it's the title)
            # But flush previous section first
            if current_lines:
                sections.append(
                    {
                        "h2": current_h2,
                        "h3": current_h3,
                        "content": "\n".join(current_lines),
                    }
                )
            current_lines = []

        else:
            current_lines.append(line)

    # Flush last section
    if current_lines:
        sections.append(
            {
                "h2": current_h2,
                "h3": current_h3,
                "content": "\n".join(current_lines),
            }
        )

    return sections


def _build_heading_path(
    doc_title: str, h2: str | None, h3: str | None
) -> str:
    """Build a heading path like 'Editor Guide > Viewport > Navigation'."""
    parts = [doc_title]
    if h2:
        parts.append(h2)
    if h3:
        parts.append(h3)
    return " > ".join(parts)


def _split_by_paragraphs(text: str, max_tokens: int) -> list[str]:
    """
    Split text at paragraph boundaries (double newline) to stay under max_tokens.
    If a single paragraph exceeds max_tokens, it is kept as-is (we don't split
    mid-paragraph to avoid breaking meaning).
    """
    paragraphs = re.split(r"\n\n+", text)
    chunks: list[str] = []
    current_chunk: list[str] = []
    current_tokens = 0

    for para in paragraphs:
        para_tokens = _count_tokens(para)

        if current_chunk and (current_tokens + para_tokens) > max_tokens:
            # Flush current chunk
            chunks.append("\n\n".join(current_chunk))
            current_chunk = [para]
            current_tokens = para_tokens
        else:
            current_chunk.append(para)
            current_tokens += para_tokens

    if current_chunk:
        chunks.append("\n\n".join(current_chunk))

    return chunks
