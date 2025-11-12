import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Map as OLMap, View } from 'ol'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import XYZ from 'ol/source/XYZ'
import ImageWMS from 'ol/source/ImageWMS'
import ImageLayer from 'ol/layer/Image'
import { defaults as defaultControls, Zoom, ScaleLine, Control } from 'ol/control'
import { GeoJSON } from 'ol/format'
import { Style, Stroke, Fill, Circle, Icon, Text } from 'ol/style'
import { ChartBar, Table, MapPin, CaretDown, ArrowLeft } from '@phosphor-icons/react'
import { ChartView, TableView } from './DataVisualization'
import { RasterLegend } from './RasterLegend'
import { EnergyLegend } from './EnergyLegend'
import { 
  API_CONFIG, 
  getBackendUrl, 
  getGeoServerWfsUrl, 
  debugLog,
  LAYER_MAPPING
} from '../config/api-config'
import { API_ENDPOINTS, API_BASE_URL } from '../config/api'
import { toast } from 'sonner'
import 'ol/ol.css'

// 🚀 GLOBAL CACHE: Shared across all map instances for parallel loading performance
const globalBoundaryCache = new Map<string, any>()
const globalLoadingPromises = new Map<string, Promise<any>>()

// Clear old cache on reload
globalBoundaryCache.clear()
console.log('🗑️ Cleared global boundary cache for clean naming update')

// 🎨 Helper function to format season names for display
const formatSeasonName = (season: string): string => {
  const seasonMap: { [key: string]: string } = {
    // Standard 3-month seasons
    'dec_feb': 'December-February',
    'mar_may': 'March-May', 
    'jun_aug': 'June-August',
    'sep_nov': 'September-November',
    
    // Additional month ranges that might appear
    'jun_sep': 'June-September',
    'dec_may': 'December-May',
    'mar_aug': 'March-August',
    'sep_feb': 'September-February',
    'jan_mar': 'January-March',
    'apr_jun': 'April-June',
    'jul_sep': 'July-September',
    'oct_dec': 'October-December',
    'oct_nov': 'October-November',
    'nov_jan': 'November-January',
    'jan_dec': 'January-December',
    'feb_apr': 'February-April',
    'may_jul': 'May-July',
    'aug_oct': 'August-October',
    
    // Individual months
    'jan': 'January',
    'feb': 'February',
    'mar': 'March',
    'apr': 'April',
    'may': 'May',
    'jun': 'June',
    'jul': 'July',
    'aug': 'August',
    'sep': 'September',
    'oct': 'October',
    'nov': 'November',
    'dec': 'December',
    
    // Named seasons
    'annual': 'Annual',
    'winter': 'Winter',
    'spring': 'Spring', 
    'summer': 'Summer',
    'autumn': 'Autumn',
    'fall': 'Fall'
  }
  
  // If not found in map, try to parse it as month range (e.g., "oct_nov", "jan_feb")
  if (season.includes('_') && season.length <= 7) {
    const parts = season.split('_')
    if (parts.length === 2) {
      const monthNames = {
        'jan': 'January', 'feb': 'February', 'mar': 'March', 'apr': 'April',
        'may': 'May', 'jun': 'June', 'jul': 'July', 'aug': 'August',
        'sep': 'September', 'oct': 'October', 'nov': 'November', 'dec': 'December'
      }
      const startMonth = monthNames[parts[0] as keyof typeof monthNames]
      const endMonth = monthNames[parts[1] as keyof typeof monthNames]
      if (startMonth && endMonth) {
        return `${startMonth}-${endMonth}`
      }
    }
  }
  
  return seasonMap[season] || season
}

// 🎨 Helper function to format full layer name for display
const formatLayerName = (overlayInfo: any): string => {
  if (!overlayInfo) return 'No Layer'
  
  // Handle different overlay structures - check if it's a nested structure
  let layerData = overlayInfo
  if (overlayInfo.climate) {
    layerData = overlayInfo.climate
  } else if (overlayInfo.giri) {
    layerData = overlayInfo.giri
  }
  
  const { type, name, scenario, year, season } = layerData
  
  // Start with the base name - handle both direct name and nested structure
  let displayName = name || layerData.layerName || overlayInfo.name || 'Unknown Layer'
  
  // Clean up common prefixes in layer names
  if (displayName.includes('_')) {
    displayName = displayName.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }
  
  // Add scenario if present  
  if (scenario && scenario !== 'current') {
    displayName += ` - ${scenario.charAt(0).toUpperCase() + scenario.slice(1)}`
  }
  
  // Add time period if present
  if (year && year !== 'current') {
    displayName += ` - ${year}`
  }
  
  // Add formatted season if present, but skip for GIRI layers since they're inherently annual
  const isGiriLayer = type === 'giri' || 
                     layerData.type === 'giri' || 
                     overlayInfo.type === 'giri' ||
                     name?.toLowerCase().includes('giri') ||
                     displayName.toLowerCase().includes('flood') ||
                     displayName.toLowerCase().includes('drought') ||
                     displayName.toLowerCase().includes('cyclone')
  
  if (season && season !== 'annual' && !isGiriLayer) {
    displayName += ` - ${formatSeasonName(season)}`
  }
  
  // Add units if it's a temperature layer
  if (displayName.toLowerCase().includes('temperature')) {
    displayName += ' (°C)'
  }
  
  return displayName
}

interface MapComponentProps {
  id: string
  isActive: boolean
  onActivate: () => void
  center: [number, number]
  zoom: number
  onViewChange: (center: [number, number], zoom: number) => void
  country: string
  basemap?: string
  mapLayout?: number  // Add mapLayout prop for detecting layout changes
  overlayInfo?: {
    type: string
    name: string
    scenario?: string
    year?: string
    season?: string
  }
  allMapOverlays?: Record<string, any>
  onOverlayChange?: (mapId: string, action: 'add' | 'remove', layer?: any) => void
  onRegionSelect?: (regionName: string) => void  // Add region selection handler
}

