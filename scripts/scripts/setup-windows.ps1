# PowerShell script for Windows setup
Write-Host "🚀 Setting up ESCAP Climate Risk Infrastructure on Windows..." -ForegroundColor Green
Write-Host "================================================="

# Check if Docker is running
try {
    docker version | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Create directory structure using PowerShell
Write-Host "📁 Creating directory structure..." -ForegroundColor Cyan

$directories = @(
    "data",
    "data\uploads", 
    "data\cog",
    "data\processed",
    "data\shapefiles",
    "data\boundaries",
    "logs"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  ✓ Created $dir" -ForegroundColor Green
    } else {
        Write-Host "  ✓ $dir already exists" -ForegroundColor Yellow
    }
}

Write-Host "✅ Directory structure created" -ForegroundColor Green

# Set permissions (Windows equivalent - grant full control to current user)
Write-Host "🔒 Setting permissions..." -ForegroundColor Cyan
try {
    icacls data /grant "$env:USERNAME:(OI)(CI)F" /T | Out-Null
    icacls logs /grant "$env:USERNAME:(OI)(CI)F" /T | Out-Null
    Write-Host "✅ Permissions set" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Could not set permissions, but continuing..." -ForegroundColor Yellow
}

# Pull and build Docker images
Write-Host "📦 Pulling and building Docker images..." -ForegroundColor Cyan
try {
    docker-compose pull
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️ Some images failed to pull, trying to build anyway..." -ForegroundColor Yellow
    }
    
    docker-compose build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to build Docker images" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "✅ Docker images built successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to build Docker images" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Start the infrastructure
Write-Host "🚀 Starting infrastructure..." -ForegroundColor Cyan
try {
    docker-compose up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to start infrastructure" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "✅ Infrastructure started successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to start infrastructure" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Wait for services to initialize
Write-Host "⏳ Waiting for services to initialize..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

# Check service health
Write-Host "🔍 Checking service health..." -ForegroundColor Cyan
docker-compose ps

Write-Host ""
Write-Host "✅ Setup complete! Your infrastructure is running." -ForegroundColor Green
Write-Host ""
Write-Host "📱 Access points:" -ForegroundColor Cyan
Write-Host "  - Main App: http://localhost:3000" -ForegroundColor White
Write-Host "  - Admin Panel: http://localhost:3000?admin=true" -ForegroundColor White
Write-Host "  - GeoServer: http://localhost:8080/geoserver (admin/geoserver_admin_2024)" -ForegroundColor White
Write-Host "  - PostGIS: localhost:5432 (escap_user/escap_password_2024)" -ForegroundColor White
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Open http://localhost:3000 to access your app" -ForegroundColor White
Write-Host "  2. Use admin panel to upload your first dataset" -ForegroundColor White
Write-Host "  3. Check logs with: docker-compose logs -f" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to exit"