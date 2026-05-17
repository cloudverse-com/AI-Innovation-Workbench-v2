# AI Innovation Workbench — Developer Setup Guide

## Prerequisites (install before cloning)

**1. Python 3.11+**
Download from https://python.org/downloads
During install, check **"Add Python to PATH"**
Verify: `python --version`

**2. Node.js 18+ (LTS)**
Download from https://nodejs.org
Verify: `node --version` and `npm --version`

**3. Git**
Download from https://git-scm.com
Verify: `git --version`

**4. PowerShell 5.1+** — already included on Windows 10/11, no action needed.

---

## Step 1 — Clone the repository

```powershell
git clone <REPO_URL>
cd AI-Innovation-Workbench-v2
```

---

## Step 2 — Configure environment variables

```powershell
Copy-Item backend\.env.template backend\.env
notepad backend\.env
```

Fill in these values in `.env` (get them from the team):

```env
FOUNDRY_PROJECT_ENDPOINT=https://<your-project>.services.ai.azure.com/api/projects/<project-name>
FOUNDRY_API_KEY=<your-azure-ai-foundry-api-key>
FOUNDRY_AGENT_NAME=<your-agent-id>          # e.g. asst_xxxx
DEFAULT_MODEL=gpt-5
AVAILABLE_MODELS=gpt-5,gpt-5.4
DEMO_API_KEY=demo-key-12345                 # keep as-is for local dev
PORT=8000
```

> **Where to find Azure values:** Azure AI Foundry portal > Your Project > Overview (endpoint) and Settings > API keys

---

## Step 3 — Install Python dependencies

From the project root:

```powershell
pip install -r backend/requirements.txt
```

**What this installs:**

| Package | Purpose |
|---|---|
| `fastapi`, `uvicorn` | Web server |
| `agent-framework` | Microsoft Azure AI Agent SDK |
| `azure-identity` | Azure credential types |
| `python-dotenv` | Loads `.env` file |
| `pydantic` | Request/response validation |
| `docling`, `Pillow` | PDF/image processing (Demo 01) |
| `httpx`, `aiofiles`, `python-multipart` | Async HTTP & file handling |

> **Tip:** Use a virtual environment to avoid conflicts:
> ```powershell
> python -m venv .venv
> .venv\Scripts\Activate.ps1
> pip install -r backend/requirements.txt
> ```

---

## Step 4 — Build the frontend

```powershell
cd frontend
npm install
npm run build
cd ..
```

This compiles the React/TypeScript app into `frontend/dist/`, which FastAPI serves statically.

---

## Step 5 — Start the application

```powershell
.\start.ps1
```

Open **http://localhost:8000** — the full app (API + React UI) runs on one port.

---

## Development mode (hot reload)

For active development, use this instead of Step 5:

```powershell
.\start-dev.ps1
```

- Backend auto-reloads on Python changes → http://localhost:8000
- Frontend hot-reloads on TypeScript changes → http://localhost:5173

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `ERROR: backend/.env not found` | Re-run Step 2 |
| `uvicorn: command not found` | Run `pip install uvicorn` or activate your venv |
| `npm: command not found` | Node.js not in PATH — reinstall Node.js |
| Azure `401 Unauthorized` | Check `FOUNDRY_API_KEY` in `.env` |
| `ModuleNotFoundError: agent_framework` | Run `pip install agent-framework` (may need internal feed access — ask the team) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11+, FastAPI, Azure AI Foundry SDK (`agent-framework`) |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Serving | Single port 8000 (production) · ports 8000 + 5173 (dev mode) |
