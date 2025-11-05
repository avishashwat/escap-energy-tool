/**
 * Application Configuration - Centralized Endpoint Management
 * Following Golden Rule: Minimize hardcoding, use configurable variables
 * One change here updates everywhere across the application
 */

// Debug configuration
export const DEBUG_CONFIG = {
  enableConsoleLogging: true,
  enableNetworkLogging: true,
  enableErrorLogging: true,
  enablePerformanceLogging: true
}

// Backend API Configuration
export const BACKEND_CONFIG = {
  baseUrl: process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000',
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000 // 1 second
}

// GeoServer Configuration  
export const GEOSERVER_CONFIG = {
  // Direct GeoServer access (used as fallback)
  directUrl: process.env.REACT_APP_GEOSERVER_URL || 'http://localhost:8081/geoserver',
  // Backend proxy routes (preferred for CORS handling)
  proxyUrl: `${BACKEND_CONFIG.baseUrl}/api/geoserver`,
  workspace: process.env.REACT_APP_GEOSERVER_WORKSPACE || 'escap_climate',
  datastore: process.env.REACT_APP_GEOSERVER_DATASTORE || 'escap_datastore',
  credentials: {
    username: process.env.REACT_APP_GEOSERVER_USERNAME || 'admin',
    password: process.env.REACT_APP_GEOSERVER_PASSWORD || 'geoserver_admin_2024'
  }
}

// API Endpoints - All configurable, no hardcoding
export const API_ENDPOINTS = {
  // Backend API endpoints
  backend: {
    health: `${BACKEND_CONFIG.baseUrl}/health`,
    boundaries: `${BACKEND_CONFIG.baseUrl}/api/geoserver/boundaries`,
    uploadShapefile: `${BACKEND_CONFIG.baseUrl}/api/geoserver/upload-shapefile`,
    uploadRaster: `${BACKEND_CONFIG.baseUrl}/api/geoserver/upload-raster`,
    // WFS Proxy endpoint (to be implemented)
    wfsProxy: `${BACKEND_CONFIG.baseUrl}/api/geoserver/wfs-proxy`
  },
  
  // GeoServer WFS endpoints (direct access as fallback)
  geoserver: {
    wfs: (layerName: string, maxFeatures: number = 50) => 
      `${GEOSERVER_CONFIG.directUrl}/${GEOSERVER_CONFIG.workspace}/ows?` +
      `service=WFS&version=1.0.0&request=GetFeature&` +
      `typeName=${GEOSERVER_CONFIG.workspace}:${layerName}&` +
      `maxFeatures=${maxFeatures}&outputFormat=application/json&srsName=EPSG:4326`,
    
    vectorTiles: (layerName: string) =>
      `${GEOSERVER_CONFIG.directUrl}/gwc/service/tms/1.0.0/` +
      `${GEOSERVER_CONFIG.workspace}%3A${layerName}@EPSG%3A4326@pbf/{z}/{x}/{-y}.pbf`,
    
    rasterTiles: (layerName: string) =>
      `${GEOSERVER_CONFIG.directUrl}/gwc/service/tms/1.0.0/` +
      `${GEOSERVER_CONFIG.workspace}%3A${layerName}@EPSG%3A4326@png/{z}/{x}/{-y}.png`
  }
}

// Error Messages - Centralized for consistency
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
  GEOSERVER_UNAVAILABLE: 'GeoServer is currently unavailable. Please try again later.',
  BOUNDARY_LOAD_FAILED: 'Failed to load boundary data. Main approach failed; Using fallback method',
  WFS_REQUEST_FAILED: 'WFS request failed. Trying alternative endpoint',
  NO_FEATURES_FOUND: 'No geographic features found for the selected region',
  CORS_ERROR: 'Direct GeoServer access blocked. Using backend proxy'
}

// Success Messages - Centralized for consistency  
export const SUCCESS_MESSAGES = {
  BOUNDARY_LOADED: 'Boundary data loaded successfully',
  MASK_LOADED: 'Mask overlay loaded successfully',
  WFS_SUCCESS: 'WFS GeoJSON data loaded with EPSG:4326 integrity preserved',
  CACHE_HIT: 'Data loaded from performance cache'
}

// Debug Logger - Consistent formatting across application
export const debugLog = (component: string, message: string, data?: any) => {
  if (DEBUG_CONFIG.enableConsoleLogging) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
    console.log(`[${timestamp}] ${component}: ${message}`, data || '')
  }
}

// Error Logger - Consistent error reporting
export const errorLog = (component: string, message: string, error?: any) => {
  if (DEBUG_CONFIG.enableErrorLogging) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
    console.error(`[${timestamp}] ❌ ${component}: ${message}`, error || '')
  }
}

// Performance Logger - Track loading times
export const performanceLog = (component: string, operation: string, startTime: number) => {
  if (DEBUG_CONFIG.enablePerformanceLogging) {
    const duration = performance.now() - startTime
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
    console.log(`[${timestamp}] ⚡ ${component}: ${operation} completed in ${duration.toFixed(2)}ms`)
  }
}

export default {
  DEBUG_CONFIG,
  BACKEND_CONFIG,
  GEOSERVER_CONFIG,
  API_ENDPOINTS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  debugLog,
  errorLog,
  performanceLog
}