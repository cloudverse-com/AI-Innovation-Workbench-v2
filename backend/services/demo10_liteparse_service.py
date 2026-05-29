"""
Demo 10: Document Layout Parser
================================
Uses LiteParse (Rust-powered, local, no cloud) to parse a PDF with full
spatial layout awareness — bounding boxes, per-page text blocks, and parse
timing — then optionally streams an LLM summary via MS Agent.
"""

import asyncio
import time

from liteparse import LiteParse

from backend.services.foundry_client import create_agent

_MAX_CHARS = 12_000

_SUMMARY_PROMPT = """\
You are a concise document summarizer.

The user has uploaded a PDF that was parsed using LiteParse, a spatial document parser.
Below is the extracted text, preserving page structure.

Provide a clear, structured summary:
- What is this document about?
- Key topics or sections covered
- Any important facts, figures, or entities

Be concise. Use bullet points where appropriate.
"""


def _parse_pdf(file_bytes: bytes) -> dict:
    """Run LiteParse synchronously (called in a worker thread)."""
    parser = LiteParse()
    start = time.perf_counter()
    result = parser.parse(file_bytes)
    elapsed_ms = round((time.perf_counter() - start) * 1000)

    pages = []
    full_text_parts = []

    for page in result.pages:
        page_num = getattr(page, "page_num", None) or getattr(page, "pageNum", None) or len(pages) + 1
        page_text = getattr(page, "text", "") or ""

        text_items_raw = getattr(page, "text_items", None) or getattr(page, "textItems", None) or []
        blocks = []
        for item in text_items_raw:
            text = getattr(item, "text", "") or getattr(item, "value", "") or str(item)
            x = getattr(item, "x", None)
            y = getattr(item, "y", None)
            width = getattr(item, "width", None)
            height = getattr(item, "height", None)
            font = getattr(item, "font_name", None) or getattr(item, "fontName", None)
            size = getattr(item, "font_size", None) or getattr(item, "fontSize", None)
            block = {"text": text}
            if x is not None:
                block["x"] = round(x, 2)
            if y is not None:
                block["y"] = round(y, 2)
            if width is not None:
                block["width"] = round(width, 2)
            if height is not None:
                block["height"] = round(height, 2)
            if font:
                block["font"] = font
            if size is not None:
                block["size"] = round(size, 1)
            blocks.append(block)

        if page_text:
            full_text_parts.append(page_text)
        elif blocks:
            full_text_parts.append(" ".join(b["text"] for b in blocks))

        pages.append({
            "page": page_num,
            "text": page_text,
            "blocks": blocks,
            "block_count": len(blocks),
        })

    full_text = "\n\n".join(full_text_parts).strip()
    return {
        "pages": pages,
        "page_count": len(pages),
        "full_text": full_text,
        "char_count": len(full_text),
        "parse_ms": elapsed_ms,
    }


async def stream_parse(file_bytes: bytes, filename: str, model: str, summarize: bool):
    """Async generator yielding SSE-compatible dicts for the LiteParse pipeline."""
    yield {"status": "parsing", "message": "Parsing PDF with LiteParse…"}

    try:
        parsed = await asyncio.to_thread(_parse_pdf, file_bytes)
    except Exception as exc:
        yield {"error": f"LiteParse failed: {exc}"}
        return

    if not parsed["full_text"] and parsed["page_count"] == 0:
        yield {"error": "No content found in PDF."}
        return

    yield {
        "status": "parsed",
        "pages": parsed["pages"],
        "page_count": parsed["page_count"],
        "char_count": parsed["char_count"],
        "parse_ms": parsed["parse_ms"],
        "filename": filename,
        "truncated": parsed["char_count"] > _MAX_CHARS,
    }

    if not summarize:
        yield {"done": True, "filename": filename}
        return

    yield {"status": "summarizing", "message": "Generating AI summary…"}

    text_to_summarize = parsed["full_text"][:_MAX_CHARS]
    agent = create_agent(instructions=_SUMMARY_PROMPT, model=model, name="LayoutSummaryAgent")

    summary = ""
    async for chunk in agent.run(text_to_summarize, stream=True):
        if chunk.text:
            summary += chunk.text
            yield {"token": chunk.text}

    yield {
        "done": True,
        "summary": summary.strip(),
        "filename": filename,
        "model": model,
        "parse_ms": parsed["parse_ms"],
        "page_count": parsed["page_count"],
        "char_count": parsed["char_count"],
        "truncated": parsed["char_count"] > _MAX_CHARS,
    }
