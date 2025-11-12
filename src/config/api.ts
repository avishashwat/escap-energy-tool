// API configuration for switching between proxy and direct backend access
const USE_PROXY = false // Set to true to use Vite proxy, false for direct backend

export const API_BASE_URL = USE_PROXY ? '' : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000')

export const API_ENDPOINTS = {
  // GeoServer endpoints
  rasters: `${API_BASE_URL}/api/geoserver/rasters`,
  UPLOAD_RASTER: `${API_BASE_URL}/api/geoserver/upload-classified-raster`, 
  UPLOAD_SHAPEFILE: `${API_BASE_URL}/api/geoserver/upload-shapefile`, // Generic shapefile upload (boundaries)
  UPLOAD_ENERGY_INFRASTRUCTURE: `${API_BASE_URL}/api/geoserver/upload-energy-infrastructure`, // Energy infrastructure upload
  energyInfrastructure: `${API_BASE_URL}/api/geoserver/energy-infrastructure`, // Get energy infrastructure layers
  ANALYZE_SHAPEFILE: `${API_BASE_URL}/api/geoserver/analyze-shapefile`, // Analyze shapefile attributes before upload
  deleteRaster: `${API_BASE_URL}/api/geoserver/layers`, // Will append layer name
  boundaries: `${API_BASE_URL}/api/geoserver/boundaries`,
  uploadBoundary: `${API_BASE_URL}/api/geoserver/upload-boundary`,
  
  // Backend endpoints
  health: `${API_BASE_URL}/health`,
  geoserver: `${API_BASE_URL}/api/geoserver`,
}

console.log('🔧 API Configuration:', {
  USE_PROXY,
  API_BASE_URL,
  sample_endpoint: API_ENDPOINTS.rasters
})