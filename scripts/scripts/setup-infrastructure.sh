#!/bin/bash

# UN ESCAP Geospatial Infrastructure Setup Script
# This script sets up PostGIS, GeoServer, and processing services

set -e

echo "🌍 UN ESCAP Geospatial Infrastructure Setup"
echo "============================================"

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is required but not installed"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is required but not installed"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p data/{boundaries,climate,giri,energy}
mkdir -p temp
mkdir -p logs
mkdir -p config

# Generate secure passwords
echo "🔐 Generating secure passwords..."
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
GEOSERVER_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

# Create environment file
echo "⚙️ Creating environment configuration..."
cat > .env << EOF
# Database Configuration
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=un_escap_gis
POSTGRES_USER=postgres

# GeoServer Configuration
GEOSERVER_PASSWORD=${GEOSERVER_PASSWORD}
GEOSERVER_USER=admin
GEOSERVER_WORKSPACE=un_escap

# Application Configuration
NODE_ENV=production
CORS_ORIGIN=http://localhost:3000

# Resource Limits
POSTGIS_MEMORY=2GB
GEOSERVER_MEMORY=4GB
PROCESSING_WORKERS=4

# Ports
POSTGIS_PORT=5432
GEOSERVER_PORT=8080
PROCESSING_PORT=8000
WEBSOCKET_PORT=3001
EOF

echo "📝 Environment file created with secure passwords"

# Create Docker Compose file
echo "🐳 Creating Docker Compose configuration..."
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgis:
    image: postgis/postgis:15-3.3
    container_name: un_escap_postgis
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_INITDB_ARGS: "--encoding=UTF-8 --lc-collate=C --lc-ctype=C"
    ports:
      - "${POSTGIS_PORT}:5432"
    volumes:
      - postgis_data:/var/lib/postgresql/data
      - ./config/postgresql.conf:/etc/postgresql/postgresql.conf
      - ./logs/postgis:/var/log/postgresql
    networks:
      - geospatial_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  geoserver:
    image: kartoza/geoserver:2.23.0
    container_name: un_escap_geoserver
    restart: unless-stopped
    environment:
      GEOSERVER_ADMIN_PASSWORD: ${GEOSERVER_PASSWORD}
      GEOSERVER_ADMIN_USER: ${GEOSERVER_USER}
      INITIAL_MEMORY: 2G
      MAXIMUM_MEMORY: ${GEOSERVER_MEMORY}
      POSTGRES_HOST: postgis
      POSTGRES_PORT: 5432
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASS: ${POSTGRES_PASSWORD}
      GEOSERVER_DATA_DIR: /opt/geoserver/data_dir
      ENABLE_JSONP: true
      MAX_FILTER_RULES: 20
      OPTIMIZE_LINE_WIDTH: false
    ports:
      - "${GEOSERVER_PORT}:8080"
    volumes:
      - geoserver_data:/opt/geoserver/data_dir
      - ./data:/opt/data
      - ./logs/geoserver:/opt/geoserver/logs
    depends_on:
      postgis:
        condition: service_healthy
    networks:
      - geospatial_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/geoserver/rest/about/version.json"]
      interval: 30s
      timeout: 10s
      retries: 3

  processing:
    build:
      context: ./processing
      dockerfile: Dockerfile
    container_name: un_escap_processing
    restart: unless-stopped
    environment:
      POSTGRES_HOST: postgis
      POSTGRES_PORT: 5432
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      GEOSERVER_URL: http://geoserver:8080/geoserver
      GEOSERVER_USER: ${GEOSERVER_USER}
      GEOSERVER_PASSWORD: ${GEOSERVER_PASSWORD}
      WORKERS: ${PROCESSING_WORKERS}
      MAX_CONCURRENT_JOBS: 5
    ports:
      - "${PROCESSING_PORT}:8000"
    volumes:
      - ./data:/app/data
      - ./temp:/app/temp
      - ./logs/processing:/app/logs
    depends_on:
      postgis:
        condition: service_healthy
      geoserver:
        condition: service_healthy
    networks:
      - geospatial_network

  websocket:
    build:
      context: ./websocket
      dockerfile: Dockerfile
    container_name: un_escap_websocket
    restart: unless-stopped
    environment:
      NODE_ENV: ${NODE_ENV}
      CORS_ORIGIN: ${CORS_ORIGIN}
      PORT: 3001
    ports:
      - "${WEBSOCKET_PORT}:3001"
    volumes:
      - ./logs/websocket:/app/logs
    networks:
      - geospatial_network

  nginx:
    image: nginx:alpine
    container_name: un_escap_nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./config/nginx.conf:/etc/nginx/nginx.conf
      - ./config/ssl:/etc/nginx/ssl
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - geoserver
      - processing
      - websocket
    networks:
      - geospatial_network

volumes:
  postgis_data:
    driver: local
  geoserver_data:
    driver: local

networks:
  geospatial_network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
EOF

# Create processing service
echo "🔧 Setting up processing service..."
mkdir -p processing

cat > processing/Dockerfile << 'EOF'
FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gdal-bin \
    libgdal-dev \
    libspatialindex-dev \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV GDAL_CONFIG=/usr/bin/gdal-config
