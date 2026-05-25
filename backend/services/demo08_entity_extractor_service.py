"""
Demo 08: PDF Entity Extractor
==============================
Uses Docling to parse a PDF into Markdown, then passes the text to an
MS Agent (Agent + FoundryChatClient) for named-entity extraction.
No Azure Content Understanding is used — just the LLM.
"""

import asyncio
import json

import fitz  # pymupdf

from backend.services.foundry_client import create_agent


def _extract_text(file_bytes: bytes) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    return "\n".join(page.get_text() for page in doc).strip()

_SYSTEM_PROMPT = """\
You are an expert information extraction system.

Analyse the document and identify all meaningful entities and concepts.
Choose category names that best fit the document's domain and content —
do NOT use a fixed set of categories. For example:
- A medical report might have: patients, diagnoses, medications, procedures, dosages
- A legal contract might have: parties, obligations, penalties, dates, governing_law
- A financial report might have: companies, revenue_figures, products, executives, markets
- A research paper might have: authors, institutions, methodologies, findings, references

Return ONLY a valid JSON object — no prose, no markdown fences.
Each key is a category name (snake_case), each value is an array of unique strings.

Rules:
- Pick whatever categories are genuinely present and meaningful in this document.
- Each list contains unique strings only (no duplicates).
- Omit categories that would be empty.
- Return ONLY the JSON object. Nothing before or after it.
"""

# Maximum characters sent to the LLM to avoid token limit issues.
# ~12 000 chars ≈ ~3 000 tokens of document content.
_MAX_CHARS = 12_000


async def stream_extract_entities(file_bytes: bytes, filename: str, model: str):
    """Async generator that yields SSE-compatible dicts for the extraction pipeline."""
    yield {"status": "parsing"}

    try:
        markdown_text = await asyncio.to_thread(_extract_text, file_bytes)
    except Exception as exc:
        yield {"error": f"Failed to extract text from PDF: {exc}"}
        return

    if not markdown_text:
        yield {"error": "No text found in PDF. The file may be a scanned image."}
        return

    text_length = len(markdown_text)
    truncated = text_length > _MAX_CHARS
    text_to_analyze = markdown_text[:_MAX_CHARS] if truncated else markdown_text

    yield {"status": "analyzing", "text_length": text_length, "truncated": truncated}

    agent = create_agent(instructions=_SYSTEM_PROMPT, model=model, name="EntityExtractorAgent")

    raw_response = ""
    async for chunk in agent.run(text_to_analyze, stream=True):
        if chunk.text:
            raw_response += chunk.text
            yield {"token": chunk.text}

    raw_response = raw_response.strip()

    if raw_response.startswith("```"):
        parts = raw_response.split("```")
        inner = parts[1] if len(parts) > 1 else raw_response
        if inner.lower().startswith("json"):
            inner = inner[4:]
        raw_response = inner.strip()

    try:
        entities = json.loads(raw_response)
    except (json.JSONDecodeError, ValueError):
        entities = {"raw_response": raw_response}

    yield {
        "done": True,
        "entities": entities,
        "text_length": text_length,
        "truncated": truncated,
        "filename": filename,
        "model": model,
    }
