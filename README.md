# AI Innovation Workbench

Interactive demo platform showcasing **Microsoft Azure AI Agent Framework** capabilities through 15 hands-on demos. Each demo runs real code against Azure AI Foundry and shows its own source in the side-by-side code panel.

## Quick Start

### 1. Configure Azure AI credentials

```powershell
Copy-Item backend/.env.template backend/.env
notepad backend/.env   # Fill in FOUNDRY_PROJECT_ENDPOINT and FOUNDRY_API_KEY
```

### 2. Install backend dependencies

```powershell
pip install -r backend/requirements.txt
```

### 3. Build the frontend

```powershell
cd frontend
npm install
npm run build
cd ..
```

### 4. Start the application

```powershell
.\start.ps1
```

Open **http://localhost:8000** — both the API and the React app are served from one port.

---

## Development Mode (hot reload)

```powershell
.\start-dev.ps1
```

- Backend auto-reloads on Python changes: **http://localhost:8000**
- Frontend hot-reloads on TypeScript changes: **http://localhost:5173**

---

## The 15 Demos

| # | Demo | Concept |
|---|------|---------|
| 01 | Chat Completion | FoundryChatClient, streaming SSE, file upload (Docling + Vision) |
| 02 | Foundry Agents | AIProjectClient, hosted agents, threads, create_and_process_run |
| 03 | Function Tools | @tool decorator, JSON schema, tool-calling loop |
| 04 | Multi-Turn Sessions | AgentSession, server-side history, session lifecycle |
| 05 | Memory & Persistence | ContextProvider, memory injection, "remember that" |
| 06 | Advanced Streaming | Named SSE events, section progress, timing metadata |
| 07 | Structured Output | Pydantic schemas, JSON mode, data extraction |
| 08 | MCP Tools | MCP protocol client, tool discovery, routing |
| 09 | Agent as Tool | Orchestrator + specialists, dynamic delegation |
| 10 | Middleware | Request pipeline, PII detection, guardrails, output filter |
| 11 | A2A Protocol | AgentCard, A2ATask, agent registry, delegation |
| 12 | Sequential Workflow | Pipeline stages, context passing, content + code review |
| 13 | Parallel Workflow | asyncio.gather(), parallel agents, synthesis |
| 14 | Custom BaseAgent | BaseAgent ABC, ReActAgent, reasoning traces |
| 15 | Agent as MCP Server | JSON-RPC 2.0, tools/list, tools/call, resources |

---

## Architecture

```
Single port (8000)
├── FastAPI backend  →  /api/*
│   ├── 15 demo routes    backend/routes/demo01_chat.py … demo15_mcp_server.py
│   ├── Shared services   backend/services/foundry_client.py, document_processor.py
│   ├── Config            backend/config.py  (reads .env)
│   └── Static serving    frontend/dist/
└── React frontend  →  /*
    ├── Sidebar           15 demos in 5 categories
    ├── ChatPanel         streaming chat UI
    ├── CodePanel         live source code viewer (Prism.js)
    └── SettingsPanel     model, system prompt, API key, processing mode
```

## Environment Variables

See `backend/.env.template` for the full list. Required:

```env
FOUNDRY_PROJECT_ENDPOINT=https://your-project.services.ai.azure.com
FOUNDRY_API_KEY=your-api-key-here
DEMO_API_KEY=demo-key-12345        # sent as X-API-Key header from the frontend
```