ENV CPLUS_INCLUDE_PATH=/usr/include/gdal
ENV C_INCLUDE_PATH=/usr/include/gdal

WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/logs /app/temp /app/data

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Start application
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
EOF

cat > processing/requirements.txt << 'EOF'
fastapi==0.104.1
uvicorn[standard]==0.24.0
GDAL==3.6.2
rasterio==1.3.9
geopandas==0.14.1
psycopg2-binary==2.9.9
requests==2.31.0
celery==5.3.4
redis==5.0.1
numpy==1.24.3
pandas==2.0.3
shapely==2.0.1
fiona==1.9.4
pyproj==3.6.0
aiofiles==23.2.1
python-multipart==0.0.6
Pillow==10.0.1
EOF

# Create WebSocket service
echo "🌐 Setting up WebSocket service..."
mkdir -p websocket

cat > websocket/Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p /app/logs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start application
CMD ["node", "server.js"]
EOF

cat > websocket/package.json << 'EOF'
{
  "name": "un-escap-websocket",
  "version": "1.0.0",
  "description": "Real-time collaboration server for UN ESCAP platform",
  "main": "server.js",
  "dependencies": {
    "socket.io": "^4.7.4",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "winston": "^3.11.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Create configuration files
echo "⚙️ Creating configuration files..."

# PostgreSQL configuration
cat > config/postgresql.conf << 'EOF'
# UN ESCAP PostGIS Configuration
# Memory settings
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 256MB
maintenance_work_mem = 512MB

# Connection settings
max_connections = 200
shared_preload_libraries = 'postgis-3'

# Performance tuning
random_page_cost = 1.1
effective_io_concurrency = 200
max_worker_processes = 8
max_parallel_workers_per_gather = 4
max_parallel_workers = 8

# WAL settings
wal_buffers = 16MB
checkpoint_completion_target = 0.9
wal_compression = on

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_min_duration_statement = 1000

# Autovacuum
autovacuum = on
autovacuum_max_workers = 3
autovacuum_naptime = 1min

# PostGIS specific
shared_preload_libraries = 'postgis-3'
max_locks_per_transaction = 256
EOF

# Nginx configuration
cat > config/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Logging
    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                     '$status $body_bytes_sent "$http_referer" '
                     '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;
    error_log   /var/log/nginx/error.log   warn;

    # Basic settings
    sendfile        on;
    tcp_nopush      on;
    tcp_nodelay     on;
    keepalive_timeout  65;
    types_hash_max_size 2048;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    # Upstream servers
    upstream geoserver {
        server geoserver:8080;
    }

    upstream processing {
        server processing:8000;
    }

    upstream websocket {
        server websocket:3001;
    }

    server {
        listen 80;
        server_name localhost;

        # API endpoints
        location /api/processing/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://processing/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # GeoServer
        location /geoserver/ {
            proxy_pass http://geoserver/geoserver/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Enable CORS
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
            add_header Access-Control-Allow-Headers "Origin, Content-Type, Accept, Authorization";
        }

        # WebSocket
        location /socket.io/ {
            proxy_pass http://websocket;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health checks
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
EOF

# Create startup scripts
echo "🚀 Creating startup scripts..."

cat > start.sh << 'EOF'
#!/bin/bash

echo "🌍 Starting UN ESCAP Geospatial Infrastructure..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please run setup.sh first."
    exit 1
fi

# Start services
echo "🐳 Starting Docker services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 30

# Check service health
echo "🔍 Checking service health..."
docker-compose ps

echo "✅ Infrastructure started successfully!"
echo ""
echo "📊 Service URLs:"
echo "   PostGIS:    localhost:5432"
echo "   GeoServer:  http://localhost:8080/geoserver"
echo "   Processing: http://localhost:8000"
echo "   WebSocket:  http://localhost:3001"
echo ""
echo "🔐 Login credentials saved in .env file"
EOF

cat > stop.sh << 'EOF'
#!/bin/bash

echo "🛑 Stopping UN ESCAP Geospatial Infrastructure..."

# Stop all services
docker-compose down

echo "✅ Infrastructure stopped successfully!"
EOF

cat > logs.sh << 'EOF'
#!/bin/bash

# Follow logs for all services
docker-compose logs -f
EOF

# Make scripts executable
chmod +x start.sh stop.sh logs.sh

echo ""
echo "✅ Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Run './start.sh' to start the infrastructure"
echo "   2. Access GeoServer at http://localhost:8080/geoserver"
echo "   3. Use credentials from .env file to login"
echo "   4. Configure data stores and publish layers"
echo ""
echo "🔧 Useful commands:"
echo "   ./start.sh  - Start all services"
echo "   ./stop.sh   - Stop all services"
echo "   ./logs.sh   - View logs"
echo ""
echo "📁 Passwords saved in .env file - keep it secure!"

echo ""
echo "🔐 Generated Passwords:"
echo "   PostGIS:   ${POSTGRES_PASSWORD}"
echo "   GeoServer: ${GEOSERVER_PASSWORD}"