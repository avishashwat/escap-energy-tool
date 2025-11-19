/**
 * API Configuration for all endpoints and settings
 * Golden Rule: Minimize hardcoding - change once, update everywhere
 * 
 * This file contains all API endpoints, ports, and configuration values
 * to ensure maintainability and prevent hardcoded values throughout the codebase.
 */

// Environment variable diagnostics - log at module load time
if (typeof window !== 'undefined') {
  console.log('🔧 [API-CONFIG Module] Environment variables at load time:')
  console.log('   import.meta.env.VITE_BACKEND_URL:', import.meta.env.VITE_BACKEND_URL)
  console.log('   import.meta.env.VITE_GEOSERVER_URL:', import.meta.env.VITE_GEOSERVER_URL)
}

// Environment detection
const isDevelopment = import.meta.env.MODE === 'development'
const isProduction = import.meta.env.MODE === 'production'

// Base URLs - configurable per environment
export const API_CONFIG = {
  // Backend API Configuration
  BACKEND: {
    BASE_URL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000',
    API_PREFIX: '/api',
    ENDPOINTS: {
      HEALTH: '/health',
      GEOSERVER: {
        BOUNDARIES: '/geoserver/boundaries',
        UPLOAD_SHAPEFILE: '/geoserver/upload-shapefile',
        UPLOAD_RASTER: '/geoserver/upload-raster',
        WFS_PROXY: '/geoserver/wfs-proxy'
      }
    }
  },

  // GeoServer Configuration 
  GEOSERVER: {
    BASE_URL: import.meta.env.VITE_GEOSERVER_URL || 'http://localhost:8081/geoserver',
    WORKSPACE: 'escap_climate',
    DATASTORE: 'escap_datastore',
    CREDENTIALS: {
      USERNAME: import.meta.env.VITE_GEOSERVER_USERNAME || 'admin',
      PASSWORD: import.meta.env.VITE_GEOSERVER_PASSWORD || 'geoserver_admin_2024'
    },
    SERVICES: {
      WFS: {
        VERSION: '1.0.0',
        OUTPUT_FORMAT: 'application/json',
        SRS_NAME: 'EPSG:4326' // Golden Rule: NO CRS conversion for sensitive data
      },
      WMS: {
        VERSION: '1.1.1',
        FORMAT: 'image/png',
        SRS: 'EPSG:4326'
      },
      VECTOR_TILES: {
        GRIDSET: 'EPSG:4326', // Golden Rule: EPSG:4326 tiles-only approach
        FORMAT: 'pbf'
      }
    }
  },

  // Map Configuration
  MAP: {
    DEFAULT_PROJECTION: 'EPSG:4326', // Golden Rule: NO CRS conversion
    DEFAULT_ZOOM: 7,
    MAX_ZOOM: 18,
    MIN_ZOOM: 4,
    WORLD_EXTENT: [-180, -90, 180, 90], // EPSG:4326 world bounds
    LAYER_Z_INDEX: {
      BASEMAP: 0,
      MASK: 999,
      BOUNDARY: 1000,
      PROVINCE_MASK: 998,
      SELECTED_PROVINCE: 999
    }
  },

  // Performance Configuration
  PERFORMANCE: {
    CACHE_ENABLED: true,
    MAX_CACHE_SIZE: 50, // Maximum number of cached boundary sets
    REQUEST_TIMEOUT: 30000, // 30 seconds
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000 // 1 second
  },

  // Debug Configuration
  DEBUG: {
    ENABLED: isDevelopment,
    LOG_LEVEL: isDevelopment ? 'debug' : 'warn',
    VERBOSE_LOGGING: true,
    PERFORMANCE_LOGGING: true
  }
} as const

// Helper functions for constructing URLs
export const getBackendUrl = (endpoint: string): string => {
  const baseUrl = API_CONFIG.BACKEND.BASE_URL + API_CONFIG.BACKEND.API_PREFIX
  return `${baseUrl}${endpoint}`
}

