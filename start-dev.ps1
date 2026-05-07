# AI Innovation Workbench — Development Mode
# Runs FastAPI + Vite dev server simultaneously (hot reload on both sides)
#
# USAGE: .\start-dev.ps1
# Opens:
#   Backend API:   http://localhost:8000/api/docs
#   Frontend dev:  http://localhost:5173

$root = $PSScriptRoot

if (-not (Test-Path "$root\backend\.env")) {
    Write-Host "ERROR: backend/.env not found. Copy from backend/.env.template" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  AI Innovation Workbench — Dev Mode" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:5173  (Vite dev server with hot reload)" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop both servers" -ForegroundColor Yellow
Write-Host ""

Set-Location $root

# Start backend in background job
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:root
    uvicorn backend.main:app --port 8000 --reload
}

# Start frontend dev server
Set-Location "$root\frontend"
try {
    npm run dev
} finally {
    # Clean up backend job on exit
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -ErrorAction SilentlyContinue
    Set-Location $root
}
