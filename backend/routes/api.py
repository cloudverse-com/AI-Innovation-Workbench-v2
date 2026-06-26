"""
AI Innovation Workbench — All Demo Routes
==========================================
All FastAPI routes in one place.
Business logic lives in backend/services/.
"""

import json

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.config import settings
from backend.services import (
    demo01_foundry_chat_service,
    demo02_foundry_agent_service,
    demo06_content_understanding_service,
    demo07_contract_comparison_service,
    demo08_entity_extractor_service,
    demo09_document_agent_service,
    demo10_liteparse_service,
    demo10b_liteparse_agent_service,
    demo11_inmemory_rag_service,
    demo12_ai_search_agent_service,
    demo13_mcp_agent_service,
    demo14_claude_agent_service,
)

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# Demo 01: Chat Completion — FoundryChatClient + streaming
# ─────────────────────────────────────────────────────────────────────────────

class Demo01Request(BaseModel):
    message: str
    model: str = settings.default_model
    system_prompt: str = "You are a helpful assistant."


@router.post("/api/demo-01/chat/stream", tags=["Demo 01"])
async def demo01_chat_stream(request: Demo01Request):
    async def _stream():
        try:
            async for token in demo01_foundry_chat_service.stream(
                request.message, request.model, request.system_prompt
            ):
                yield f"data: {json.dumps({'token': token})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─────────────────────────────────────────────────────────────────────────────
# Demo 02: Foundry Agents — hosted agent by name
# ─────────────────────────────────────────────────────────────────────────────

class Demo02Request(BaseModel):
    message: str
    agent_name: str = settings.foundry_agent_name


@router.post("/api/demo-02/chat", tags=["Demo 02"])
async def demo02_chat(request: Demo02Request):
    response = await demo02_foundry_agent_service.run(request.message, request.agent_name)
    return {"response": response}


# ─────────────────────────────────────────────────────────────────────────────
# Demo 03: Function Tools — stub
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/api/demo-03/chat", tags=["Demo 03"])
async def demo03_chat():
    return {"response": "Demo 03 (Function Tools) — coming soon."}


# ─────────────────────────────────────────────────────────────────────────────
# Demo 04: Multi-Turn Sessions — stub
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/api/demo-04/chat/stream", tags=["Demo 04"])
async def demo04_chat_stream():
    async def _stub():
        yield f"data: {json.dumps({'token': 'Demo 04 (Multi-Turn Sessions) — coming soon.'})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(_stub(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache"})


# ─────────────────────────────────────────────────────────────────────────────
# Demo 05: Memory & Persistence — stub
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/api/demo-05/chat/stream", tags=["Demo 05"])
async def demo05_chat_stream():
    async def _stub():
        yield f"data: {json.dumps({'token': 'Demo 05 (Memory & Persistence) — coming soon.'})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(_stub(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache"})


# ─────────────────────────────────────────────────────────────────────────────
# Demo 06: Medical Report Analysis — Azure Content Understanding
# ─────────────────────────────────────────────────────────────────────────────

_MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB


@router.get("/api/demo-06/config", tags=["Demo 06"])
async def demo06_config():
    """Return the list of analyzer IDs configured in CONTENT_UNDERSTANDING_ANALYZER_IDS."""
    ids = settings.content_understanding_analyzer_ids
    return {"analyzer_ids": ids, "default_analyzer_id": ids[0] if ids else ""}