// Create a designer north arrow control
class NorthArrowControl extends Control {
  constructor() {
    const element = document.createElement('div')
    element.className = 'ol-control ol-unselectable north-arrow'
    // 🎨 Designer north arrow with arrow symbol and N
    element.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        background: rgba(255, 255, 255, 0.9);
        padding: 8px;
        border-radius: 6px;
        border: 1px solid rgba(0, 0, 0, 0.2);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        font-family: Arial, sans-serif;
      ">
        <div style="
          font-size: 18px;
          color: #333;
          margin-bottom: 2px;
          transform: rotate(0deg);
        ">▲</div>
        <div style="
          font-size: 10px;
          font-weight: bold;
          color: #333;
          letter-spacing: 0.5px;
        ">N</div>
      </div>
    `
    element.style.cssText = `
      top: 20px;
      right: 10px;
      background: transparent;
      padding: 0;
    `
    
    super({
      element: element,
    })
  }
}

// 🎭 Helper function to create a simple country mask (world with country cutout)
const createSimpleCountryMask = (map: OLMap, boundaryLayer: VectorLayer<VectorSource>) => {
  try {
    console.log('🎭 Creating simple inverse country mask...')
    
    // Get the boundary extent to create world mask with country cutout
    const countryExtent = boundaryLayer.getSource()?.getExtent()
    if (!countryExtent) {
      console.error('❌ Cannot create mask - no boundary extent')
      return
    }
    
    console.log('🔍 Country extent for mask:', countryExtent)
    
    // Create a world-spanning polygon
    const worldExtent = [-180, -90, 180, 90] // World bounds in EPSG:4326
    
    // Create a simple rectangular mask that covers the world
    // This is a simplified approach - we'll just create a semi-transparent overlay
    // that doesn't cover the country area (handled by z-index layering)
    
    const maskFeatures = new GeoJSON().readFeatures({
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: { maskType: "world" },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [-180, -90],  // Bottom-left
            [180, -90],   // Bottom-right  
            [180, 90],    // Top-right
            [-180, 90],   // Top-left
            [-180, -90]   // Close polygon
          ]]
        }
      }]
    }, {
      featureProjection: 'EPSG:4326',
      dataProjection: 'EPSG:4326'
    })
    
    const maskLayer = new VectorLayer({
      source: new VectorSource({
        features: maskFeatures
      }),
      style: new Style({
        stroke: new Stroke({
          color: 'transparent',  // No stroke for world mask
          width: 0
        }),
        fill: new Fill({
          color: 'rgba(180, 180, 180, 0.4)'  // Light grey mask overlay
        })
      }),
      zIndex: 9997,    // Just below boundary layer (9999)
      visible: true,
      opacity: 1.0
    })
    
    maskLayer.set('layerType', 'countryMask')
    
    // Remove existing mask layers
    const existingMaskLayers = map.getLayers().getArray().filter(layer => 
      layer.get('layerType') === 'countryMask'
    )
    
    existingMaskLayers.forEach(layer => {
      console.log('🗑️ Removing existing mask layer')
      map.removeLayer(layer)
    })
    
    // Add the new mask layer
    map.addLayer(maskLayer)
    console.log('✅ Simple world mask layer added with z-index 9997')
    
    // Force render
    map.render()
    
    console.log('🎭 Simple country mask created successfully')
    
  } catch (error) {
    console.error('❌ Error creating simple country mask:', error)
  }
}

export const MapComponent: React.FC<MapComponentProps> = ({
  id,
  isActive,
  onActivate,
  center,
  zoom,
  onViewChange,
  country,
  basemap = 'osm',
  mapLayout,
  overlayInfo,
  allMapOverlays,
  onOverlayChange,
  onRegionSelect
}) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<OLMap | null>(null)
  const [layers, setLayers] = useState<VectorLayer<VectorSource>[]>([])
  const [boundaryLoading, setBoundaryLoading] = useState(false)
  
  // Track processed actions per overlay to prevent multi-map interference
  const processedActionsRef = useRef<Record<string, string>>({})
  
  // 🔍 Hover state for boundary/mask attributes 
  const [hoverInfo, setHoverInfo] = useState<{
    visible: boolean
    text: string
    x: number
    y: number
  }>({ visible: false, text: '', x: 0, y: 0 })
  
  // 🎯 Region selection and zoom state for click-to-zoom functionality
  const [selectedRegion, setSelectedRegion] = useState<{
    feature: any
    name: string
  } | null>(null)
  
  // 🏠 Store original country view separately (never gets overwritten)
  const originalCountryView = useRef<{ center: number[], zoom: number } | null>(null)
  
  // 🎨 Legend state management for raster overlays
  const [activeLegend, setActiveLegend] = useState<{
    type: 'climate' | 'giri',
    title: string,
    classifications: Array<{
      id?: string,
      min: number,
      max: number, 
      color: string,
      label: string
    }>,
    statistics?: {
      min: number,
      max: number,
      mean?: number,
      stdDev?: number
    }
  } | null>(null)

  // 🎨 Legend visibility state for 4-map layout headers
  const [showLegend, setShowLegend] = useState(true)
  
  // 🔧 CRITICAL: Per-instance flag to prevent duplicate boundary loading
  const boundaryLoadedCountries = useRef<Set<string>>(new Set())
  
  // 🏷️ Store current hover attribute for region name lookup
  const currentHoverAttribute = useRef<string>('adm1nm')

  // 🎯 Zoom back to country view function
  const zoomBackToCountry = useCallback(() => {
    if (originalCountryView.current && mapInstanceRef.current) {
      const map = mapInstanceRef.current
      const view = map.getView()
      
      // Instantly return to original country view (no animation for snappy performance)
      view.setCenter(originalCountryView.current.center)
      view.setZoom(originalCountryView.current.zoom)
      
      // Clear selected region (removes masking)
      setSelectedRegion(null)
    }
  }, [])

  // 🎨 Helper function to generate legend titles
  const generateLegendTitle = useCallback((rasterData: any) => {
    const parts: string[] = [];
    if (rasterData.subcategory) parts.push(rasterData.subcategory);
    if (rasterData.year) parts.push(rasterData.year);
    if (rasterData.seasonality) parts.push(rasterData.seasonality);

    let title = parts.join(' - ');
    // Check subcategory and category fields for temperature/precipitation
    const tempRegex = /temp|temperature|tmax|tmin/i;
    const precipRegex = /precip|precipitation|rainfall/i;
    const subcat = rasterData.subcategory || '';
    const cat = rasterData.category || '';
    if (tempRegex.test(subcat) || tempRegex.test(cat)) {
      title += ' (°C)';
    } else if (precipRegex.test(subcat) || precipRegex.test(cat)) {
      title += ' (mm)';
    }
    return title;
  }, [])
  
  // 🎨 Helper function to generate default classifications for rasters without stored classifications
  const generateDefaultClassifications = useCallback((rasterData: any, overlayType: string) => {
    // Default color schemes based on data type
    const getColorScheme = (dataType: string) => {
      if (dataType.toLowerCase().includes('temp') || dataType.toLowerCase().includes('temperature')) {
        return [
          { color: '#0066cc' },
          { color: '#3399ff' },
          { color: '#ffcc00' },
          { color: '#ff6600' },
          { color: '#cc0000' }
        ]
      } else if (dataType.toLowerCase().includes('precip') || dataType.toLowerCase().includes('rainfall')) {
        return [
          { color: '#8B4513' },
          { color: '#DAA520' },
          { color: '#FFD700' },
          { color: '#32CD32' },
          { color: '#0000CD' }
        ]
      } else {
        // Default GIRI or other data
        return [
          { color: '#d73027' },
          { color: '#f46d43' },
          { color: '#fdae61' },
          { color: '#abd9e9' },
          { color: '#74add1' }
        ]
      }
    }
    
    const colors = getColorScheme(rasterData.subcategory || overlayType)
    return colors.map((item, index) => ({
      id: `default_${index}`,
      min: index * 20, // Default range
      max: (index + 1) * 20,
      color: item.color,
      label: `${index * 20} - ${(index + 1) * 20}`
    }))
  }, [])

  // Load boundary data function with global caching for parallel performance
  const loadBoundaryData = useCallback(async (country: string): Promise<any> => {
    const cacheKey = `boundary_${country}_v2` // v2 to bust old cache
    
    if (globalBoundaryCache.has(cacheKey)) {
      console.log(`🚀 Using GLOBAL cached boundary data for ${country}`)
      return globalBoundaryCache.get(cacheKey)
    }
    
    if (globalLoadingPromises.has(cacheKey)) {
      console.log(`🚀 Boundary loading already in progress for ${country}, waiting for shared promise...`)
      return globalLoadingPromises.get(cacheKey)
    }

    const loadingPromise = (async () => {
      try {
        console.log(`✅ WFS-GeoJSON: Loading direct from GeoServer for ${country}`)
        
        // 🔗 STEP 1: Fetch boundary metadata from API to get hoverAttribute
        let boundaryInfo: any = null
        try {
          const metadataResponse = await fetch(`${API_ENDPOINTS.boundaries}?country=${encodeURIComponent(country)}`)
          if (metadataResponse.ok) {
            const metadataData = await metadataResponse.json()
            boundaryInfo = metadataData.boundaries?.[0] // Get first boundary info
            console.log(`📋 Retrieved boundary metadata for ${country}:`, boundaryInfo)
          }
        } catch (metadataError) {
          console.warn(`⚠️ Could not fetch boundary metadata for ${country}:`, metadataError)
        }
        
        // ✨ DYNAMIC APPROACH: Skip hardcoded bounds check, fetch data directly
        // Use clean layer naming system
        const cleanBoundaryName = `${country}_boundary`
        const cleanMaskName = `${country}_mask`
        console.log(`🏷️ Using clean boundary layer name: ${cleanBoundaryName}`)
        
        const wfsUrl = getGeoServerWfsUrl(cleanBoundaryName)
        
        console.log(`🔗 Fetching boundary data from: ${wfsUrl}`)
        
        const response = await fetch(wfsUrl)
        
        if (!response.ok) {
          console.error(`❌ WFS request failed for ${country}: ${response.status} ${response.statusText}`)
          console.error(`This likely means no boundary data exists for ${country} in GeoServer`)
          return null
        }
        
        const geojsonData = await response.json()
        
        if (!geojsonData.features || geojsonData.features.length === 0) {
          console.log(`❌ No features found in WFS response for country: ${country}`)
          return null
        }

        console.log(`✅ Found ${geojsonData.features.length} boundary features for ${country}`)
        
        // ✨ DYNAMIC BOUNDS CALCULATION: Calculate bounds from actual GeoJSON data
        const calculateBounds = (features: any[]) => {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
          
          features.forEach((feature) => {
            if (feature.geometry && feature.geometry.coordinates) {
              const processCoords = (coords: any) => {
                if (Array.isArray(coords[0])) {
                  coords.forEach(processCoords)
                } else if (coords.length >= 2) {
                  const [x, y] = coords
                  minX = Math.min(minX, x)
                  maxX = Math.max(maxX, x)
                  minY = Math.min(minY, y)
                  maxY = Math.max(maxY, y)
                }
              }
              processCoords(feature.geometry.coordinates)
            }
          })
          
          return [minX, minY, maxX, maxY]
        }
        
        const dynamicBounds = calculateBounds(geojsonData.features)
        console.log(`� Calculated dynamic bounds for ${country}:`, dynamicBounds)
        
        console.log(`�🏷️ Using clean naming: boundary="${cleanBoundaryName}", mask="${cleanMaskName}"`)
        
        // Create result for WFS/GeoJSON approach with dynamic bounds
        const result = {
          isVectorTile: false, // Use WFS/GeoJSON instead
          layerName: cleanBoundaryName, // Use clean name
          features: geojsonData.features, // Include the actual GeoJSON features
          geojsonData: geojsonData, // Full GeoJSON response
          bounds: dynamicBounds, // ✨ Dynamic bounds from actual data
          maskLayer: { success: true, maskLayerName: cleanMaskName }, // Use clean mask name
          hoverAttribute: boundaryInfo?.hoverAttribute || 'adm1nm', // Use API-provided or fallback
          metadata: { source: 'WFS_GEOJSON', crs: 'EPSG:4326', dynamicBounds: true }
        }
        
        // Cache the result in global cache for all map instances
        globalBoundaryCache.set(cacheKey, result)
        console.log(`🚀 WFS/GeoJSON configured and GLOBALLY cached for ${country}`)
        console.log(`🔍 Cached result maskLayer:`, result.maskLayer)
        
        return result
      } catch (error) {
        console.error('Error loading boundary data for', country, error)
        throw error
      } finally {
        globalLoadingPromises.delete(cacheKey)
      }
    })()

    globalLoadingPromises.set(cacheKey, loadingPromise)
    return loadingPromise
  }, [])

  // Load raster data function with global caching for parallel performance
  const loadRasterData = useCallback(async (country: string): Promise<any[]> => {
    const cacheKey = `raster_${country}_v1`
    
    if (globalBoundaryCache.has(cacheKey)) {
      console.log(`🚀 Using GLOBAL cached raster data for ${country}`)
      return globalBoundaryCache.get(cacheKey)
    }
    
    if (globalLoadingPromises.has(cacheKey)) {
      console.log(`🚀 Raster loading already in progress for ${country}, waiting for shared promise...`)
      return globalLoadingPromises.get(cacheKey)
    }

    const loadingPromise = (async () => {
      try {
        console.log(`🔍 Loading rasters from backend API for ${country}`)
        
        const response = await fetch(API_ENDPOINTS.rasters)
        if (!response.ok) {
          throw new Error(`Failed to fetch rasters: ${response.statusText}`)
        }
        
        const data = await response.json()
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch rasters')
        }
        
        // Filter rasters for the specific country
        const countryRasters = (data.rasters || []).filter((raster: any) => 
          raster.country && raster.country.toLowerCase() === country.toLowerCase()
        )
        
        console.log(`✅ Found ${countryRasters.length} rasters for ${country}`)
        
        // Cache the result in global cache for all map instances
        globalBoundaryCache.set(cacheKey, countryRasters)
        console.log(`🚀 Rasters GLOBALLY cached for ${country}`)
        
        return countryRasters
      } catch (error) {
        console.error('Error loading raster data for', country, error)
        // Return empty array on error rather than throwing
        return []
      } finally {
        globalLoadingPromises.delete(cacheKey)
      }
    })()

    globalLoadingPromises.set(cacheKey, loadingPromise)
    return loadingPromise
  }, [])

  // 🚀 ASYNC LAYER MANAGEMENT: Individual layer loading functions for parallel performance
  const loadBoundaryLayerAsync = useCallback(async (map: OLMap, country: string) => {
    console.log(`🚀 Starting ASYNC boundary layer loading for ${country}`)
    
    try {
      const boundaryData = await loadBoundaryData(country)
      
      if (!boundaryData || !boundaryData.features || boundaryData.features.length === 0) {
        console.log(`❌ No boundary data available for country: ${country}`)
        return null
      }

      // Create boundary layer
      const features = new GeoJSON().readFeatures(boundaryData.geojsonData, {
        featureProjection: 'EPSG:4326',  // Map display projection (same as data)
        dataProjection: 'EPSG:4326'     // Data projection (preserved)
      })

      const boundaryLayer = new VectorLayer({
        source: new VectorSource({ features }),
        style: new Style({
          stroke: new Stroke({
            color: '#333333',  // Darkest grey for professional look
            width: 1,          // Much thinner stroke
            lineDash: [10, 5]
          }),
          fill: new Fill({
            color: 'transparent'  // ✅ TRANSPARENT inside - no grey fill
          })
        }),
        zIndex: 9999,
        visible: true,
        opacity: 1.0
      })
      
      boundaryLayer.set('layerType', 'boundary')
      
      // Add to map
      map.addLayer(boundaryLayer)
      console.log(`✅ Boundary layer added asynchronously for ${country}`)
      
      // 🏷️ Update hover attribute ref for event handlers
      currentHoverAttribute.current = boundaryData.hoverAttribute || 'adm1nm'
      console.log(`🏷️ Set hover attribute to: ${currentHoverAttribute.current}`)
      
      // Force visibility and render
      boundaryLayer.setVisible(true)
      boundaryLayer.setOpacity(1.0)
      map.render()
      
      // Debug layer state
      console.log(`🔍 Boundary layer debug:`, {
        visible: boundaryLayer.getVisible(),
        opacity: boundaryLayer.getOpacity(),
        zIndex: boundaryLayer.getZIndex(),
        features: boundaryLayer.getSource()?.getFeatures().length,
        extent: boundaryLayer.getSource()?.getExtent()
      })
      
      // 🎭 ADD MASK LAYER LOADING
      console.log('🔍 Mask condition check:', {
        hasBoundaryData: !!boundaryData,
        hasMaskLayer: !!boundaryData.maskLayer,
        maskSuccess: boundaryData.maskLayer?.success,
        maskLayerName: boundaryData.maskLayer?.maskLayerName,
        conditionResult: !!(boundaryData.maskLayer && boundaryData.maskLayer.success)
      })
      
      if (boundaryData.maskLayer && boundaryData.maskLayer.success) {
        console.log('🎭 Loading mask layer:', boundaryData.maskLayer.maskLayerName)
        
        const maskLayerName = boundaryData.maskLayer.maskLayerName
        try {
          if (maskLayerName) {
            // Add workspace prefix for GeoServer WFS request
            const fullMaskLayerName = `escap_climate:${maskLayerName}`
            const maskWfsUrl = getGeoServerWfsUrl(fullMaskLayerName)
            console.log('🔍 Fetching mask GeoJSON from WFS:', maskWfsUrl)
            
            const maskResponse = await fetch(maskWfsUrl)
            const maskGeojsonData = await maskResponse.json()
            
            if (maskGeojsonData && maskGeojsonData.features) {
              console.log('✅ Retrieved mask GeoJSON data:', maskGeojsonData.features.length, 'features')
              
              const geojsonFormat = new GeoJSON()
              const maskFeatures = geojsonFormat.readFeatures(maskGeojsonData, {
                featureProjection: 'EPSG:4326',
                dataProjection: 'EPSG:4326'
              })
              
              const maskLayer = new VectorLayer({
                source: new VectorSource({
                  features: maskFeatures
                }),
                style: new Style({
                  stroke: new Stroke({
                    color: '#333333',  // Darkest grey for professional look
                    width: 1           // Thinner stroke for mask
                  }),
                  fill: new Fill({
                    color: 'rgba(180, 180, 180, 0.6)'  // Same as non-selected regions
                  })
                }),
                zIndex: 9998,    // Very high z-index, just below boundary
                visible: true,    // Explicitly set visible
                opacity: 1.0      // Full opacity
              })
              maskLayer.set('layerType', 'countryMask')
              
              // Remove existing mask layers
              const existingMaskLayers = map.getLayers().getArray().filter(layer => 
                layer.get('layerType') === 'countryMask'
              )
              existingMaskLayers.forEach(layer => {
                console.log('🗑️ Removing old mask layer')
                map.removeLayer(layer)
              })
              
              map.addLayer(maskLayer)
              console.log('✅ Mask layer added successfully with z-index 9998')
            } else {
              console.error('❌ No mask features found in GeoServer response')
            }
          } else {
            console.error('❌ No mask layer name found')
          }
        } catch (maskError) {
          console.error('❌ Error loading mask from GeoServer:', maskError)
        }
      } else {
        console.log('🎭 Creating simple inverse mask since GeoServer mask unavailable...')
        createSimpleCountryMask(map, boundaryLayer)
      }
      
      return { layer: boundaryLayer, extent: boundaryLayer.getSource()?.getExtent() }
    } catch (error) {
      console.error(`❌ Failed to load boundary layer for ${country}:`, error)
      return null
    }
  }, [loadBoundaryData])

  // Load raster layers for a country
  const loadRasterLayerAsync = useCallback(async (map: OLMap, country: string) => {
    console.log(`🚀 Starting ASYNC raster layer loading for ${country}`)
    
    try {
      const rasterData = await loadRasterData(country)
      
      if (!rasterData || rasterData.length === 0) {
        console.log(`📋 No rasters found for ${country}`)
        return []
      }
      
      const addedLayers: Array<{layer: ImageLayer<ImageWMS>, layerName: string, rasterInfo: any}> = []
      
      // Add each raster as a separate layer
      for (const raster of rasterData) {
        try {
          console.log(`🌍 Adding raster layer: ${raster.layerName}`)
          
          const rasterLayer = new ImageLayer({
            source: new ImageWMS({
              url: import.meta.env.VITE_GEOSERVER_URL || 'http://localhost:8081/geoserver/escap_climate/wms',
              params: {
                'LAYERS': `escap_climate:${raster.layerName}`,
                'FORMAT': 'image/png',
                'TRANSPARENT': true
              },
              crossOrigin: 'anonymous'
            }),
            zIndex: 1000 + addedLayers.length, // Stack rasters below boundaries but above basemap
            opacity: 0.8,
            visible: true
          })
          
          // Set layer properties for identification
          rasterLayer.set('layerName', raster.layerName)
          rasterLayer.set('layerType', 'raster')
          rasterLayer.set('country', country)
          rasterLayer.set('rasterInfo', raster)
          
          map.addLayer(rasterLayer)
          addedLayers.push({
            layer: rasterLayer,
            layerName: raster.layerName,
            rasterInfo: raster
          })
          
          console.log(`✅ Raster layer added: ${raster.layerName} with z-index ${1000 + addedLayers.length - 1}`)
        } catch (layerError) {
          console.error(`❌ Failed to add raster layer ${raster.layerName}:`, layerError)
        }
      }
      
      console.log(`✅ Added ${addedLayers.length} raster layers for ${country}`)
      
      // Return consistent format with boundary function  
      return { 
        layers: addedLayers, 
        count: addedLayers.length,
        extent: null // Rasters don't need auto-zoom extent
      }
    } catch (error) {
      console.error(`❌ Failed to load raster layers for ${country}:`, error)
      return { layers: [], count: 0, extent: null }
    }
  }, [loadRasterData])

  // 🚀 BOUNDARY LAYER LOADER: Load only boundary layers automatically
  const loadBoundaryLayersOnly = useCallback(async (map: OLMap, country: string) => {
    console.log(`🚀 Starting boundary layer loading for ${country}`)
    setBoundaryLoading(true)
    
    try {
      // Load only boundary layers automatically - rasters load on user selection only
      const boundaryResult = await loadBoundaryLayerAsync(map, country)
      
      console.log(`📊 Boundary loading result: ${boundaryResult ? 'loaded' : 'failed'}`)
      
      // Auto-zoom to boundary if available
      if (boundaryResult?.extent) {
        const extent = boundaryResult.extent
        console.log(`🎯 Auto-zooming to boundary extent:`, extent)
        
        map.getView().fit(extent, {
          padding: [20, 20, 20, 20], // More aggressive padding for tighter fit
          maxZoom: 10
        })
        
        // Store original view for zoom-back functionality
        const newCenter = map.getView().getCenter()
        const newZoom = map.getView().getZoom()
        
        if (newCenter && newZoom) {
          originalCountryView.current = {
            center: newCenter,
            zoom: newZoom
          }
          onViewChange(newCenter as [number, number], newZoom)
          console.log(`🏠 Stored original country view and updated shared state`)
        }
      }
      
      console.log(`✅ Boundary layer loading completed for ${country} - ${boundaryResult ? 'success' : 'failed'}`)
      return boundaryResult
      
    } catch (error) {
      console.error(`❌ Parallel layer loading failed for ${country}:`, error)
      return null
    } finally {
      setBoundaryLoading(false)
    }
  }, [loadBoundaryLayerAsync, onViewChange])

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    console.log('🔧 Initializing map instance (ONE TIME ONLY)')

    const initialView = new View({
      center: center,
      zoom: zoom,
      projection: 'EPSG:4326'
    })

    // Create basemap layer with LOWEST z-index (or no basemap for 'none')
    let basemapLayer: TileLayer<XYZ> | null = null
    let initialLayers: TileLayer<XYZ>[] = []
    
    if (basemap !== 'none') {
      if (basemap === 'satellite') {
        basemapLayer = new TileLayer({
          source: new XYZ({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attributions: '© Esri'
          }),
          zIndex: -1000  // FORCE basemap to bottom
        })
      } else {
        basemapLayer = new TileLayer({
          source: new XYZ({
            url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            attributions: '© OpenStreetMap contributors'
          }),
          zIndex: -1000  // FORCE basemap to bottom
        })
      }

      if (basemapLayer) {
        basemapLayer.set('layerType', 'basemap')
        initialLayers = [basemapLayer]
      }
      console.log('🔧 Basemap layer created with z-index -1000 (bottom layer)')
    } else {
      console.log('🔧 No basemap - only boundaries, mask, and overlays will be shown')
    }

    const map = new OLMap({
      target: mapRef.current,
      layers: initialLayers,
      view: initialView,
      controls: defaultControls().extend([
        new ScaleLine({
          units: 'metric',
          bar: true,
          steps: 2,  // 🔧 Changed from 4 to 2 grids as requested
          text: false,  // 🔧 Remove decimal ratio text, keep only the visual bar
          minWidth: 140,
        }),
        new NorthArrowControl()
      ])
    })

    // 🔍 CRITICAL: Monitor ALL layer additions after map creation
    map.getLayers().on('add', (event) => {
      const addedLayer = event.element
      const layerInfo = {
        type: addedLayer.constructor.name,
        layerType: addedLayer.get('layerType') || 'unknown',
        zIndex: addedLayer.getZIndex(),
        visible: addedLayer.getVisible()
      }
      console.log('🔍 NEW LAYER ADDED TO MAP:', layerInfo)
      
      // If a new layer is added with high z-index, warn about potential conflicts
      if (layerInfo.zIndex && layerInfo.zIndex > 9000) {
        console.log('🚨 WARNING: High z-index layer added that might cover boundary/mask!')
      }
      
      // 🔧 DON'T AUTOMATICALLY CHANGE Z-INDEX - it causes rendering issues
      console.log('✅ Allowing layers to keep their original z-index to prevent rendering issues')
    })

    // Track view changes
    map.getView().on('change', () => {
      const view = map.getView()
      const newCenter = view.getCenter()
      const newZoom = view.getZoom()
      if (newCenter && newZoom) {
        onViewChange(newCenter as [number, number], newZoom)
      }
    })

    // 🔍 Add hover functionality (careful implementation)
    map.on('pointermove', (event) => {
      const pixel = map.getEventPixel(event.originalEvent)
      let foundFeature = false
      
      // Check for features at pixel (energy layers have priority over boundary layers)
      map.forEachFeatureAtPixel(pixel, (feature, layer) => {
        // Check energy layers first (higher priority)
        if (layer && layer.get('layerType') === 'energy') {
          const properties = feature.getProperties()
          const energyData = layer.get('energyData')
          const energyConfig = energyData?.energyConfig
          
          console.log('🎯 Energy hover detected:', { properties, energyData, energyConfig })
          
          // Build tooltip content for energy infrastructure
          let tooltipText = properties.name || properties.NAME || properties.Name || 'Power Plant'
          
          // Add capacity information if available and configured
          if (energyConfig?.capacityAttribute) {
            const capacity = properties[energyConfig.capacityAttribute]
            console.log(`🔍 Capacity tooltip debug: attribute="${energyConfig.capacityAttribute}", value="${capacity}", type="${typeof capacity}"`)
            if (capacity !== undefined && capacity !== null && capacity !== '') {
              const numCapacity = parseFloat(capacity)
              if (!isNaN(numCapacity)) {
                tooltipText += `\nCapacity: ${numCapacity} MW`
                console.log(`✅ Added capacity to tooltip: ${numCapacity} MW`)
              } else {
                console.log(`⚠️ Capacity not numeric: "${capacity}"`)
              }
            } else {
              console.log(`⚠️ Capacity is empty/null: "${capacity}"`)
            }
          }
          
          // Note: Removed energy type from tooltip per user request (only show name and capacity)
          
          // Get pixel position relative to map container for accurate tooltip positioning
          const mapRect = map.getTargetElement().getBoundingClientRect()
          const mouseEvent = event.originalEvent as MouseEvent
          
          setHoverInfo({
            visible: true,
            text: tooltipText,
            x: mouseEvent.clientX - mapRect.left,  // Relative to map container
            y: mouseEvent.clientY - mapRect.top    // Relative to map container
          })
          
          map.getTargetElement().style.cursor = 'pointer'
          foundFeature = true
          return true // Stop searching - energy tooltip has priority
        } else if (layer && layer.get('layerType') === 'boundary') {
          const properties = feature.getProperties()
          const attributeName = properties[currentHoverAttribute.current] || properties.name || 'Unknown Region'
          
          // Get pixel position relative to map container for accurate tooltip positioning
          const mapRect = map.getTargetElement().getBoundingClientRect()
          const mouseEvent = event.originalEvent as MouseEvent
          
          setHoverInfo({
            visible: true,
            text: attributeName,
            x: mouseEvent.clientX - mapRect.left,  // Relative to map container
            y: mouseEvent.clientY - mapRect.top    // Relative to map container
          })
          
          map.getTargetElement().style.cursor = 'pointer'
          foundFeature = true
          return true // Stop searching
        }
        return false
      })
      
      if (!foundFeature) {
        setHoverInfo(prev => ({ ...prev, visible: false }))
        map.getTargetElement().style.cursor = ''
      }
    })
    
    // Handle mouse leave
    map.getTargetElement().addEventListener('mouseleave', () => {
      setHoverInfo(prev => ({ ...prev, visible: false }))
      map.getTargetElement().style.cursor = ''
    })

    // 🎯 Add click-to-zoom functionality 
    map.on('singleclick', (event) => {
      const pixel = map.getEventPixel(event.originalEvent)
      
      // Check for clicked feature
      map.forEachFeatureAtPixel(pixel, (feature, layer) => {
        if (layer && layer.get('layerType') === 'boundary') {
          const properties = feature.getProperties()
          const regionName = properties[currentHoverAttribute.current] || properties.name || 'Unknown Region'
          
          // 🏠 Store original country view ONLY ONCE (first time any region is clicked)
          if (!originalCountryView.current) {
            const currentView = map.getView()
            originalCountryView.current = {
              center: currentView.getCenter() || [90.5, 27.5],
              zoom: currentView.getZoom() || 8
            }
            console.log('🏠 Stored original country view:', originalCountryView.current)
          }
          
          // Get feature extent and zoom to it more aggressively
          const geometry = feature.getGeometry()
          if (geometry) {
            const extent = geometry.getExtent()
            map.getView().fit(extent, {
              padding: [10, 10, 10, 10],  // More aggressive padding for tighter fit
              maxZoom: 15                 // Allow much closer zoom
              // No duration for instant snappy zoom
            })
            
            // Set selected region for masking (no originalView needed)
            setSelectedRegion({
              feature: feature,
              name: regionName
            })
            
            // Trigger AI regional analysis if callback provided
            if (onRegionSelect) {
              onRegionSelect(regionName)
            }
            
            console.log(`🎯 Zoomed to region: "${regionName}"`)
            console.log(`🎯 Feature properties:`, properties)
          }
          
          return true // Stop searching
        }
        return false
      })
    })

    mapInstanceRef.current = map

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTarget(undefined)
        mapInstanceRef.current = null
      }
    }
  }, []) // 🔧 EMPTY DEPENDENCY ARRAY - map should only initialize once

  // Handle window resize events for smooth map resizing
  useEffect(() => {
    if (!mapInstanceRef.current) return

    let resizeTimeout: NodeJS.Timeout

    const handleResize = () => {
      // Debounce resize events to avoid excessive calls
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        if (mapInstanceRef.current) {
          // Simply update map size without visible refresh
          mapInstanceRef.current.updateSize()
          
          // Only refit if we have a stored boundary extent (not view)
          const boundaryLayers = mapInstanceRef.current.getLayers().getArray()
            .filter(layer => layer.get('layerType') === 'boundary')
          
          if (boundaryLayers.length > 0) {
            const boundaryLayer = boundaryLayers[0] as VectorLayer<VectorSource>
            const source = boundaryLayer.getSource()
            if (source) {
              const extent = source.getExtent()
              if (extent && extent.every(coord => isFinite(coord))) {
                mapInstanceRef.current.getView().fit(extent, {
                  padding: [5, 5, 5, 5], // Minimal padding for maximum country coverage
                  maxZoom: 12, // Allow closer zoom for better coverage
                  duration: 0 // No animation for smooth, instant resize
                })
              }
            }
          }
        }
      }, 150) // Debounce for smooth performance
    }

    // Listen to window resize events
    window.addEventListener('resize', handleResize, { passive: true })

    return () => {
      clearTimeout(resizeTimeout)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Handle view changes without recreating the map
  // 🚫 DISABLED: Props-based view updates interfere with programmatic zoom
  // Programmatic zoom (map.getView().fit()) is better for auto-zooming to boundaries
  /*
  useEffect(() => {
    if (!mapInstanceRef.current) return
    
    // 🔧 Don't override view during country change (to allow auto-zoom to new country)
    if (isCountryChanging) {
      console.log('🔧 Skipping view update - country change in progress')
      return
    }
    
    const map = mapInstanceRef.current
    const view = map.getView()
    
    // Update view center and zoom
    view.setCenter(center)
    view.setZoom(zoom)
    
    console.log('🔧 Updated map view without recreating map:', { center, zoom })
  }, [center, zoom, isCountryChanging])
  */

  // Handle basemap changes without recreating the map
  useEffect(() => {
    if (!mapInstanceRef.current) return
    
    const map = mapInstanceRef.current
    
    // Find and remove existing basemap
    const existingBasemap = map.getLayers().getArray().find(layer => 
      layer.get('layerType') === 'basemap'
    )
    
    if (existingBasemap) {
      map.removeLayer(existingBasemap)
    }
    
    // Create new basemap (or skip for 'none')
    if (basemap !== 'none') {
      let basemapLayer
      if (basemap === 'satellite') {
        basemapLayer = new TileLayer({
          source: new XYZ({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attributions: '© Esri'
          }),
          zIndex: -1000
        })
      } else {
        basemapLayer = new TileLayer({
          source: new XYZ({
            url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            attributions: '© OpenStreetMap contributors'
          }),
          zIndex: -1000
        })
      }
      
      basemapLayer.set('layerType', 'basemap')
      map.addLayer(basemapLayer)
      
      console.log('🔧 Updated basemap without recreating map:', basemap)
    } else {
      console.log('🔧 No basemap selected - showing only boundaries, mask, and overlays')
    }
  }, [basemap])

  // Load boundary layer using WFS/GeoJSON approach
  useEffect(() => {
    if (!mapInstanceRef.current) return

    const map = mapInstanceRef.current
    
    // 🔧 CLEAR previous boundaries and loaded flags when country changes
    console.log(`🔄 Country changed to: ${country}, cleaning up previous data`)
    
    // 🧹 Remove all existing boundary and mask layers
    const existingLayers = map.getLayers().getArray().filter(layer => 
      layer.get('layerType') === 'boundary' || layer.get('layerType') === 'countryMask'
    )
    existingLayers.forEach(layer => map.removeLayer(layer))
    console.log(`🧹 Removed ${existingLayers.length} existing boundary/mask layers`)
    
    // 🧹 Clear loaded countries set to allow fresh loading
    boundaryLoadedCountries.current.clear()
    console.log(`🧹 Cleared loaded countries cache`)
    
    // 🏠 Reset region selection and country view
    originalCountryView.current = null
    setSelectedRegion(null)
    
    const loadBoundaryLayer = async () => {
      // � CRITICAL: Check if boundary already loaded for this country
      if (boundaryLoadedCountries.current.has(country)) {
        console.log(`🚨 Boundary already loaded for ${country}, skipping...`)
        return
      }
      
      // �🔍 CRITICAL: Prevent multiple simultaneous boundary loading
      if (boundaryLoading) {
        console.log('🚨 Boundary loading already in progress, skipping...')
        return
      }
      
      try {
        setBoundaryLoading(true)
        boundaryLoadedCountries.current.add(country) // Mark as loading
        console.log('=== Loading boundary layer using WFS/GeoJSON for country:', country, '===')

        const boundaryData = await loadBoundaryData(country)
        
        if (!boundaryData) {
          console.log(`No boundary data available for country: ${country}`)
          return
        }

        const map = mapInstanceRef.current!
        const mapLayers = map.getLayers()
        
        // Remove existing boundary layers and clean up their intervals
        const existingLayers = mapLayers.getArray().filter(layer => 
          layer.get('layerType') === 'boundary' || layer.get('layerType') === 'countryMask'
        )
        existingLayers.forEach(layer => {
          // Clean up persistence intervals
          const interval = layer.get('persistenceInterval')
          if (interval) {
            console.log('🧹 Cleaning up layer persistence interval')
            clearInterval(interval)
          }
          map.removeLayer(layer)
        })

        // Use the GeoJSON data from boundaryData (already fetched by loadBoundaryData)
        const geojsonData = boundaryData.geojsonData
        
        console.log('✅ Using cached GeoJSON data:', geojsonData.features.length, 'features')
        
        if (geojsonData && geojsonData.features) {
          console.log('✅ Retrieved GeoJSON data (EPSG:4326 native):', geojsonData.features.length, 'features')
          
          // Create vector layer from GeoJSON (NO CRS CONVERSION - preserve EPSG:4326)
          const geojsonFormat = new GeoJSON()
          const features = geojsonFormat.readFeatures(geojsonData, {
            featureProjection: 'EPSG:4326',  // Map display projection (same as data)
            dataProjection: 'EPSG:4326'     // Data projection (preserved)
          })
          
          const boundaryLayer = new VectorLayer({
            source: new VectorSource({
              features: features
            }),
            style: new Style({
              stroke: new Stroke({
                color: '#333333',  // Darkest grey for professional look
                width: 1,          // Much thinner stroke
                lineDash: [10, 5]
              }),
              fill: new Fill({
                color: 'transparent'  // 🔧 FIXED: No fill on initial load
              })
            }),
            zIndex: 9999,      // Boundary layers second-highest (below energy 10000)
            visible: true,     // Explicitly set visible
            opacity: 1.0       // Full opacity
          })
          boundaryLayer.set('layerType', 'boundary')
          
          // 🔍 CRITICAL: Check if boundary layer already exists before adding
          const existingBoundaryLayers = map.getLayers().getArray().filter(layer => 
            layer.get('layerType') === 'boundary'
          )
          
          if (existingBoundaryLayers.length > 0) {
            console.log('🚨 Removing existing boundary layers:', existingBoundaryLayers.length)
            existingBoundaryLayers.forEach(layer => {
              console.log('🗑️ Removing old boundary layer')
              map.removeLayer(layer)
            })
          }
          
          map.addLayer(boundaryLayer)
          console.log('✅ WFS/GeoJSON boundary layer added to map successfully')
          
          // 🔍 CRITICAL: Set up layer change monitoring only
          boundaryLayer.on('change:visible', (event) => {
            console.log('🚨 BOUNDARY LAYER VISIBILITY CHANGED:', event.target.getVisible())
          })
          
          // 🔍 NO PERSISTENCE INTERVALS - they can cause rendering conflicts
          console.log('✅ Boundary layer monitoring set up without persistence intervals')
          
          // 🔍 Monitor map layer changes
          map.getLayers().on('add', (event) => {
            console.log('🔍 Layer added to map:', {
              type: event.element.constructor.name,
              layerType: event.element.get('layerType'),
              zIndex: event.element.getZIndex()
            })
          })
          
          map.getLayers().on('remove', (event) => {
            console.log('🚨 Layer removed from map:', {
              type: event.element.constructor.name,
              layerType: event.element.get('layerType')
            })
          })
          
          // 🔍 DEBUG: Check layer properties
          console.log('🔍 Boundary layer debug info:', {
            visible: boundaryLayer.getVisible(),
            opacity: boundaryLayer.getOpacity(),
            zIndex: boundaryLayer.getZIndex(),
            featureCount: boundaryLayer.getSource()?.getFeatures().length,
            extent: boundaryLayer.getSource()?.getExtent()
          })
          
          // 🔍 Simple layer confirmation (minimal debugging to avoid rendering issues)
          console.log('✅ Boundary layer added successfully with z-index:', boundaryLayer.getZIndex())
          console.log('� Total map layers:', map.getLayers().getLength())
          
          // 🔍 DEBUG: Check mask layer availability
          console.log('🎭 Boundary data mask info:', {
            hasMaskLayer: !!boundaryData.maskLayer,
            maskSuccess: boundaryData.maskLayer?.success,
            maskLayerName: boundaryData.maskLayer?.maskLayerName
          })
          console.log('🔍 Full boundaryData structure:', JSON.stringify(boundaryData, null, 2))
          
          // Add mask layer if available OR create a simple inverse mask
          console.log('🔍 Mask condition check:', {
            hasBoundaryData: !!boundaryData,
            hasMaskLayer: !!boundaryData.maskLayer,
            maskSuccess: boundaryData.maskLayer?.success,
            maskLayerName: boundaryData.maskLayer?.maskLayerName,
            conditionResult: !!(boundaryData.maskLayer && boundaryData.maskLayer.success)
          })
          
          if (boundaryData.maskLayer && boundaryData.maskLayer.success) {
            console.log('🎭 Loading mask layer:', boundaryData.maskLayer.maskLayerName)
            
            const maskLayerName = boundaryData.maskLayer.maskLayerName
            try {
              if (maskLayerName) {
                // Add workspace prefix for GeoServer WFS request
                const fullMaskLayerName = `escap_climate:${maskLayerName}`
                const maskWfsUrl = getGeoServerWfsUrl(fullMaskLayerName)
                console.log('🔍 Fetching mask GeoJSON from WFS:', maskWfsUrl)
                
                const maskResponse = await fetch(maskWfsUrl)
                const maskGeojsonData = await maskResponse.json()
                
                if (maskGeojsonData && maskGeojsonData.features) {
                  console.log('✅ Retrieved mask GeoJSON data:', maskGeojsonData.features.length, 'features')
                  
                  const maskFeatures = geojsonFormat.readFeatures(maskGeojsonData, {
                    featureProjection: 'EPSG:4326',
                    dataProjection: 'EPSG:4326'
                  })
                  
                  const maskLayer = new VectorLayer({
                    source: new VectorSource({
                      features: maskFeatures
                    }),
                    style: new Style({
                      stroke: new Stroke({
                        color: '#333333',  // Darkest grey for professional look
                        width: 1           // Thinner stroke for mask
                      }),
                      fill: new Fill({
                        color: 'rgba(180, 180, 180, 0.6)'  // Same as non-selected regions
                      })
                    }),
                    zIndex: 9998,    // Very high z-index, just below boundary
                    visible: true,    // Explicitly set visible
                    opacity: 1.0      // Full opacity
                  })
                  maskLayer.set('layerType', 'countryMask')
                  
                  // 🔍 Check for existing mask layers before adding
                  const existingMaskLayers = map.getLayers().getArray().filter(layer => 
                    layer.get('layerType') === 'countryMask'
                  )
                  
                  if (existingMaskLayers.length > 0) {
                    console.log('🚨 Removing existing mask layers:', existingMaskLayers.length)
                    existingMaskLayers.forEach(layer => {
                      console.log('🗑️ Removing old mask layer')
                      map.removeLayer(layer)
                    })
                  }
                  
                  map.addLayer(maskLayer)
                  console.log('✅ Mask layer added successfully with z-index 9998')
                  
                  // 🔍 FORCE MASK TO TOP AFTER ADDING
                  maskLayer.setZIndex(9998)
                  console.log('🔧 Mask layer z-index set to 9998 (very high)')
                  
                  // 🔍 CRITICAL: Set up mask layer change monitoring only
                  maskLayer.on('change:visible', (event) => {
                    console.log('🚨 MASK LAYER VISIBILITY CHANGED:', event.target.getVisible())
                  })
                  
                  // 🔍 NO PERSISTENCE INTERVALS - they can cause rendering conflicts
                  console.log('✅ Mask layer monitoring set up without persistence intervals')
                  
                  // 🔍 DEBUG: Check mask layer properties
                  console.log('🔍 Mask layer debug info:', {
                    visible: maskLayer.getVisible(),
                    opacity: maskLayer.getOpacity(),
                    zIndex: maskLayer.getZIndex(),
                    featureCount: maskLayer.getSource()?.getFeatures().length,
                    extent: maskLayer.getSource()?.getExtent()
                  })
                } else {
                  console.error('❌ No mask features found in GeoServer response')
                }
              } else {
                console.error('❌ No mask layer name found')
              }
            } catch (maskError) {
              console.error('❌ Error loading mask from GeoServer:', maskError)
              console.log('🎭 Creating simple inverse mask as fallback...')
              createSimpleCountryMask(map, boundaryLayer)
            }
          } else {
            console.log('🚨 MASK NOT LOADED - Condition failed:', {
              hasMaskLayer: !!boundaryData.maskLayer,
              maskSuccess: boundaryData.maskLayer?.success,
              reason: !boundaryData.maskLayer ? 'No maskLayer in boundaryData' : 
                      !boundaryData.maskLayer.success ? 'maskLayer.success is false' : 'Unknown'
            })
            console.log('🎭 Creating simple inverse mask since GeoServer mask unavailable...')
            createSimpleCountryMask(map, boundaryLayer)
          }
          
          // Fit map to boundary extent - ENHANCED APPROACH
          const boundaryExtent = boundaryLayer.getSource()?.getExtent()
          console.log('🔍 Boundary extent raw:', boundaryExtent)
          console.log('🔍 Boundary extent finite check:', boundaryExtent?.every(coord => isFinite(coord)))
          
          if (boundaryExtent && boundaryExtent.every(coord => isFinite(coord))) {
            console.log('🔍 Fitting map to boundary extent:', boundaryExtent)
            console.log('🔍 Current view center before fit:', map.getView().getCenter())
            console.log('🔍 Current view zoom before fit:', map.getView().getZoom())
            
            // Enhanced fit with better settings for country zoom - instant for snappy performance
            map.getView().fit(boundaryExtent, {
              padding: [20, 20, 20, 20],    // More aggressive padding for closer country view
              maxZoom: 10                   // Higher max zoom for closer country view
              // No duration for instant zoom
            })
            
            // Immediately log the final result (no timeout needed)
            const newCenter = map.getView().getCenter()
            const newZoom = map.getView().getZoom()
            console.log('✅ Map fit complete - New center:', newCenter)
            console.log('✅ Map fit complete - New zoom:', newZoom)
            
            // 🏠 Store this as the original country view for the new country
            if (newCenter && newZoom) {
              originalCountryView.current = {
                center: newCenter,
                zoom: newZoom
              }
              console.log('🏠 Stored new original country view:', originalCountryView.current)
              
              // 🎯 Update the shared view state to match the auto-zoom
              onViewChange(newCenter as [number, number], newZoom)
              console.log('🎯 Updated shared view state to match auto-zoom')
            }
            
          } else {
            console.error('❌ Invalid boundary extent:', boundaryExtent)
            console.error('❌ Boundary layer source:', boundaryLayer.getSource())
            console.error('❌ Features count:', boundaryLayer.getSource()?.getFeatures().length)
          }
          
          // 🔍 Final status check (minimal to avoid rendering issues)
          console.log('✅ Boundary and mask loading complete')
          console.log('🔍 Final layer count:', map.getLayers().getLength())
          
          // Immediate layer status check (no delay for snappy performance)
          const allLayers = map.getLayers().getArray()
          const boundaryLayers = allLayers.filter(l => l.get('layerType') === 'boundary')
          const maskLayers = allLayers.filter(l => l.get('layerType') === 'countryMask')
          
          console.log('🔍 === IMMEDIATE LAYER STATUS CHECK ===')
          console.log('🔍 Total layers:', allLayers.length)
          console.log('🔍 Boundary layers:', boundaryLayers.length, boundaryLayers.map(l => ({
            visible: l.getVisible(),
            zIndex: l.getZIndex(),
            opacity: l.getOpacity()
          })))
          console.log('🔍 Mask layers:', maskLayers.length, maskLayers.map(l => ({
            visible: l.getVisible(), 
            zIndex: l.getZIndex(),
            opacity: l.getOpacity()
          })))
          
          // If they exist but are invisible, make them visible immediately
          if (boundaryLayers.length > 0 && !boundaryLayers[0].getVisible()) {
            console.log('🚨 Boundary layer exists but invisible - making visible')
            boundaryLayers[0].setVisible(true)
          }
          if (maskLayers.length > 0 && !maskLayers[0].getVisible()) {
            console.log('🚨 Mask layer exists but invisible - making visible')
            maskLayers[0].setVisible(true)
          }
          
          // Simple render without forced sync
          map.render()
          
          // 🎯 Mark country as successfully loaded
          boundaryLoadedCountries.current.add(country)
          console.log(`✅ Country ${country} marked as successfully loaded`)
          
          // Update state
          setLayers(prev => [...prev, boundaryLayer])
          
        } else {
          console.error('❌ No features found in GeoJSON response')
        }

      } catch (error) {
        console.error('Failed to load boundary layer:', error)
        toast.error(`Failed to load boundary for ${country}: ${error.message}`)
        // Remove from loaded set on error so it can be retried
        boundaryLoadedCountries.current.delete(country)
      } finally {
        setBoundaryLoading(false)
      }
    }

    if (mapInstanceRef.current && country) {
      // 🚀 Use new parallel async layer loading
      loadBoundaryLayersOnly(mapInstanceRef.current, country)
        .then(result => {
          if (result) {
            boundaryLoadedCountries.current.add(country)
            console.log(`✅ All layers loaded successfully for ${country}`)
          }
        })
        .catch(error => {
          console.error(`❌ Failed to load layers for ${country}:`, error)
          toast.error(`Failed to load layers for ${country}: ${error.message}`)
        })
    }
  }, [country])

  // 🎯 Update layer styles when region selection changes
  useEffect(() => {
    if (!mapInstanceRef.current) return
    
    const map = mapInstanceRef.current
    const allLayers = map.getLayers().getArray()
    const boundaryLayers = allLayers.filter(layer => layer.get('layerType') === 'boundary')
    
    // Update style for all boundary layers with current selection state
    boundaryLayers.forEach(layer => {
      if (layer instanceof VectorLayer) {
        // Create new style function with current selectedRegion
        layer.setStyle((feature) => {
          const currentSelection = selectedRegion
          
          // 🔧 More reliable feature comparison using properties instead of object reference
          let isSelected = false
          if (currentSelection) {
            const featureProps = feature.getProperties()
            const featureName = featureProps[currentHoverAttribute.current] || featureProps.name || 'Unknown Region'  // Use dynamic attribute
            // 🎯 Compare with the stored region name directly
            isSelected = featureName === currentSelection.name
            
            // 🐛 Focused debug logging to track masking
            if (featureName === currentSelection.name) {
              console.log(`✅ FOUND MATCH: "${featureName}" - applying CLEAR styling (no mask)`)
            } else if (featureName.includes('Punakha') || currentSelection.name.includes('Punakha')) {
              console.log(`🎭 MASKING: Feature "${featureName}" vs Selected "${currentSelection.name}" = applying gray mask`)
            }
          }
          
          // 🐛 Debug logging to track masking behavior
          const featureName = feature.getProperties()[currentHoverAttribute.current] || feature.getProperties().name || 'Unknown Region'  // Use dynamic attribute
          
          // More aggressive masking: fade to 0.15 opacity for better contrast
          const hasSelection = Boolean(currentSelection)
          
          // 🎯 CORRECTED LOGIC: Selected region should be CLEAR, others should be MASKED
          let strokeColor, fillColor, strokeWidth
          
          if (currentSelection) {
            if (isSelected) {
              // 🌟 SELECTED REGION: Clear and prominent (NO MASKING)
              strokeColor = '#333333'  // Darkest grey for professional look
              fillColor = 'transparent'  // NO FILL - let the base map show through clearly
              strokeWidth = 2
            } else {
              // 😴 NON-SELECTED REGIONS: Heavily masked to fade into background
              strokeColor = 'rgba(51, 51, 51, 0.4)'  // Faded dark grey stroke
              fillColor = 'rgba(180, 180, 180, 0.6)'   // Light grey mask overlay
              strokeWidth = 1
            }
          } else {
            // 🌐 NO SELECTION: All regions completely clear (no fill at all)
            strokeColor = '#333333'  // Darkest grey for professional look
            fillColor = 'transparent'  // 🔧 FIXED: No fill in country view
            strokeWidth = 1
          }
          
          // Debug log for first few features
          if (currentSelection) {
            console.log(`🎭 Feature: "${featureName}" vs Selected: "${currentSelection.name}" → isSelected: ${isSelected}, stroke: ${strokeColor}`)
          }
          
          return new Style({
            stroke: new Stroke({
              color: strokeColor,
              width: strokeWidth,
              lineDash: [10, 5]
            }),
            fill: new Fill({
              color: fillColor
            })
          })
        })
        
        layer.changed()  // Force layer to re-render with new styles
      }
    })
    
    console.log(`🎯 Updated boundary layer styles for region selection:`, 
      selectedRegion ? selectedRegion.name : 'None selected')
  }, [selectedRegion])

  // 🎯 Handle overlay layer loading when user selects layers from sidebar
  useEffect(() => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
    console.log(`🔄 ===== OVERLAY USEEFFECT TRIGGERED FOR MAP ${id} @ ${timestamp} =====`)
    console.log(`🔄 allMapOverlays:`, allMapOverlays)
    console.log(`🔄 mapOverlays for this map:`, allMapOverlays?.[id])
    
    // Clear processed actions only for THIS map when ITS overlay state changes
    // This prevents interference from other maps' state changes
    const currentMapOverlays = allMapOverlays?.[id]
    if (currentMapOverlays) {
      console.log(`🧹 Clearing processed actions for map ${id} only (not affecting other maps)`)
      
      // Clear only this map's action tracking
      Object.keys(processedActionsRef.current).forEach(actionKey => {
        if (actionKey.startsWith(`${id}-`)) {
          delete processedActionsRef.current[actionKey]
        }
      })
    }
    
    if (!mapInstanceRef.current) return
    
    const map = mapInstanceRef.current
    
    // 🗑️ Handle EXPLICIT removal actions IMMEDIATELY (only for cross button clicks)
    if (currentMapOverlays) {
      const mapOverlays = currentMapOverlays
      
      for (const [overlayType, overlayData] of Object.entries(mapOverlays)) {
        const layerData = overlayData as any
        
        // Handle removal actions ONLY if they're explicit removals (not replacement-related)
        if (layerData?.action === 'remove' && (layerData?.explicitRemoval || layerData?.immediateClean)) {
          console.log(`🗑️ ===== EXPLICIT REMOVAL ACTION (CROSS BUTTON) =====`)
          console.log(`🗑️ Removing overlay type: ${overlayType}`)
          console.log(`🗑️ Immediate clean: ${layerData.immediateClean}`)
          
          const allLayers = map.getLayers().getArray()
          const targetLayer = allLayers.find(layer => {
            const layerName = layer.get('name')
            const layerType = layer.get('layerType')
            const overlayCategory = layer.get('overlayCategory')
            
            // Enhanced matching logic
            const nameMatch = layerName && layerName.includes(overlayType)
            const categoryMatch = overlayCategory && overlayCategory === overlayType
            const energyMatch = layerType === 'energy' && overlayType === 'energy'
            
            return nameMatch || categoryMatch || energyMatch
          })
          
          if (targetLayer) {
            map.removeLayer(targetLayer)
            setActiveLegend(null)
            console.log(`🗑️ Successfully removed layer ${overlayType} from map`)
          } else {
            console.log(`⚠️ Could not find layer for ${overlayType} to remove`)
          }
          
          // Clear the action after processing
          delete layerData.action
          delete layerData.explicitRemoval
          delete layerData.immediateClean
        }
      }
    }

    // 🎛️ Handle opacity and visibility actions directly on existing layers  
    const thisMapOverlays = allMapOverlays?.[id]
    if (thisMapOverlays) {
      const mapOverlays = thisMapOverlays
      let hasDirectActions = false
      
      for (const [overlayType, overlayData] of Object.entries(mapOverlays)) {
        const layerData = overlayData as any
        
        // Handle opacity and visibility actions
        if (layerData?.action === 'opacity' || layerData?.action === 'visibility') {
          // Create a unique action key for this map and overlay
          const actionKey = `${id}-${overlayType}-${layerData.action}-${layerData.opacity || layerData.visible}`
          
          // Skip if we already processed this exact action for this map
          if (processedActionsRef.current[actionKey]) {
            console.log(`⏭️ Skipping already processed ${layerData.action} action for ${overlayType} on map ${id}`)
            continue
          }
          
          hasDirectActions = true
          console.log(`🎛️ ===== HANDLING ${layerData.action.toUpperCase()} ACTION =====`)
          console.log(`🎛️ Map: ${id}, Overlay type: ${overlayType}`)
          console.log(`🎛️ Action data:`, layerData)
          
          // Mark this action as processed for this map
          processedActionsRef.current[actionKey] = `processed-${Date.now()}`
          
          // Find the matching layer
          const allLayers = map.getLayers().getArray()
          const targetLayer = allLayers.find(layer => {
            const layerName = layer.get('name')
            const layerType = layer.get('layerType')
            const overlayCategory = layer.get('overlayCategory')
            
            // Enhanced matching strategies
            const nameMatch = layerName && (layerName.includes(overlayType) || layerName.includes(layerData.name))
            const categoryMatch = overlayCategory && overlayCategory === overlayType
            const energyMatch = layerType === 'energy' && overlayType === 'energy'
            
            return nameMatch || categoryMatch || energyMatch
          })
          
          if (targetLayer) {
            console.log(`🎯 Found target layer: ${targetLayer.get('name')}`)
            
            if (layerData.action === 'opacity') {
              const opacityValue = layerData.opacity ? layerData.opacity / 100 : 0.7
              console.log(`🎛️ Setting opacity to: ${opacityValue} (${layerData.opacity}%)`)
              targetLayer.setOpacity(opacityValue)
            } else if (layerData.action === 'visibility') {
              const isVisible = layerData.visible !== false
              console.log(`👁️ Setting visibility to: ${isVisible}`)
              targetLayer.setVisible(isVisible)
            }
            
            console.log(`✅ ${layerData.action} applied successfully`)
          } else {
            console.log(`⚠️ Could not find target layer for ${overlayType} ${layerData.action} action`)
          }
          
          console.log(`✅ ${layerData.action} action processed for map ${id} - preserving action for other maps`)
          
          // Clean up old processed actions to prevent memory leaks (keep only recent ones)
          const now = Date.now()
          Object.keys(processedActionsRef.current).forEach(key => {
            const timestamp = parseInt(processedActionsRef.current[key].split('-')[1])
            if (now - timestamp > 5000) { // Remove actions older than 5 seconds
              delete processedActionsRef.current[key]
            }
          })
        }
      }
      
      // If we only had direct actions (opacity/visibility), don't proceed with full reload
      if (hasDirectActions) {
        const remainingActions = Object.values(mapOverlays).some((data: any) => 
          data?.action && data.action !== 'opacity' && data.action !== 'visibility'
        )
        
        if (!remainingActions) {
          console.log(`🎛️ Only direct actions processed - skipping full overlay reload`)
          return
        }
      }
    }
    
    // Handle layer removal when no overlays exist
    if (!currentMapOverlays) {
      // Remove all overlay layers
      const allLayers = map.getLayers().getArray()
      const overlayLayers = allLayers.filter(layer => 
        layer.get('layerType') === 'raster' || layer.get('layerType') === 'energy'
      )
      overlayLayers.forEach(layer => map.removeLayer(layer))
      setActiveLegend(null)
      console.log(`🧹 Removed all overlay layers for map ${id}`)
      return
    }
    
    const mapOverlays = currentMapOverlays
    
    // Function to load specific raster overlay
    const loadRasterOverlay = async (overlayType: string, overlayData: any) => {
      try {
        console.log(`🎯 ===== LOADING ${overlayType.toUpperCase()} OVERLAY =====`)
        console.log(`🎯 Overlay data:`, overlayData)
        console.log(`🎯 Map ID: ${id}`)
        console.log(`🎯 Current mapOverlays:`, mapOverlays)
        
        // Get all uploaded rasters for the current country
        console.log('🌐 Fetching rasters from:', API_ENDPOINTS.rasters)
        const response = await fetch(API_ENDPOINTS.rasters)
        
        console.log('📡 Response status:', response.status, response.statusText)
        console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()))
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const responseText = await response.text()
        console.log('📄 Raw response (first 200 chars):', responseText.substring(0, 200))
        
        let data
        try {
          data = JSON.parse(responseText)
        } catch (parseError) {
          console.error('❌ JSON Parse Error:', parseError)
          console.error('🔍 Response was not JSON. Full response:', responseText)
          throw new Error(`Response was not valid JSON: ${parseError.message}`)
        }
        
        if (!data.success || !data.rasters) {
          console.warn('No raster data available')
          return
        }
        
        // Filter rasters that match the overlay selection with precise matching
        console.log(`🔍 Overlay data for filtering:`, overlayData)
        console.log(`🔍 Available rasters:`, data.rasters.map(r => ({
          name: r.name,
          layerName: r.layerName,
          subcategory: r.subcategory,
          scenario: r.scenario,
          season: r.season,
          yearRange: r.yearRange,
          seasonality: r.seasonality
        })))
        
        const matchingRasters = data.rasters.filter((raster: any) => {
          const countryMatch = raster.country?.toLowerCase() === country.toLowerCase()
          
          // Match by category (climate, giri, energy) and other criteria with precise matching
          let categoryMatch = false
          if (overlayType === 'climate') {
            // Be much more specific for climate data matching
            const subcategoryMatch = raster.subcategory?.toLowerCase() === overlayData.name?.toLowerCase()
            const scenarioMatch = !overlayData.scenario || raster.scenario?.toLowerCase() === overlayData.scenario?.toLowerCase()
            const seasonMatch = !overlayData.season || raster.season?.toLowerCase() === overlayData.season?.toLowerCase()
            const yearRangeMatch = !overlayData.yearRange || raster.yearRange === overlayData.yearRange
            const seasonalityMatch = !overlayData.seasonality || raster.seasonality?.toLowerCase() === overlayData.seasonality?.toLowerCase()
            
            categoryMatch = raster.category?.toLowerCase() === 'climate' && 
                          subcategoryMatch && 
                          scenarioMatch && 
                          seasonMatch && 
                          yearRangeMatch && 
                          seasonalityMatch
            
            console.log(`🔍 Checking raster ${raster.layerName}:`, {
              rasterSeason: raster.season,
              overlayDataSeason: overlayData.season,
              rasterScenario: raster.scenario,
              overlayDataScenario: overlayData.scenario,
              subcategoryMatch, scenarioMatch, seasonMatch, yearRangeMatch, seasonalityMatch, categoryMatch
            })
          } else if (overlayType === 'giri') {
            // GIRI matching - check if the layer name contains both the hazard type and scenario
            const rasterLayerName = raster.layerName?.toLowerCase() || raster.name?.toLowerCase() || ''
            
            // Match hazard type (flood, drought, etc.)
            const giriNameMatch = rasterLayerName.includes(overlayData.name?.toLowerCase() || '')
            
            // Match scenario (existing, ssp1, ssp5, etc.) - check if layer name contains the scenario
            const giriScenarioMatch = !overlayData.scenario || 
                                    rasterLayerName.includes(`_${overlayData.scenario?.toLowerCase()}_`) ||
                                    rasterLayerName.includes(`${overlayData.scenario?.toLowerCase()}_`) ||
                                    rasterLayerName.endsWith(`_${overlayData.scenario?.toLowerCase()}`)
            
            categoryMatch = raster.category?.toLowerCase() === 'giri' && 
                          giriNameMatch && 
                          giriScenarioMatch
                          
            console.log(`🔍 Checking GIRI raster ${raster.layerName}:`, {
              rasterLayerName,
              overlayName: overlayData.name,
              overlayScenario: overlayData.scenario,
              giriNameMatch, 
              giriScenarioMatch, 
              categoryMatch
            })
          } else if (overlayType === 'energy') {
            categoryMatch = raster.category?.toLowerCase() === 'energy'
          }
          
          return countryMatch && categoryMatch
        })
        
        console.log(`🔍 Found ${matchingRasters.length} matching ${overlayType} rasters:`, matchingRasters)
        
        // Note: Overlay removal is now handled globally before loading, so just add the new overlay
        console.log(`➕ Adding new ${overlayType} overlay (removal handled globally)`)
        
        // Add new raster layers and track which raster to use for legend
        let addedRaster: any = null
        for (const raster of matchingRasters) {
          try {
            const rasterLayer = new ImageLayer({
              source: new ImageWMS({
                url: `${API_CONFIG.GEOSERVER.BASE_URL}/${API_CONFIG.GEOSERVER.WORKSPACE}/wms`,
                params: {
                  'LAYERS': `escap_climate:${raster.layerName}`,
                  'FORMAT': 'image/png',
                  'VERSION': '1.1.1',
                  'TRANSPARENT': true,
                  'BGCOLOR': '0x000000',  // Transparent background
                  'EXCEPTIONS': 'application/vnd.ogc.se_inimage'  // Handle errors gracefully
                },
                serverType: 'geoserver',
                crossOrigin: 'anonymous'
              }),
              opacity: 0.7,
              zIndex: 1000 + Math.floor(Math.random() * 100) // Raster layers above base but below boundaries
            })
            
            // Set layer metadata
            rasterLayer.set('layerType', 'raster')
            rasterLayer.set('overlayCategory', overlayType)
            rasterLayer.set('rasterData', raster)
            rasterLayer.set('name', `${overlayType}_${raster.layerName}`)
            
            map.addLayer(rasterLayer)
            console.log(`✅ ===== SUCCESSFULLY ADDED ${overlayType.toUpperCase()} RASTER LAYER =====`)
            console.log(`✅ Layer name: ${raster.layerName}`)
            console.log(`✅ Z-index: ${rasterLayer.getZIndex()}`)
            console.log(`✅ Total layers after addition: ${map.getLayers().getLength()}`)
            
            // Track the raster that was actually added (use the last one if multiple match)
            addedRaster = raster
            
            // 📢 Notify parent component about the new overlay
            if (onOverlayChange) {
              onOverlayChange(id, 'add', {
                type: overlayType,
                name: raster.layerName,
                layer: rasterLayer
              })
            }
            
          } catch (error) {
            console.error(`❌ Failed to add raster layer ${raster.layerName}:`, error)
          }
        }
        
        // 🎨 Set legend data for the actually added raster (not just the first matching one)
        if (addedRaster) {
          const primaryRaster = addedRaster
          const legendTitle = generateLegendTitle(primaryRaster)
          
          // Use server-provided legend data if available, otherwise use defaults
          let classifications
          let statistics
          
          if (primaryRaster.legend && (primaryRaster.legend.classifications || primaryRaster.legend.classes)) {
            // Use server-provided legend data (true classification info)
            const legendClasses = primaryRaster.legend.classifications || primaryRaster.legend.classes
            classifications = legendClasses.map((cls: any) => ({
              id: `server_${cls.min}_${cls.max}`,
              min: cls.min,
              max: cls.max,
              color: cls.color,
              label: cls.label || `${cls.min} - ${cls.max}`
            }))
            
            // Use server-provided raster statistics
            statistics = primaryRaster.legend.rasterStats ? {
              min: primaryRaster.legend.rasterStats.min,
              max: primaryRaster.legend.rasterStats.max,
              mean: primaryRaster.legend.rasterStats.mean,
              stdDev: primaryRaster.legend.rasterStats.stdDev
            } : {
              min: Math.min(...classifications.map((c: any) => c.min)),
              max: Math.max(...classifications.map((c: any) => c.max))
            }
            
            console.log(`🎨 Using server-provided legend data for ${primaryRaster.layerName}`)
          } else {
            // Fallback to default classifications for old rasters without server legend data
            const defaultClassifications = generateDefaultClassifications(primaryRaster, overlayType)
            classifications = defaultClassifications
            statistics = {
              min: Math.min(...classifications.map((c: any) => c.min)),
              max: Math.max(...classifications.map((c: any) => c.max))
            }
            
            console.log(`🎨 Using default legend data for ${primaryRaster.layerName} (no server legend available)`)
          }
          
          setActiveLegend({
            type: overlayType as 'climate' | 'giri',
            title: legendTitle,
            classifications: classifications,
            statistics: statistics
          })
          
          console.log(`🎨 Legend set for ${overlayType}: ${legendTitle}`, classifications)
        }
        
      } catch (error) {
        console.error(`❌ Failed to load ${overlayType} overlay:`, error)
        // Clear legend on error
        setActiveLegend(null)
      }
    }

    // Function to create energy infrastructure style based on configuration
    const createEnergyStyle = (energyInfra: any, feature?: any) => {
      const energyConfig = energyInfra.energyConfig
      
      // Default style values
      let iconStyle: Icon | null = null
      let circleRadius = 6 // Default radius
      let fillColor = '#ffeb3b' // Default yellow
      let strokeColor = '#f57f17' // Default dark yellow
      
      // Handle capacity-based sizing if configured
      if (energyConfig?.capacityAttribute && feature) {
        const capacity = feature.get(energyConfig.capacityAttribute)
        console.log(`🔍 Capacity check for ${energyInfra.name}: attribute="${energyConfig.capacityAttribute}", value="${capacity}", type="${typeof capacity}"`)
        
        if (capacity !== undefined && capacity !== null) {
          const numCapacity = parseFloat(capacity)
          if (!isNaN(numCapacity) && numCapacity > 0) {
            // Scale radius based on capacity with better scaling for power plants
            // Range: 783 MW (smallest) to 2640 MW (largest)
            const minCapacity = 500 // MW
            const maxCapacity = 3000 // MW  
            const minRadius = 6
            const maxRadius = 24
            
            // Linear scaling with capacity bounds
            const normalizedCapacity = Math.min(Math.max(numCapacity, minCapacity), maxCapacity)
            const scaleFactor = (normalizedCapacity - minCapacity) / (maxCapacity - minCapacity)
            circleRadius = minRadius + scaleFactor * (maxRadius - minRadius)
            
            console.log(`📏 Scaled radius for ${energyInfra.name}: ${Math.round(circleRadius)} px (capacity: ${numCapacity} MW, normalized: ${normalizedCapacity})`)
          }
        }
      }
      
      // Handle custom PNG icons if configured and available
      if (energyConfig?.useCustomIcon && energyConfig?.customIconFilename) {
        try {
          // Calculate icon scale based on capacity (smaller range with better differentiation)
          const minScale = 0.025  // Very tiny minimum for small capacity plants
          const maxScale = 0.08   // Small maximum for large capacity plants
          const capacityScale = circleRadius / 150 // Adjusted base scaling for new range
          const iconScale = Math.max(minScale, Math.min(maxScale, capacityScale))
          
          const iconSrc = `${API_BASE_URL}/api/geoserver/energy-icon/${energyInfra.layerName}`
          console.log(`🔗 Icon URL: ${iconSrc}`)
          
          iconStyle = new Icon({
            src: iconSrc,
            scale: iconScale,
            crossOrigin: 'anonymous',
            anchor: [0.5, 0.5], // Center the icon
            anchorXUnits: 'fraction',
            anchorYUnits: 'fraction'
          })
          
          // Add load event listeners for debugging
          const img = new Image()
          img.onload = () => {
            console.log(`✅ PNG icon loaded successfully: ${iconSrc} (${img.width}x${img.height})`)
          }
          img.onerror = (err) => {
            console.error(`❌ PNG icon failed to load: ${iconSrc}`, err)
          }
          img.src = iconSrc
          
          console.log(`🖼️ Using custom PNG icon for ${energyInfra.name} (${energyConfig.customIconFilename}) scale: ${iconScale}`)
        } catch (iconError) {
          console.error(`❌ Failed to load custom icon for ${energyInfra.name}:`, iconError)
          iconStyle = null // Fall back to circle
        }
      } else if (energyConfig?.useCustomIcon && !energyConfig?.customIconFilename) {
        // Custom icon was requested but file is missing - use distinctive color
        console.log(`⚠️ Custom icon missing for ${energyInfra.name}, using fallback style`)
        fillColor = '#e91e63' // Pink for missing custom icons
        strokeColor = '#ad1457'
      } else if (energyConfig?.selectedIcon && energyConfig.selectedIcon !== 'custom') {
        console.log(`🎨 Applying predefined icon style: ${energyConfig.selectedIcon} for ${energyInfra.name}`)
        
        // Handle predefined icon selection with colored circles
        switch (energyConfig.selectedIcon) {
          case 'power-plant':
            fillColor = '#ff5722' // Red-orange for power plants
            strokeColor = '#d84315'
            console.log(`🔴 Power plant style: ${fillColor}`)
            break
          case 'transmission':
            fillColor = '#2196f3' // Blue for transmission
            strokeColor = '#1565c0'
            console.log(`🔵 Transmission style: ${fillColor}`)
            break
          case 'substation':
            fillColor = '#9c27b0' // Purple for substations
            strokeColor = '#7b1fa2'
            console.log(`🟣 Substation style: ${fillColor}`)
            break
          case 'renewable':
            fillColor = '#4caf50' // Green for renewable
            strokeColor = '#2e7d32'
            console.log(`🟢 Renewable style: ${fillColor}`)
            break
          default:
            console.log(`⚠️ Unknown selectedIcon: ${energyConfig.selectedIcon}, using default yellow`)
        }
      } else {
        console.log(`⚠️ No icon configuration found for ${energyInfra.name}:`, {
          selectedIcon: energyConfig?.selectedIcon,
          customIconFilename: energyConfig?.customIconFilename,
          energyConfig: energyConfig
        })
      }
      
      // Create the final style
      const style = new Style({
        image: iconStyle || new Circle({
          radius: circleRadius,
          fill: new Fill({ color: fillColor }),
          stroke: new Stroke({ color: strokeColor, width: 2 })
        })
      })
      
      return style
    }

    // Function to load energy infrastructure overlay (vector data)
    const loadEnergyOverlay = async (overlayType: string, overlayData: any) => {
      try {
        // Safety check for undefined overlayData
        if (!overlayData) {
          console.warn(`⚠️ Energy overlay data is undefined for type: ${overlayType}`)
          return
        }
        
        // Safety check for undefined country
        if (!country) {
          console.warn(`⚠️ Country is undefined when loading energy overlay for type: ${overlayType}`)
          return
        }
        
        console.log(`⚡ Loading ${overlayType} energy overlay:`, overlayData)
        console.log(`🌍 Current country: ${country}`)
        
        // Get all uploaded energy infrastructure for the current country
        console.log('🌐 Fetching energy infrastructure from:', API_ENDPOINTS.energyInfrastructure)
        const response = await fetch(API_ENDPOINTS.energyInfrastructure)
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const data = await response.json()
        
        if (!data.success || !data.data) {
          console.warn('No energy infrastructure data available')
          return
        }
        
        // Filter energy infrastructure that matches the overlay selection
        console.log(`🔍 DEBUG - About to filter energy data:`)
        console.log(`  - data.data length: ${data.data ? data.data.length : 'undefined'}`)
        console.log(`  - country variable: ${country} (type: ${typeof country})`)
        console.log(`  - overlayData: ${JSON.stringify(overlayData)}`)
        
        const matchingEnergy = data.data.filter((energy: any, index: number) => {
          console.log(`🔍 Processing energy item ${index}:`, energy)
          
          // Null-safe string comparisons with detailed logging
          const energyCountry = energy && energy.country && typeof energy.country === 'string' ? energy.country.toLowerCase() : ''
          const currentCountry = country && typeof country === 'string' ? country.toLowerCase() : ''
          const countryMatch = energyCountry === currentCountry
          
          console.log(`  - energyCountry: "${energyCountry}" (from: ${energy ? energy.country : 'null'})`)
          console.log(`  - currentCountry: "${currentCountry}" (from: ${country})`)
          console.log(`  - countryMatch: ${countryMatch}`)
          
          // More flexible matching - check for power plants (including hydro, solar, wind, etc.)
          const overlayName = overlayData && overlayData.name && typeof overlayData.name === 'string' ? overlayData.name.toLowerCase() : ''
          const energySubcat = energy && energy.subcategory && typeof energy.subcategory === 'string' ? energy.subcategory.toLowerCase() : ''
          const energyName = energy && energy.name && typeof energy.name === 'string' ? energy.name.toLowerCase() : ''
          
          // If searching for any type of power plant, match power-plant subcategory
          // Also match specific types like hydro, solar, wind
          const typeMatch = (overlayName.includes('power') && energySubcat.includes('power')) ||
                           (overlayName.includes('hydro') && energyName.includes('hydro')) ||
                           (overlayName.includes('solar') && energyName.includes('solar')) ||
                           (overlayName.includes('wind') && energyName.includes('wind')) ||
                           energySubcat === 'power-plant' // Include all power plants by default
          
          console.log(`🔍 Matching: ${energyName || 'unnamed'} (${energySubcat || 'no-category'}) against ${overlayName || 'no-overlay'}`)
          console.log(`    Country match: ${countryMatch}, Type match: ${typeMatch}`)
          return countryMatch && typeMatch
        })
        
        console.log(`🔍 Found ${matchingEnergy.length} matching ${overlayType} energy infrastructure:`, matchingEnergy)
        
        // Note: Energy overlay removal is now handled globally before loading
        console.log(`➕ Adding new energy infrastructure layers (removal handled globally)`)
        
        // Add new energy infrastructure layers (vector/WFS)
        for (const energyInfra of matchingEnergy) {
          // Null-safe layer name handling
          const layerName = energyInfra.layerName || energyInfra.name || 'unknown_layer'
          
          try {
            const vectorLayer = new VectorLayer({
              source: new VectorSource({
                format: new GeoJSON(),
                url: getGeoServerWfsUrl(`escap_climate:${layerName}`)
              }),
              style: (feature) => {
                // Use dynamic styling based on energy configuration and feature properties
                return createEnergyStyle(energyInfra, feature)
              },
              zIndex: 10000 // Energy layers on TOP for best interaction (highest priority)
            })
            
            // Set layer metadata
            vectorLayer.set('layerType', 'energy')
            vectorLayer.set('overlayCategory', overlayType)
            vectorLayer.set('energyData', energyInfra)
            vectorLayer.set('name', `energy_${layerName}`)
            
            map.addLayer(vectorLayer)
            console.log(`✅ Added energy infrastructure layer: ${layerName}`)
            
          } catch (error) {
            console.error(`❌ Failed to add energy layer ${layerName}:`, error)
          }
        }
        
      } catch (error) {
        console.error(`❌ Failed to load ${overlayType} energy overlay:`, error)
      }
    }
    
    // Simplified approach: Remove ALL existing overlays first, then load only what should exist
    console.log(`🧹 ===== GLOBAL OVERLAY CLEANUP PHASE =====`)
    console.log(`🧹 Map ID: ${id}`)
    console.log(`🧹 Current mapOverlays state:`, mapOverlays)
    
    // Remove ALL existing overlay layers first  
    const allLayers = map.getLayers().getArray()
    console.log(`🔍 Total layers on map before cleanup: ${allLayers.length}`)
    
    const existingOverlays = allLayers.filter(layer => 
      layer.get('layerType') === 'raster' || layer.get('layerType') === 'energy'
    )
    
    console.log(`� Found ${existingOverlays.length} existing overlay layers to remove`)
    
    if (existingOverlays.length > 0) {
      existingOverlays.forEach((layer, index) => {
        const overlayCategory = layer.get('overlayCategory') || layer.get('layerType')
        const layerName = layer.get('name')
        const zIndex = layer.getZIndex()
        console.log(`🗑️ [${index + 1}] Removing: ${overlayCategory} - ${layerName} (z-index: ${zIndex})`)
        map.removeLayer(layer)
      })
      setActiveLegend(null)
      console.log(`✅ Cleared legend due to global overlay removal`)
      console.log(`✅ All existing overlays removed. Remaining layers: ${map.getLayers().getLength()}`)
    } else {
      console.log(`ℹ️ No existing overlays to remove`)
    }
    
    // Load overlays for each category (only those without remove action)
    console.log(`🔄 ===== OVERLAY LOADING PHASE =====`)
    const overlayEntries = Object.entries(mapOverlays)
    console.log(`🔄 Processing ${overlayEntries.length} overlay entries:`, overlayEntries.map(([type, data]) => ({type, hasAction: (data as any)?.action})))
    
    for (const [overlayType, overlayData] of overlayEntries) {
      if (overlayData && typeof overlayData === 'object') {
        const layerData = overlayData as any
        
        console.log(`\n🔍 ===== PROCESSING ${overlayType.toUpperCase()} OVERLAY =====`)
        console.log(`🔍 Overlay data:`, layerData)
        console.log(`🔍 Has action property:`, layerData.action)
        
        // Skip loading if it's a remove action
        if (layerData.action === 'remove') {
          console.log(`⏭️ SKIPPING ${overlayType} overlay (marked for removal)`)
          continue
        }
        
        console.log(`▶️ LOADING ${overlayType} overlay`)
        
        if (overlayType === 'energy') {
          loadEnergyOverlay(overlayType, overlayData)
        } else {
          loadRasterOverlay(overlayType, overlayData)
        }
      } else {
        console.log(`⚠️ Invalid overlay data for ${overlayType}:`, overlayData)
      }
    }
    
    console.log(`🏁 ===== OVERLAY LOADING PHASE COMPLETE =====`)
    
    // Add a summary of what should be on the map now
    setTimeout(() => {
      const finalLayers = map.getLayers().getArray()
      const finalOverlays = finalLayers.filter(layer => 
        layer.get('layerType') === 'raster' || layer.get('layerType') === 'energy'
      )
      console.log(`📊 ===== FINAL MAP STATE SUMMARY =====`)
      console.log(`📊 Total layers: ${finalLayers.length}`)
      console.log(`📊 Overlay layers: ${finalOverlays.length}`)
      finalOverlays.forEach((layer, index) => {
        const category = layer.get('overlayCategory') || layer.get('layerType')
        const name = layer.get('name')
        const visible = layer.getVisible()
        const zIndex = layer.getZIndex()
        console.log(`📊 [${index + 1}] ${category}: ${name} (visible: ${visible}, z-index: ${zIndex})`)
      })
      console.log(`📊 ===== END SUMMARY =====\n`)
    }, 50)
    
    // Handle layer management actions AFTER loading (with a small delay to ensure layers are loaded)
    setTimeout(() => {
      for (const [overlayType, overlayData] of Object.entries(mapOverlays)) {
        if (overlayData && typeof overlayData === 'object' && (overlayData as any).action) {
          const layerData = overlayData as any
          console.log(`🎛️ Handling ${layerData.action} action for ${overlayType}:`, layerData)
          
          // Find the specific layer
          const allLayers = map.getLayers().getArray()
          const targetLayer = allLayers.find(layer => {
            const layerName = layer.get('name')
            const layerType = layer.get('layerType')
            const overlayCategory = layer.get('overlayCategory')
            
            // Enhanced matching logic
            const nameMatch = layerName && layerName.includes(overlayType)
            const categoryMatch = overlayCategory && overlayCategory === overlayType
            const energyMatch = layerType === 'energy' && overlayType === 'energy'
            
            return nameMatch || categoryMatch || energyMatch
          })
          
          if (targetLayer) {
            switch (layerData.action) {
              case 'opacity':
                const opacityValue = (layerData.opacity || 100) / 100
                targetLayer.setOpacity(opacityValue)
                console.log(`🎛️ Updated opacity to ${layerData.opacity}% for ${overlayType}`)
                break
                
              case 'visibility':
                targetLayer.setVisible(layerData.visible !== false)
                console.log(`👁️ Set visibility to ${layerData.visible} for ${overlayType}`)
                break
                
              case 'remove':
                map.removeLayer(targetLayer)
                setActiveLegend(null)
                console.log(`🗑️ Removed layer ${overlayType} from map`)
                break
            }
          } else {
            console.log(`⚠️ Could not find layer for ${overlayType} to apply ${layerData.action}`)
          }
          
          // Clear the action after processing
          delete layerData.action
        }
      }
    }, 100) // Small delay to ensure layers are loaded
    
  }, [allMapOverlays?.[id], id, country]) // Only depend on THIS map's overlays, not all maps

  // Check if there are any climate or giri layers in this map
  const hasClimateOrGiriLayer = overlayInfo && (
    (overlayInfo.type === 'climate' || overlayInfo.type === 'giri') ||
    ((overlayInfo as any).climate) || 
    ((overlayInfo as any).giri)
  )

  return (
    <div className="w-full h-full flex flex-col">
      {/* 🎨 Header for 4-map layout only - showing layer name and legend toggle */}
      {mapLayout === 4 && hasClimateOrGiriLayer && (
        <div className="flex-shrink-0 bg-gradient-to-r from-slate-50 to-gray-50 border border-gray-300 border-b-2 border-b-blue-200 shadow-sm px-3 py-1.5">
          <div className="flex items-center justify-between min-h-[24px]">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-gray-900 truncate leading-tight tracking-wide font-sans" title={formatLayerName(overlayInfo)}>
                {formatLayerName(overlayInfo)}
              </h3>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowLegend(!showLegend)
              }}
              className={`flex-shrink-0 ml-3 px-2 py-1 text-xs font-semibold rounded-md border-2 border-gray-600 transition-all duration-200 hover:shadow-md ${
                showLegend 
                  ? 'bg-white text-gray-600 hover:bg-gray-50' 
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
              title={showLegend ? 'Hide Legend' : 'Show Legend'}
            >
              {showLegend ? 'Hide Legend' : 'Show Legend'}
            </button>
          </div>
        </div>
      )}
      