export const getGeoServerWfsUrl = (layerName: string, maxFeatures?: number): string => {
  // ✅ AUTHENTICATION FIX: Route through backend proxy instead of calling GeoServer directly
  // This way frontend doesn't expose credentials and leverages backend's authenticated connection
  const { WORKSPACE, SERVICES } = API_CONFIG.GEOSERVER
  const params = new URLSearchParams({
    service: 'WFS',
    version: SERVICES.WFS.VERSION,
    request: 'GetFeature',
    typeName: `${WORKSPACE}:${layerName}`,
    outputFormat: SERVICES.WFS.OUTPUT_FORMAT,
    srsName: SERVICES.WFS.SRS_NAME
  })
  
  if (maxFeatures) {
    params.append('maxFeatures', maxFeatures.toString())
  }
  
  // Route through backend proxy endpoint which handles authentication
  // Backend endpoint: GET /api/geoserver/{workspace}/ows?service=WFS&...
  const backendUrl = getBackendUrl('/geoserver')
  const finalUrl = `${backendUrl}/${WORKSPACE}/ows?${params.toString()}`
  
  // 🔍 DIAGNOSTIC LOGGING
  console.log('🔧 [getGeoServerWfsUrl] Configuration:')
  console.log('   VITE_BACKEND_URL env:', import.meta.env.VITE_BACKEND_URL)
  console.log('   API_CONFIG.BACKEND.BASE_URL:', API_CONFIG.BACKEND.BASE_URL)
  console.log('   getBackendUrl result:', backendUrl)
  console.log('   Final WFS URL:', finalUrl)
  
  return finalUrl
}

export const getVectorTileUrl = (layerName: string): string => {
  const { BASE_URL, WORKSPACE, SERVICES } = API_CONFIG.GEOSERVER
  const gridset = SERVICES.VECTOR_TILES.GRIDSET
  const format = SERVICES.VECTOR_TILES.FORMAT
  
  return `${BASE_URL}/gwc/service/tms/1.0.0/${WORKSPACE}%3A${layerName}@${gridset}@${format}/{z}/{x}/{-y}.${format}`
}

// NEW: Function for WMS-based vector tiles (MVT with coordinate transformation)
export const getWmsVectorUrl = (layerName: string, bbox?: number[]): string => {
  const { BASE_URL, WORKSPACE } = API_CONFIG.GEOSERVER
  const bboxParam = bbox ? `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}` : '{bbox-epsg-4326}'
  
  // Performance Priority: Use standard MVT format (Web Mercator) with frontend transformation
  return `${BASE_URL}/${WORKSPACE}/wms?service=WMS&version=1.1.1&request=GetMap&layers=${WORKSPACE}:${layerName}&styles=&bbox=${bboxParam}&width=512&height=512&srs=EPSG:4326&format=application/vnd.mapbox-vector-tile`
}

// Debug logging utility
export const debugLog = {
  info: (message: string, data?: any, component?: string) => {
    if (API_CONFIG.DEBUG.ENABLED) {
      const prefix = component ? `[${component}]` : '[DEBUG]'
      console.log(`${prefix} ${message}`, data || '')
    }
  },
  
  warn: (message: string, data?: any, component?: string) => {
    const prefix = component ? `[${component}]` : '[WARN]'
    console.warn(`${prefix} ${message}`, data || '')
  },
  
  error: (message: string, error?: any, component?: string) => {
    const prefix = component ? `[${component}]` : '[ERROR]'
    console.error(`${prefix} ${message}`, error || '')
  },
  
  performance: (operation: string, startTime: number, component?: string) => {
    if (API_CONFIG.DEBUG.PERFORMANCE_LOGGING) {
      const duration = performance.now() - startTime
      const prefix = component ? `[${component}]` : '[PERF]'
      console.log(`${prefix} ${operation} completed in ${duration.toFixed(2)}ms`)
    }
  },
  
  fallback: (mainMethod: string, fallbackMethod: string, component?: string) => {
    const prefix = component ? `[${component}]` : '[FALLBACK]'
    console.warn(`${prefix} Main approach '${mainMethod}' failed; Using fallback method '${fallbackMethod}'`)
  }
}

// Country bounds configuration (instead of hardcoding)
export const COUNTRY_BOUNDS: Record<string, [number, number, number, number]> = {
  bhutan: [88.7464, 26.7026, 92.1252, 28.3359],
  laos: [100.0832, 13.9143, 107.6349, 22.5086],
  mongolia: [87.7346, 41.5818, 119.9315, 52.1484], // Added from uploaded boundary metadata
  // Add more countries as needed
}

// Known layer mapping (configurable instead of hardcoded)
export const LAYER_MAPPING: Record<string, { 
  pattern: RegExp, 
  description: string,
  defaultLayer?: string 
}> = {
  bhutan: { 
    pattern: /^bhutan_admin_\d+_\d+$/, 
    description: 'Bhutan administrative boundaries',
    defaultLayer: 'bhutan_admin_1_1758212756212' // Fallback if API fails
  },
  laos: { 
    pattern: /^laos_admin_\d+_\d+$/, 
    description: 'Laos administrative boundaries',
    defaultLayer: 'laos_admin_1_1758214174246' // Fallback if API fails
  },
  mongolia: { 
    pattern: /^mongolia_admin_\d+_\d+$/, 
    description: 'Mongolia administrative boundaries',
    defaultLayer: 'mongolia_boundary' // Using clean naming system
  }
}

export default API_CONFIG