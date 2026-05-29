"""
Demo 11: In-Memory PDF Q&A (RAG)
=================================
Uses Microsoft Agent Framework's in-memory approach:
  1. Upload a PDF → text is extracted, chunked, and stored in a server-side session.
  2. For each question, the top-k relevant chunks are retrieved via keyword scoring
     and injected as context into an MS Agent (FoundryChatClient) which streams the answer.

No external vector database or embedding model required — all retrieval is in-memory.
Two endpoints:
  POST /api/demo-11/index  — parse PDF, store chunks, return session_id
  POST /api/demo-11/ask   — given session_id + question, stream the answer
"""

import asyncio
import re
import uuid
from typing import AsyncGenerator

import fitz  # pymupdf

from backend.services.foundry_client import create_agent

# ── Chunking parameters ───────────────────────────────────────────────────────
_CHUNK_SIZE = 600        # characters per chunk
_CHUNK_OVERLAP = 100     # overlap between adjacent chunks
_TOP_K = 5               # chunks retrieved per question
_MAX_CONTEXT_CHARS = 6_000  # hard cap on total injected context

# ── In-memory session store ───────────────────────────────────────────────────
# Maps session_id -> {"chunks": list[str], "filename": str, "char_count": int}
_sessions: dict[str, dict] = {}

_SYSTEM_PROMPT = (
    "You are a precise document Q&A assistant. "
    "Answer questions strictly using the provided document context. "
    "If the information is not in the context, say so clearly. "
    "Be concise and cite relevant parts of the text when helpful."
)


# ── Text extraction ───────────────────────────────────────────────────────────

def _extract_text(file_bytes: bytes) -> str:
    """Extract all text from a PDF (runs in a worker thread)."""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    return "\n".join(page.get_text() for page in doc).strip()


# ── Chunking ──────────────────────────────────────────────────────────────────

def _chunk_text(text: str) -> list[str]:
    """Split text into overlapping fixed-size chunks."""
    step = _CHUNK_SIZE - _CHUNK_OVERLAP
    chunks = []
    for i in range(0, len(text), step):
        chunk = text[i : i + _CHUNK_SIZE].strip()
        if chunk:
            chunks.append(chunk)
    return chunks


# ── Keyword retrieval ─────────────────────────────────────────────────────────

def _search_chunks(chunks: list[str], query: str, top_k: int = _TOP_K) -> list[str]:
    """Return the top-k chunks most relevant to the query via term-frequency scoring."""
    terms = re.findall(r"\w+", query.lower())
    if not terms:
        return chunks[:top_k]

    scored = []
    for chunk in chunks:
        lower = chunk.lower()
        score = sum(lower.count(t) for t in terms)
        scored.append((chunk, score))

    scored.sort(key=lambda x: -x[1])

    # Return matches with score > 0; fall back to first chunks if nothing matches
    results = [c for c, s in scored[:top_k] if s > 0]
    return results or chunks[:top_k]


# ── Public API ────────────────────────────────────────────────────────────────

async def stream_index(file_bytes: bytes, filename: str) -> AsyncGenerator:
    """
    Parse a PDF, chunk its text, and store in memory.
    Yields SSE-compatible dicts ending with {"done": True, "session_id": ...}.
    """
    session_id = str(uuid.uuid4())

    yield {"status": "extracting", "message": f"Extracting text from {filename}…"}

    try:
        text = await asyncio.to_thread(_extract_text, file_bytes)
    except Exception as exc:
        yield {"error": f"Failed to extract text: {exc}"}
        return

    if not text:
        yield {"error": "No text found in this PDF. It may be a scanned image."}
        return

    chunks = _chunk_text(text)
    _sessions[session_id] = {
        "chunks": chunks,
        "filename": filename,
        "char_count": len(text),
    }

    yield {
        "done": True,
        "session_id": session_id,
        "filename": filename,
        "chunk_count": len(chunks),
        "char_count": len(text),
    }


async def stream_ask(session_id: str, question: str, model: str) -> AsyncGenerator:
    """
    Retrieve relevant chunks for the question and stream an LLM answer.
    Yields SSE-compatible dicts ending with {"done": True, ...}.
    """
    session = _sessions.get(session_id)
    if not session:
        yield {"error": "Session expired or not found. Please re-upload your PDF."}
        return

    yield {"status": "searching", "message": "Searching document chunks…"}

    relevant = _search_chunks(session["chunks"], question)

    # Trim to context budget
    context_parts: list[str] = []
    total = 0
    for chunk in relevant:
        if total + len(chunk) > _MAX_CONTEXT_CHARS:
            break
        context_parts.append(chunk)
        total += len(chunk)

    context = "\n\n---\n\n".join(context_parts)
    chunks_used = len(context_parts)

    yield {"status": "generating", "message": "Generating answer…", "chunks_used": chunks_used}

    prompt = (
        f"=== DOCUMENT: {session['filename']} ===\n"
        f"{context}\n"
        f"=== END DOCUMENT ===\n\n"
        f"Question: {question}"
    )

    agent = create_agent(
        instructions=_SYSTEM_PROMPT,
        model=model,
        name="InMemoryRAGAgent",
    )

    response = ""
    async for chunk in agent.run(prompt, stream=True):
        if chunk.text:
            response += chunk.text
            yield {"token": chunk.text}

    yield {
        "done": True,
        "response": response.strip(),
        "chunks_used": chunks_used,
        "question": question,
        "filename": session["filename"],
    }
