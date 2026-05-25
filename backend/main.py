"""
AI Innovation Workbench — FastAPI Entry Point
=============================================
Starts the entire application:
- Serves all /api/* routes (5 demos + config endpoints)
- Serves the React frontend build as static files
- Handles API key authentication
- Runs with: uvicorn backend.main:app --port 8000 --reload
"""

import os
import json
from pathlib import Path

from fastapi import FastAPI, HTTPException, Security, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, JSONResponse
from fastapi.security import APIKeyHeader
from fastapi.staticfiles import StaticFiles

from backend.config import settings

from backend.routes.api import router as demo_router

# ─────────────────────────────────────────────────────────────────────────────
# Application
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="AI Innovation Workbench",
    description="Interactive demos showcasing Microsoft Agent Framework capabilities",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────────────
# API key auth
# ─────────────────────────────────────────────────────────────────────────────
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str = Security(api_key_header)):
    if not api_key or api_key != settings.demo_api_key:
        raise HTTPException(
            status_code=403,
            detail="Invalid or missing API key. Provide X-API-Key header.",
        )
    return api_key


# ─────────────────────────────────────────────────────────────────────────────
# Demo routers
# ─────────────────────────────────────────────────────────────────────────────
app.include_router(demo_router)

# ─────────────────────────────────────────────────────────────────────────────
# Config endpoints (no auth — frontend needs these on load)
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/models")
async def get_models():
    return {
        "models": settings.available_models,
        "default": settings.default_model,
    }


@app.get("/api/system-prompts")
async def get_system_prompts():
    return {"system_prompts": settings.system_prompts}


@app.get("/api/health")
async def health_check():
    config_errors = settings.validate()
    return {
        "status": "ok",
        "version": "2.0.0",
        "config_errors": config_errors,
        "foundry_configured": len(config_errors) == 0,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Code viewer endpoint
# ─────────────────────────────────────────────────────────────────────────────
DEMO_CODE_FILES = {
    "demo01": "backend/services/demo01_foundry_chat_service.py",
    "demo02": "backend/services/demo02_foundry_agent_service.py",
    "demo03": "backend/routes/api.py",
    "demo04": "backend/routes/api.py",
    "demo05": "backend/routes/api.py",
    "demo06": "backend/services/demo06_content_understanding_service.py",
    "demo07": "backend/services/demo07_contract_comparison_service.py",
    "demo08": "backend/services/demo08_entity_extractor_service.py",
    "demo09": "backend/services/demo09_document_agent_service.py",
    "config": "backend/config.py",
}


@app.get("/api/code/{demo_id}")
async def get_demo_code(demo_id: str):
    file_path = DEMO_CODE_FILES.get(demo_id)
    if not file_path:
        raise HTTPException(
            status_code=404,
            detail=f"No code file found for demo_id '{demo_id}'. "
                   f"Valid IDs: {list(DEMO_CODE_FILES.keys())}",
        )

    abs_path = Path(file_path)
    if not abs_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Source file not found at {file_path}",
        )

    content = abs_path.read_text(encoding="utf-8")
    return PlainTextResponse(content, media_type="text/plain")


# ─────────────────────────────────────────────────────────────────────────────
# React frontend
# ─────────────────────────────────────────────────────────────────────────────
FRONTEND_DIST = Path("frontend/dist")


@app.get("/")
async def serve_root():
    index_path = FRONTEND_DIST / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return JSONResponse(
        status_code=200,
        content={
            "message": "AI Innovation Workbench API is running.",
            "note": "Frontend not built. Run: cd frontend && npm install && npm run build",
            "api_docs": "/api/docs",
            "health": "/api/health",
        },
    )


if FRONTEND_DIST.exists():
    assets_path = FRONTEND_DIST / "assets"
    if assets_path.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")

    index_path = FRONTEND_DIST / "index.html"
    if index_path.exists():
        return FileResponse(index_path)

    return JSONResponse(
        status_code=404,
        content={"detail": f"Path /{full_path} not found. Build the frontend first."},
    )
