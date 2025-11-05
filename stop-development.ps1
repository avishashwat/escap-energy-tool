# ESCAP Development Environment Cleanup Script
# This script stops all development servers

Write-Host "🛑 ESCAP Development Environment Cleanup..." -ForegroundColor Red
Write-Host "=======================================" -ForegroundColor Yellow

# Stop all Node processes
Write-Host "🧹 Stopping all Node.js processes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force

# Stop PM2 if running
Write-Host "🧹 Stopping PM2 processes..." -ForegroundColor Yellow
try {
    pm2 delete all 2>$null
    pm2 kill 2>$null
} catch {
    # PM2 not running or installed
}

Write-Host "✅ All development servers stopped" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")