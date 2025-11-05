# Geospatial Infrastructure Setup Guide

## Overview
This guide walks through setting up the enhanced geospatial infrastructure for the UN ESCAP Climate & Energy Risk Visualization platform.

## Prerequisites

### System Requirements
- Docker and Docker Compose
- Node.js 18+ 
- Python 3.8+ with GDAL
- At least 8GB RAM for local development
- 50GB+ storage for datasets

### Required Services
1. **PostGIS Database** - Spatial data storage
2. **GeoServer** - Map tile serving
3. **Processing Service** - Data conversion pipeline
4. **WebSocket Server** - Real-time collaboration

## Installation Steps

### 1. PostGIS Setup

```bash
# Pull PostGIS Docker image
docker pull postgis/postgis:15-3.3

# Run PostGIS container
docker run --name un_escap_postgis \
  -e POSTGRES_DB=un_escap_gis \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=your_secure_password \
  -p 5432:5432 \
  -v postgis_data:/var/lib/postgresql/data \
  -d postgis/postgis:15-3.3
```

### 2. GeoServer Setup

```bash
# Pull GeoServer Docker image
docker pull kartoza/geoserver:2.23.0

# Run GeoServer container
docker run --name un_escap_geoserver \
  -e GEOSERVER_ADMIN_PASSWORD=your_admin_password \
  -e INITIAL_MEMORY=2G \
  -e MAXIMUM_MEMORY=4G \
  -p 8080:8080 \
  -v geoserver_data:/opt/geoserver/data_dir \
  -d kartoza/geoserver:2.23.0
```

### 3. Docker Compose Configuration

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgis:
    image: postgis/postgis:15-3.3
    container_name: un_escap_postgis
    environment:
      POSTGRES_DB: un_escap_gis
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgis_data:/var/lib/postgresql/data
    networks:
      - geospatial_network

  geoserver:
    image: kartoza/geoserver:2.23.0
    container_name: un_escap_geoserver
    environment:
      GEOSERVER_ADMIN_PASSWORD: ${GEOSERVER_PASSWORD}
      INITIAL_MEMORY: 2G
      MAXIMUM_MEMORY: 4G
      POSTGRES_HOST: postgis
      POSTGRES_PORT: 5432
      POSTGRES_DB: un_escap_gis
      POSTGRES_USER: postgres
      POSTGRES_PASS: ${POSTGRES_PASSWORD}
    ports:
      - "8080:8080"
    volumes:
      - geoserver_data:/opt/geoserver/data_dir
    depends_on:
      - postgis
    networks:
      - geospatial_network

  processing_service:
    build: 
      context: ./processing
      dockerfile: Dockerfile
    container_name: un_escap_processing
    environment:
      POSTGRES_HOST: postgis
      POSTGRES_DB: un_escap_gis
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      GEOSERVER_URL: http://geoserver:8080/geoserver
      GEOSERVER_USER: admin
      GEOSERVER_PASSWORD: ${GEOSERVER_PASSWORD}
    volumes:
      - ./data:/app/data
      - ./temp:/app/temp
    depends_on:
      - postgis
      - geoserver
    networks:
      - geospatial_network

  websocket_server:
    build:
      context: ./websocket
      dockerfile: Dockerfile
    container_name: un_escap_websocket
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: production
      CORS_ORIGIN: http://localhost:3000
    networks:
      - geospatial_network

volumes:
  postgis_data:
  geoserver_data:

networks:
  geospatial_network:
    driver: bridge
```

### 4. Processing Service

Create `processing/Dockerfile`:

```dockerfile
FROM python:3.9-slim

# Install GDAL and other dependencies
RUN apt-get update && apt-get install -y \
    gdal-bin \
    libgdal-dev \
    libspatialindex-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "app.py"]
```

Create `processing/requirements.txt`:

```text
fastapi==0.104.1
uvicorn==0.24.0
GDAL==3.6.2
rasterio==1.3.9
geopandas==0.14.1
psycopg2-binary==2.9.9
requests==2.31.0
celery==5.3.4
redis==5.0.1
```

Create `processing/app.py`:

```python
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import rasterio
import geopandas as gpd
from pathlib import Path
import subprocess
import os
import tempfile
import shutil

