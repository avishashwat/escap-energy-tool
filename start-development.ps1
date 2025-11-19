# ESCAP Development Environment Startup Script
# This script ensures both frontend and backend run reliably

Write-Host "🚀 ESCAP Development Environment Starting..." -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Yellow

# Stop any existing Node processes
Write-Host "🧹 Cleaning up existing processes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 2

# Set working directory
Set-Location "h:\Agriculture and Energy Tool\New folder"

Write-Host "✅ Starting Backend Server..." -ForegroundColor Green
# Start backend in a new PowerShell window
$backendJob = Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location 'h:\Agriculture and Energy Tool\New folder\backend'; Write-Host '🟢 Backend Server Starting...' -ForegroundColor Green; node server.js"
) -PassThru

Start-Sleep 3

Write-Host "✅ Starting Frontend Server..." -ForegroundColor Green
# Start frontend in another new PowerShell window  
$frontendJob = Start-Process powershell -ArgumentList @(
    "-NoExit", 
    "-Command",
    "Set-Location 'h:\Agriculture and Energy Tool\New folder'; Write-Host '🟢 Frontend Server Starting...' -ForegroundColor Green; npm run dev"
) -PassThru

Start-Sleep 5

# Test services
Write-Host "🔍 Testing Services..." -ForegroundColor Yellow

# First check if GeoServer is running (should be started separately)
try {
    $geoserver = Invoke-WebRequest -Uri http://localhost:8081/geoserver -Method Head -TimeoutSec 5
    Write-Host "✅ GeoServer (8081): RUNNING - $($geoserver.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "❌ GeoServer (8081): NOT RUNNING" -ForegroundColor Red
    Write-Host "🔄 Attempting to restart GeoServer container..." -ForegroundColor Yellow
    try {
        docker restart escap_geoserver | Out-Null
        Start-Sleep 10
        $geoserver_retry = Invoke-WebRequest -Uri http://localhost:8081/geoserver -Method Head -TimeoutSec 10
        Write-Host "✅ GeoServer restarted successfully!" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Please start GeoServer manually: docker start escap_geoserver" -ForegroundColor Yellow
    }
}

try {
    $backend = Invoke-WebRequest -Uri http://localhost:5000/health -TimeoutSec 5
    Write-Host "✅ Backend (5000): RUNNING - $($backend.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend (5000): FAILED" -ForegroundColor Red
}

try {
    $frontend = Invoke-WebRequest -Uri http://127.0.0.1:3000 -Method Head -TimeoutSec 5
    Write-Host "✅ Frontend (3000): RUNNING - $($frontend.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "❌ Frontend (3000): FAILED" -ForegroundColor Red
}

try {
    $geoserverApi = Invoke-WebRequest -Uri http://localhost:5000/api/geoserver -TimeoutSec 5
    Write-Host "✅ GeoServer API: RUNNING - $($geoserverApi.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "❌ GeoServer API: FAILED" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎯 ACCESS YOUR APPLICATION:" -ForegroundColor Cyan
Write-Host "   Frontend: http://127.0.0.1:3000" -ForegroundColor White
Write-Host "   Backend:  http://localhost:5000" -ForegroundColor White
Write-Host "   GeoServer: http://localhost:8081/geoserver" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Frontend & Backend are running in separate windows" -ForegroundColor Yellow
Write-Host "💡 Close those windows to stop the servers" -ForegroundColor Yellow
Write-Host "⚠️  Make sure GeoServer is running before uploading files" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to exit this status window..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")