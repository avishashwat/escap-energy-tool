/**
 * Application Constants
 * Golden Rule: All constants must b// Golden Rules Documentation
export const GOLDEN_RULES = [
  'Rule #1: PERFORMANCE PRIORITY - Allow Web Mercator → EPSG:4326 transformation for MVT speed',
  'Rule #2: EPSG:4326 OUTPUT - Final coordinates must be in EPSG:4326 for application compatibility', 
  'Rule #3: Constants in separate file - No hardcoded values in components',
  'Rule #4: Technical Reference updates - Always update before response end',
  'Rule #5: NEW POWERSHELL WINDOWS ALWAYS - Frontend/backend must run in separate new PowerShell windows',
  'Rule #6: NEVER reuse terminals - Each service gets its own dedicated PowerShell window',
  'Rule #7: CRITICAL DECISION APPROVAL - Any technology/stack changes require user confirmation with pros/cons analysis',
  'Rule #8: SNAPPY FRONTEND PERFORMANCE - Ultimate goal is fastest possible data fetching',
  'Rule #9: UPLOAD vs FETCH OPTIMIZATION - Processing acceptable during upload, zero delays during fetch'
] as constd here, no hardcoded values in components
 */

// Coordinate Reference System Constants
export const CRS = {
  EPSG_4326: 'EPSG:4326',
  // Golden Rule: NEVER use any other CRS - EPSG:4326 ONLY
} as const

// Map Bounds Constants  
export const COUNTRY_BOUNDS = {
  bhutan: [88.75, 26.70, 92.12, 28.35] as [number, number, number, number],
  mongolia: [87.73, 41.58, 119.92, 52.15] as [number, number, number, number],
  laos: [100.08, 13.91, 107.64, 22.50] as [number, number, number, number]
} as const

// EPSG:4326 Validation Constants
export const EPSG_4326_BOUNDS = {
  MIN_LONGITUDE: -180,
  MAX_LONGITUDE: 180,
  MIN_LATITUDE: -90,
  MAX_LATITUDE: 90,
  // Expanded bounds for validation tolerance
  VALIDATION_MIN_LONGITUDE: -185,
  VALIDATION_MAX_LONGITUDE: 185,
  VALIDATION_MIN_LATITUDE: -95,
  VALIDATION_MAX_LATITUDE: 95
} as const

// Layer Z-Index Constants
export const Z_INDEX = {
  BASEMAP: 0,
  BOUNDARY: 1,
  OVERLAY: 2,
  CONTROLS: 100
} as const

// Style Constants
export const BOUNDARY_STYLE = {
  STROKE_COLOR: '#FF0000',
  STROKE_WIDTH: 4,
  STROKE_DASH: [8, 4],
  FILL_COLOR: 'rgba(255, 0, 0, 0.15)'
} as const

// Service URLs Constants
export const SERVICES = {
  FRONTEND_PORT: 3000,
  BACKEND_PORT: 5000,
  GEOSERVER_PORT: 8081,
  POSTGRES_PORT: 5432
} as const

// WMS Request Constants
export const WMS_PARAMS = {
  SERVICE: 'WMS',
  VERSION: '1.1.0',
  REQUEST: 'GetMap',
  SRS: CRS.EPSG_4326, // Golden Rule: Always EPSG:4326
  FORMAT_MVT: 'application/vnd.mapbox-vector-tile',
  FORMAT_PNG: 'image/png',
  TILE_SIZE: 512,
  STYLES: ''
} as const

// Golden Rules Documentation
export const GOLDEN_RULES = [
  'Rule #1: NO CRS REPROJECTION EVER - Raster pixel values and locations are sacred',
  'Rule #2: EPSG:4326 ONLY - All data must remain in native EPSG:4326 format', 
  'Rule #3: Constants in separate file - No hardcoded values in components',
  'Rule #4: Technical Reference updates - Always update before response end',
  'Rule #5: NEW POWERSHELL WINDOWS ALWAYS - Frontend/backend must run in separate new PowerShell windows',
  'Rule #6: NEVER reuse terminals - Each service gets its own dedicated PowerShell window',
  'Rule #7: CRITICAL DECISION APPROVAL - Any technology/stack changes require user confirmation with pros/cons analysis',
  'Rule #8: SNAPPY FRONTEND PERFORMANCE - Ultimate goal is fastest possible data fetching with minimal user delays',
  'Rule #9: UPLOAD vs FETCH OPTIMIZATION - Processing time acceptable during upload, zero delays during data fetching'
] as const