app = FastAPI(title="UN ESCAP Geospatial Processing Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/convert/tif-to-cog")
async def convert_tif_to_cog(file: UploadFile = File(...)):
    """Convert TIF to Cloud Optimized GeoTIFF"""
    if not file.filename.endswith('.tif'):
        raise HTTPException(400, "File must be a .tif file")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        input_path = Path(temp_dir) / file.filename
        output_path = Path(temp_dir) / f"{file.filename.replace('.tif', '_cog.tif')}"
        
        # Save uploaded file
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Convert to COG using GDAL
        cmd = [
            "gdal_translate",
            "-of", "COG",
            "-co", "COMPRESS=DEFLATE",
            "-co", "OVERVIEW_RESAMPLING=AVERAGE",
            str(input_path),
            str(output_path)
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            raise HTTPException(500, f"Conversion failed: {result.stderr}")
        
        return {"message": "Conversion successful", "output_file": output_path.name}

@app.post("/convert/shp-to-vector-tiles")
async def convert_shp_to_vector_tiles(file: UploadFile = File(...)):
    """Convert Shapefile to Vector Tiles"""
    if not file.filename.endswith('.zip'):
        raise HTTPException(400, "File must be a zipped shapefile")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        # Extract shapefile
        import zipfile
        zip_path = Path(temp_dir) / file.filename
        with open(zip_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
        
        # Find .shp file
        shp_files = list(Path(temp_dir).glob("*.shp"))
        if not shp_files:
            raise HTTPException(400, "No .shp file found in zip")
        
        shp_path = shp_files[0]
        
        # Convert to vector tiles using tippecanoe (if available)
        # For now, just validate the shapefile
        try:
            gdf = gpd.read_file(shp_path)
            return {
                "message": "Shapefile processed successfully",
                "features": len(gdf),
                "columns": list(gdf.columns),
                "bounds": gdf.total_bounds.tolist()
            }
        except Exception as e:
            raise HTTPException(500, f"Failed to process shapefile: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "processing"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### 5. WebSocket Server

Create `websocket/Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3001

CMD ["node", "server.js"]
```

Create `websocket/package.json`:

```json
{
  "name": "un-escap-websocket",
  "version": "1.0.0",
  "dependencies": {
    "socket.io": "^4.7.4",
    "express": "^4.18.2",
    "cors": "^2.8.5"
  }
}
```

Create `websocket/server.js`:

```javascript
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Track active connections
const connections = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Store connection info
  connections.set(socket.id, {
    id: socket.id,
    connectedAt: new Date(),
    lastActivity: new Date()
  });

  // Handle map view synchronization
  socket.on('map_view_change', (data) => {
    console.log('Map view change:', data);
    socket.broadcast.emit('sync_map_view', data);
    
    // Update last activity
    const conn = connections.get(socket.id);
    if (conn) {
      conn.lastActivity = new Date();
    }
  });

  // Handle layer changes
  socket.on('layer_change', (data) => {
    console.log('Layer change:', data);
    socket.broadcast.emit('sync_layer_change', data);
  });

  // Handle country selection
  socket.on('country_change', (data) => {
    console.log('Country change:', data);
    socket.broadcast.emit('sync_country_change', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    connections.delete(socket.id);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'websocket',
    connections: connections.size 
  });
});

// Connection stats endpoint
app.get('/stats', (req, res) => {
  res.json({
    activeConnections: connections.size,
    connections: Array.from(connections.values())
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});
```

### 6. Environment Configuration

Create `.env`:

```bash
POSTGRES_PASSWORD=your_secure_postgis_password
GEOSERVER_PASSWORD=your_secure_geoserver_password
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

### 7. Launch Services

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

## Post-Installation Configuration

### 1. GeoServer Setup
1. Access GeoServer at `http://localhost:8080/geoserver`
2. Login with `admin` / `your_geoserver_password`
3. Create workspace `un_escap`
4. Configure PostGIS datastore

### 2. PostGIS Setup
```sql
-- Connect to PostGIS database
-- Create necessary extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Create schemas for data organization
CREATE SCHEMA IF NOT EXISTS climate_data;
CREATE SCHEMA IF NOT EXISTS boundaries;
CREATE SCHEMA IF NOT EXISTS energy_infrastructure;
```

### 3. Performance Tuning

PostGIS configuration in `postgresql.conf`:
```
shared_preload_libraries = 'postgis-3'
max_connections = 200
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 256MB
```

GeoServer configuration:
```xml
<!-- data_dir/global.xml -->
<settings>
  <numDecimals value="6"/>
  <charset value="UTF-8"/>
  <proxyBaseUrl>http://your-domain.com/geoserver</proxyBaseUrl>
</settings>
```

## Testing the Setup

1. **PostGIS Connection Test**:
```bash
docker exec -it un_escap_postgis psql -U postgres -d un_escap_gis -c "SELECT version();"
```

2. **GeoServer Health Check**:
```bash
curl http://localhost:8080/geoserver/rest/about/version.json
```

3. **Processing Service Test**:
```bash
curl http://localhost:8000/health
```

4. **WebSocket Server Test**:
```bash
curl http://localhost:3001/health
```

## Data Migration

### Convert Existing Data
```bash
# Convert TIF files to COG format
for file in *.tif; do
    gdal_translate -of COG -co COMPRESS=DEFLATE "$file" "${file%.tif}_cog.tif"
done

# Import shapefiles to PostGIS
shp2pgsql -I -s 4326 boundary.shp boundaries.admin_boundaries | \
    psql -h localhost -U postgres -d un_escap_gis
```

## Monitoring

Set up monitoring with:
- **Prometheus** for metrics collection
- **Grafana** for visualization
- **Docker health checks**
- **Log aggregation** with ELK stack

## Security Considerations

1. Use secure passwords for all services
2. Configure SSL/TLS for production
3. Implement proper authentication
4. Regular security updates
5. Network segmentation
6. Backup strategies

## Troubleshooting

Common issues and solutions:
- Memory allocation errors → Increase Docker memory limits
- Connection timeouts → Check network configuration
- Processing failures → Verify GDAL installation
- WebSocket issues → Check CORS configuration

This infrastructure provides the foundation for high-performance geospatial data visualization with real-time collaboration capabilities.