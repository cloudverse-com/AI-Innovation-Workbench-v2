"""
Demo 11: In-Memory PDF Q&A (RAG) — Semantic Kernel vector store
================================================================
Real semantic retrieval, fully in-memory, two libraries each doing what they
do best:

  1. Parse    — LiteParse (Rust-powered, local) extracts layout-aware text.
  2. Chunk    — text is split per page into overlapping windows.
  3. Embed +  — Semantic Kernel's InMemoryCollection stores each chunk with an
     store      Azure OpenAI embedding and performs cosine-similarity search.
  4. Answer   — the Microsoft Agent Framework agent (FoundryChatClient) is
                grounded on the retrieved chunks and streams the answer.

No external vector database — each session owns an in-memory SK collection.
Two endpoints:
  POST /api/demo-11/index  — parse PDF, embed + store chunks, return session_id
  POST /api/demo-11/ask   — given session_id + question, stream the answer
"""

import asyncio
import uuid
from dataclasses import dataclass
from typing import Annotated, AsyncGenerator

from semantic_kernel.connectors.ai.open_ai import AzureTextEmbedding
from semantic_kernel.connectors.in_memory import InMemoryCollection
from semantic_kernel.data.vector import DistanceFunction, VectorStoreField, vectorstoremodel

from backend.config import settings
from backend.services.demo10_liteparse_service import _parse_pdf
from backend.services.foundry_client import create_agent

# ── Chunking / retrieval parameters ───────────────────────────────────────────
_CHUNK_SIZE = 1_200        # characters per chunk
_CHUNK_OVERLAP = 200       # overlap between adjacent chunks
_TOP_K = 5                 # chunks retrieved per question
_MAX_CONTEXT_CHARS = 6_000  # hard cap on total injected context
_EMBED_DIM = settings.azure_openai_embedding_dimensions

_SYSTEM_PROMPT = (
    "You are a precise document Q&A assistant. "
    "Answer questions strictly using the provided document context. "
    "If the information is not in the context, say so clearly. "
    "Be concise and cite relevant parts of the text when helpful."
)


# ── Vector record model ───────────────────────────────────────────────────────
# The `embedding` field is populated with the chunk text before upsert; Semantic
# Kernel embeds that text in place and overwrites it with the float vector.
@vectorstoremodel
@dataclass
class _DocChunk:
    chunk_id: Annotated[str, VectorStoreField("key")]
    text: Annotated[str, VectorStoreField("data")]
    page: Annotated[int, VectorStoreField("data")] = 0
    embedding: Annotated[
        str | list[float] | None,
        VectorStoreField(
            "vector",
            dimensions=_EMBED_DIM,
            distance_function=DistanceFunction.COSINE_SIMILARITY,
        ),
    ] = None


# ── In-memory session store ───────────────────────────────────────────────────
# Maps session_id -> {"collection": InMemoryCollection, "filename": str,
#                     "chunk_count": int, "char_count": int}
_sessions: dict[str, dict] = {}


def _get_embedder() -> AzureTextEmbedding:
    """Build the Azure OpenAI embedding generator from settings."""
    if not settings.azure_openai_endpoint or not settings.azure_openai_api_key:
        raise ValueError(
            "Azure OpenAI embedding is not configured. Set AZURE_OPENAI_ENDPOINT, "
            "AZURE_OPENAI_API_KEY and AZURE_OPENAI_EMBEDDING_DEPLOYMENT in backend/.env."
        )
    return AzureTextEmbedding(
        endpoint=settings.azure_openai_endpoint,
        api_key=settings.azure_openai_api_key,
        deployment_name=settings.azure_openai_embedding_deployment,
        api_version=settings.azure_openai_api_version,
    )


# ── Chunking ──────────────────────────────────────────────────────────────────

def _chunk_pages(pages: list[dict]) -> list[tuple[str, int]]:
    """Split each LiteParse page into overlapping windows, keeping the page number."""
    step = _CHUNK_SIZE - _CHUNK_OVERLAP
    out: list[tuple[str, int]] = []
    for page in pages:
        text = (page.get("text") or "").strip()
        if not text:
            blocks = page.get("blocks") or []
            text = " ".join(b.get("text", "") for b in blocks).strip()
        if not text:
            continue
        page_num = page.get("page", 0)
        for i in range(0, len(text), step):
            piece = text[i : i + _CHUNK_SIZE].strip()
            if piece:
                out.append((piece, page_num))
    return out


# ── Public API ────────────────────────────────────────────────────────────────

async def stream_index(file_bytes: bytes, filename: str) -> AsyncGenerator:
    """
    Parse a PDF, embed its chunks into an in-memory SK vector store, and keep the
    collection in a server-side session.
    Yields SSE-compatible dicts ending with {"done": True, "session_id": ...}.
    """
    session_id = str(uuid.uuid4())

    yield {"status": "extracting", "message": f"Parsing {filename} with LiteParse…"}

    try:
        parsed = await asyncio.to_thread(_parse_pdf, file_bytes)
    except Exception as exc:
        yield {"error": f"LiteParse failed: {exc}"}
        return

    if not parsed["full_text"]:
        yield {"error": "No text found in this PDF. It may be a scanned image."}
        return

    chunks = _chunk_pages(parsed["pages"])
    if not chunks:
        yield {"error": "No extractable text chunks were produced from this PDF."}
        return

    yield {"status": "extracting", "message": f"Embedding {len(chunks)} chunks…"}

    try:
        embedder = _get_embedder()
        collection = InMemoryCollection(
            record_type=_DocChunk,
            collection_name=f"doc_{session_id}",
            embedding_generator=embedder,
        )
        await collection.ensure_collection_exists()
        records = [
            _DocChunk(chunk_id=str(i), text=text, page=page, embedding=text)
            for i, (text, page) in enumerate(chunks)
        ]
        await collection.upsert(records)
    except Exception as exc:
        yield {"error": f"Embedding/indexing failed: {exc}"}
        return

    _sessions[session_id] = {
        "collection": collection,
        "filename": filename,
        "chunk_count": len(chunks),
        "char_count": parsed["char_count"],
    }

    yield {
        "done": True,
        "session_id": session_id,
        "filename": filename,
        "chunk_count": len(chunks),
        "char_count": parsed["char_count"],
        "page_count": parsed["page_count"],
    }


async def stream_ask(session_id: str, question: str, model: str) -> AsyncGenerator:
    """
    Vector-search the session's chunks for the question and stream an LLM answer.
    Yields SSE-compatible dicts ending with {"done": True, ...}.
    """
    session = _sessions.get(session_id)
    if not session:
        yield {"error": "Session expired or not found. Please re-upload your PDF."}
        return

    collection: InMemoryCollection = session["collection"]

    yield {"status": "searching", "message": "Searching document chunks…"}

    try:
        search_results = await collection.search(question, top=_TOP_K)
        hits = [(r.record, r.score) async for r in search_results.results]
    except Exception as exc:
        yield {"error": f"Vector search failed: {exc}"}
        return

    # Trim to the context budget, preserving similarity order.
    context_parts: list[str] = []
    total = 0
    for record, _score in hits:
        if total + len(record.text) > _MAX_CONTEXT_CHARS:
            break
        context_parts.append(record.text)
        total += len(record.text)

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
