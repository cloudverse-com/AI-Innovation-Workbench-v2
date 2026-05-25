"""
Demo 09: Document Q&A Agent
===========================
Combines the document-extraction approach of Demo 08 with the hosted
FoundryAgent approach of Demo 02:

  1. A PDF is attached from the frontend.
  2. Its text is extracted locally (pymupdf / fitz).
  3. The extracted text + the user's question are sent to a hosted
     Foundry agent (selected by name, exactly like Demo 02).
  4. The agent's answer is streamed back to the frontend.
"""

import asyncio

import fitz  # pymupdf

from agent_framework.foundry import FoundryAgent
from azure.identity import DefaultAzureCredential

from backend.config import settings


# Maximum characters of document text sent to the agent to avoid token limits.
# ~12 000 chars ≈ ~3 000 tokens of document content.
_MAX_CHARS = 12_000


def _extract_text(file_bytes: bytes) -> str:
    """Extract all text from a PDF using pymupdf (runs in a worker thread)."""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    return "\n".join(page.get_text() for page in doc).strip()


def _build_prompt(question: str, document_text: str, filename: str) -> str:
    """Compose the message sent to the agent: the document plus the question."""
    return (
        "Use the attached document to answer the question.\n\n"
        f"=== DOCUMENT ({filename}) ===\n"
        f"{document_text}\n"
        "=== END DOCUMENT ===\n\n"
        f"Question: {question}"
    )


async def stream_document_agent(
    file_bytes: bytes,
    filename: str,
    question: str,
    agent_name: str,
):
    """Async generator that yields SSE-compatible dicts for the Q&A pipeline."""
    yield {"status": "parsing"}

    try:
        document_text = await asyncio.to_thread(_extract_text, file_bytes)
    except Exception as exc:
        yield {"error": f"Failed to extract text from PDF: {exc}"}
        return

    if not document_text:
        yield {"error": "No text found in PDF. The file may be a scanned image."}
        return

    text_length = len(document_text)
    truncated = text_length > _MAX_CHARS
    text_to_send = document_text[:_MAX_CHARS] if truncated else document_text

    yield {"status": "analyzing", "text_length": text_length, "truncated": truncated}

    agent = FoundryAgent(
        project_endpoint=settings.foundry_project_endpoint,
        agent_name=agent_name,
        credential=DefaultAzureCredential(),
    )

    prompt = _build_prompt(question, text_to_send, filename)

    response = ""
    async for chunk in agent.run(prompt, stream=True):
        if chunk.text:
            response += chunk.text
            yield {"token": chunk.text}

    yield {
        "done": True,
        "response": response.strip(),
        "text_length": text_length,
        "truncated": truncated,
        "filename": filename,
        "agent_name": agent_name,
    }
