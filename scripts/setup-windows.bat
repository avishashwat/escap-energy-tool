@echo off
echo 🚀 Setting up ESCAP Climate Risk Infrastructure on Windows...
echo =================================================

REM Check if Docker is running
docker version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

echo ✅ Docker is running

REM Create directory structure with Windows-compatible commands
echo 📁 Creating directory structure...
if not exist "data" mkdir data
if not exist "data\uploads" mkdir data\uploads
if not exist "data\cog" mkdir data\cog
if not exist "data\processed" mkdir data\processed
if not exist "data\shapefiles" mkdir data\shapefiles
if not exist "data\boundaries" mkdir data\boundaries
if not exist "logs" mkdir logs

echo ✅ Directory structure created

REM Set permissions (Windows equivalent)
echo 🔒 Setting permissions...
icacls data /grant Users:F /T >nul 2>&1
icacls logs /grant Users:F /T >nul 2>&1

echo ✅ Permissions set

REM Pull and build Docker images
echo 📦 Pulling and building Docker images...
docker-compose pull
docker-compose build

if errorlevel 1 (
    echo ❌ Failed to build Docker images
    pause
    exit /b 1
)

echo ✅ Docker images built successfully

REM Start the infrastructure
echo 🚀 Starting infrastructure...
docker-compose up -d

if errorlevel 1 (
    echo ❌ Failed to start infrastructure
    pause
    exit /b 1
)

echo ✅ Infrastructure started successfully

REM Wait a moment for services to initialize
echo ⏳ Waiting for services to initialize...
timeout /t 10 /nobreak >nul

REM Check service health
echo 🔍 Checking service health...
docker-compose ps

echo.
echo ✅ Setup complete! Your infrastructure is running.
echo.
echo 📱 Access points:
echo   - Main App: http://localhost:3000
echo   - Admin Panel: http://localhost:3000?admin=true
echo   - GeoServer: http://localhost:8080/geoserver (admin/geoserver)
echo   - PostGIS: localhost:5432 (escap_climate/climate123)
echo.
echo 📋 Next steps:
echo   1. Open http://localhost:3000 to access your app
echo   2. Use admin panel to upload your first dataset
echo   3. Check logs with: docker-compose logs -f
echo.
echo Press any key to exit...
pause >nul