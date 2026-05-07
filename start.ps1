# AI Innovation Workbench — Start Script (PowerShell)
# Starts the FastAPI backend. Frontend must be built first.
#
# FIRST TIME SETUP:
#   1. Copy backend/.env.template to backend/.env and fill in your Azure AI values
#   2. pip install -r backend/requirements.txt
#   3. cd frontend && npm install && npm run build && cd ..
#   4. .\start.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# Check .env exists
if (-not (Test-Path "$root\backend\.env")) {
    Write-Host "ERROR: backend/.env not found." -ForegroundColor Red
    Write-Host "Copy backend/.env.template to backend/.env and fill in your Azure AI credentials." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "  AI Innovation Workbench" -ForegroundColor Cyan
Write-Host "  Starting FastAPI backend on http://localhost:8000" -ForegroundColor Cyan
Write-Host ""

# Change to project root so relative paths work
Set-Location $root

# Start uvicorn
uvicorn backend.main:app --port 8000 --reload --host 0.0.0.0
