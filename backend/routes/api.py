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
    """Return the server-side default analyzer ID so the frontend can pre-select it."""
    return {"default_analyzer_id": settings.content_understanding_analyzer_id}


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