@router.post("/api/demo-06/analyze", tags=["Demo 06"])
async def demo06_analyze(
    file: UploadFile = File(...),
    analyzer_id: str = Form(...),
):
    if file.content_type not in ("application/pdf",):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_bytes = await file.read()
    if len(file_bytes) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 20 MB limit.")

    try:
        result = await demo06_content_understanding_service.analyze(
            file_bytes, file.filename or "document.pdf", analyzer_id
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {"result": result, "filename": file.filename, "analyzer_id": analyzer_id}


# ─────────────────────────────────────────────────────────────────────────────
# Demo 07: Contract Comparison — Blob upload + Azure Content Understanding
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/api/demo-07/config", tags=["Demo 07"])
async def demo07_config():
    """Return the list of available contract analyzers."""
    return {"analyzers": demo07_contract_comparison_service.ANALYZERS}


@router.post("/api/demo-07/upload-and-start-analyze", tags=["Demo 07"])
async def demo07_upload_and_start_analyze(
    file: UploadFile = File(...),
    analyzer_name: str = Form(...),
):
    """
    Upload contract PDF to Azure Blob Storage, then start a Content Understanding
    analysis job. Returns the initial response which includes a resultId for polling.
    """
    if file.content_type not in ("application/pdf",):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_bytes = await file.read()
    if len(file_bytes) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 20 MB limit.")

    if not analyzer_name:
        raise HTTPException(status_code=400, detail="analyzer_name is required.")

    try:
        result = await demo07_contract_comparison_service.upload_and_start_analyze(
            file_bytes, file.filename or "contract.pdf", analyzer_name
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return result


@router.get("/api/demo-07/result/{result_id}", tags=["Demo 07"])
async def demo07_get_result(result_id: str):
    """Poll for the result of a previously started contract analysis."""
    try:
        result = await demo07_contract_comparison_service.get_analysis_result(result_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return result


# ─────────────────────────────────────────────────────────────────────────────
# Demo 08: PDF Entity Extractor — Docling + MS Agent (LLM only, no Content Understanding)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/api/demo-08/extract", tags=["Demo 08"])
async def demo08_extract(
    file: UploadFile = File(...),
    model: str = Form(default=""),
):
    if file.content_type not in ("application/pdf",):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_bytes = await file.read()
    if len(file_bytes) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 20 MB limit.")

    use_model = model.strip() or settings.default_model
    filename = file.filename or "document.pdf"

    async def _stream():
        try:
            async for event in demo08_entity_extractor_service.stream_extract_entities(
                file_bytes, filename, use_model
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─────────────────────────────────────────────────────────────────────────────
# Demo 09: Document Q&A Agent — PDF attachment + hosted FoundryAgent (streaming)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/api/demo-09/chat", tags=["Demo 09"])
async def demo09_chat(
    file: UploadFile = File(...),
    question: str = Form(...),
    agent_name: str = Form(default=""),
):
    if file.content_type not in ("application/pdf",):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_bytes = await file.read()
    if len(file_bytes) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 20 MB limit.")

    if not question.strip():
        raise HTTPException(status_code=400, detail="A question is required.")

    use_agent = agent_name.strip() or settings.foundry_agent_name
    if not use_agent:
        raise HTTPException(status_code=400, detail="No agent name configured.")

    filename = file.filename or "document.pdf"

    async def _stream():
        try:
            async for event in demo09_document_agent_service.stream_document_agent(
                file_bytes, filename, question, use_agent
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─────────────────────────────────────────────────────────────────────────────
# Demo 10: Document Layout Parser — LiteParse (local, Rust-powered, spatial)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/api/demo-10/parse", tags=["Demo 10"])
async def demo10_parse(
    file: UploadFile = File(...),
    model: str = Form(default=""),
    summarize: str = Form(default="false"),
):
    if file.content_type not in ("application/pdf",):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_bytes = await file.read()
    if len(file_bytes) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 20 MB limit.")

    use_model = model.strip() or settings.default_model
    filename = file.filename or "document.pdf"
    do_summarize = summarize.strip().lower() == "true"

    async def _stream():
        try:
            async for event in demo10_liteparse_service.stream_parse(
                file_bytes, filename, use_model, do_summarize
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─────────────────────────────────────────────────────────────────────────────
# Demo 10B: LiteParse → Foundry hosted agent — PDF attachment + agent by name
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/api/demo-10b/chat", tags=["Demo 10B"])
async def demo10b_chat(
    file: UploadFile = File(...),
    question: str = Form(...),
    agent_name: str = Form(default=""),
):
    if file.content_type not in ("application/pdf",):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_bytes = await file.read()
    if len(file_bytes) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 20 MB limit.")

    if not question.strip():
        raise HTTPException(status_code=400, detail="A question is required.")

    use_agent = agent_name.strip() or settings.foundry_agent_name
    if not use_agent:
        raise HTTPException(status_code=400, detail="No agent name configured.")

    filename = file.filename or "document.pdf"

    async def _stream():
        try:
            async for event in demo10b_liteparse_agent_service.stream_liteparse_agent(
                file_bytes, filename, question, use_agent
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─────────────────────────────────────────────────────────────────────────────
# Demo 11: In-Memory PDF Q&A — Chunked RAG with MS Agent Framework
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/api/demo-11/index", tags=["Demo 11"])
async def demo11_index(
    file: UploadFile = File(...),
):
    if file.content_type not in ("application/pdf",):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_bytes = await file.read()
    if len(file_bytes) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 20 MB limit.")

    filename = file.filename or "document.pdf"

    async def _stream():
        try:
            async for event in demo11_inmemory_rag_service.stream_index(file_bytes, filename):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/api/demo-11/ask", tags=["Demo 11"])
async def demo11_ask(
    session_id: str = Form(...),
    question: str = Form(...),
    model: str = Form(default=""),
):
    if not session_id.strip():
        raise HTTPException(status_code=400, detail="session_id is required.")
    if not question.strip():
        raise HTTPException(status_code=400, detail="A question is required.")

    use_model = model.strip() or settings.default_model

    async def _stream():
        try:
            async for event in demo11_inmemory_rag_service.stream_ask(
                session_id, question, use_model
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─────────────────────────────────────────────────────────────────────────────
# Demo 12: Agent Grounded with AI Search — managed RAG over an existing index
# ─────────────────────────────────────────────────────────────────────────────

class Demo12Request(BaseModel):
    message: str
    model: str = settings.default_model
    system_prompt: str = ""


@router.get("/api/demo-12/config", tags=["Demo 12"])
async def demo12_config():
    configured = bool(
        settings.foundry_project_endpoint
        and settings.azure_ai_search_connection_id
        and settings.azure_ai_search_index
    )
    return {
        "configured": configured,
        "index_name": settings.azure_ai_search_index,
        "query_type": settings.azure_ai_search_query_type,
        "top_k": settings.azure_ai_search_top_k,
    }


@router.post("/api/demo-12/chat/stream", tags=["Demo 12"])
async def demo12_chat_stream(request: Demo12Request):
    system_prompt = request.system_prompt.strip() or None

    async def _stream():
        citations: list = []
        try:
            async for event in demo12_ai_search_agent_service.stream(
                request.message, request.model, system_prompt
            ):
                if isinstance(event, dict):
                    citations = event.get("citations", citations)
                    continue
                yield f"data: {json.dumps({'token': event})}\n\n"

            # Render harvested sources as a markdown footer so they're visible
            # even without any frontend citation rendering.
            if citations:
                footer = "\n\n**Sources:**\n" + "\n".join(
                    f"- [{c['title']}]({c['url']})" if c.get("url") else f"- {c['title']}"
                    for c in citations
                )
                yield f"data: {json.dumps({'token': footer})}\n\n"

            yield f"data: {json.dumps({'done': True, 'citations': citations})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─────────────────────────────────────────────────────────────────────────────
# Demo 14: MAF Agent + Claude Model — same agent wrapper, Claude as the model
# ─────────────────────────────────────────────────────────────────────────────

class Demo14Request(BaseModel):
    # This demo always runs the configured Claude model (CLAUDE_MODEL), so it
    # intentionally has no `model` field — the global model dropdown does not
    # apply here. Any extra fields the frontend sends (model, history) are ignored.
    message: str
    system_prompt: str = ""


@router.get("/api/demo-14/config", tags=["Demo 14"])
async def demo14_config():
    return {
        "configured": bool(settings.foundry_project_endpoint and settings.claude_model),
        "model": settings.claude_model,
    }


@router.post("/api/demo-14/chat/stream", tags=["Demo 14"])
async def demo14_chat_stream(request: Demo14Request):
    system_prompt = request.system_prompt.strip() or None

    async def _stream():
        try:
            async for token in demo14_claude_agent_service.stream(
                request.message, system_prompt
            ):
                yield f"data: {json.dumps({'token': token})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─────────────────────────────────────────────────────────────────────────────
# Demo 13: MAF Agent + MCP Tool Call — agent calls a remote MCP server
# ─────────────────────────────────────────────────────────────────────────────

class Demo13Request(BaseModel):
    message: str
    model: str = settings.default_model
    system_prompt: str = ""


@router.get("/api/demo-13/config", tags=["Demo 13"])
async def demo13_config():
    return {
        "configured": bool(settings.foundry_project_endpoint and settings.mcp_server_url),
        "mcp_server_url": settings.mcp_server_url,
        "mcp_server_label": settings.mcp_server_label,
    }


@router.post("/api/demo-13/chat/stream", tags=["Demo 13"])
async def demo13_chat_stream(request: Demo13Request):
    system_prompt = request.system_prompt.strip() or None

    async def _stream():
        tools_used: list = []
        try:
            async for event in demo13_mcp_agent_service.stream(
                request.message, request.model, system_prompt
            ):
                if isinstance(event, dict):
                    if "tool_call" in event:
                        # Emit as a distinct (non-token) SSE event so the frontend
                        # renders it as a styled tool-call badge, not inline text.
                        yield f"data: {json.dumps({'tool_call': event['tool_call']})}\n\n"
                    elif "tools_used" in event:
                        tools_used = event.get("tools_used", tools_used)
                    continue
                yield f"data: {json.dumps({'token': event})}\n\n"

            yield f"data: {json.dumps({'done': True, 'tools_used': tools_used})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