      {/* Map container */}
      <div className="relative flex-1 w-full">
        <div
          ref={mapRef}
          className="w-full h-full cursor-pointer"
          onClick={onActivate}
        />
      
        {/* Hover tooltip - positioned close to cursor */}
      {hoverInfo.visible && (
        <div 
          className="absolute bg-white border border-gray-300 rounded-lg shadow-lg p-2 text-sm z-50 pointer-events-none"
          style={{
            left: hoverInfo.x + 5,   // Closer to cursor - reduced from 10
            top: hoverInfo.y - 30,   // Closer to cursor - reduced from 40
          }}
        >
          <div className="font-semibold text-blue-600">
            {hoverInfo.text.split('\n').map((line, index) => (
              <div key={index}>{line}</div>
            ))}
          </div>
        </div>
        )}

        {/* Loading indicator */}
        {boundaryLoading && (
          <div className="absolute top-4 left-4 bg-white px-3 py-2 rounded shadow-lg">
            <span className="text-sm">Loading boundary...</span>
          </div>
        )}

        {/* Zoom back to country button - appears when region is selected */}
        {selectedRegion && (
          <button
            onClick={zoomBackToCountry}
            className="absolute top-4 left-20 bg-green-500 hover:bg-green-600 text-white p-2 rounded shadow-lg text-sm font-medium z-50 flex items-center justify-center"
            title={`Back to ${country} view`}
          >
            <ArrowLeft size={16} />
          </button>
        )}        {/* 🎨 Adaptive Raster Legend - Different styles for different map layouts */}
        {activeLegend && (mapLayout === 4 ? showLegend : true) && (
          <div className={`
            absolute z-50 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200/60
            ${mapLayout === 4 
              ? 'top-2 right-2 p-1.5 w-32 text-xs'
              : 'top-14 left-4 p-3 w-48 max-w-xs'
            }
          `}>
            {/* Conditional Legend Heading - Hide in 4-map layout */}
            {mapLayout !== 4 && (
              <div className="font-medium text-sm mb-2 text-gray-900 border-b border-gray-100 pb-1">
                {activeLegend.title}
              </div>
            )}
            
            {/* Adaptive Classification List */}
            <ul className={mapLayout === 4 ? 'space-y-0.5' : 'space-y-1'}>
              {activeLegend.classifications.map((cls, idx) => (
                <li key={cls.id || `legend_${idx}`} className="flex items-center">
                  <div 
                    className={`rounded shadow-sm border border-gray-300 flex-shrink-0 ${
                      mapLayout === 4 ? 'w-2.5 h-2.5 mr-1' : 'w-4 h-4 mr-2'
                    }`}
                    style={{ backgroundColor: cls.color }}
                  ></div>
                  <span className={`text-gray-700 font-medium truncate ${
                    mapLayout === 4 ? 'text-xs' : 'text-sm'
                  }`}>
                    {cls.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}