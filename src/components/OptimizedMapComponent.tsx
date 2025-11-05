import React, { useEffect, useRef, useState } from 'react'
// import mapboxgl from 'mapbox-gl'
// import 'mapbox-gl/dist/mapbox-gl.css'
import { boundaryTileService } from '../services/boundaryTileService'
import { useBoundaryLayers } from '../contexts/BoundaryLayerContext'

// For now, we'll use a placeholder for mapboxgl until the package is installed
// You can install it with: npm install mapbox-gl @types/mapbox-gl
declare const mapboxgl: any

// Check if mapboxgl is available before accessing it
if (typeof mapboxgl !== 'undefined') {
  // Set your Mapbox access token here
  mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN || 'your-mapbox-token'
}

interface MapProps {
  initialCenter?: [number, number]
  initialZoom?: number
  className?: string
  onBoundaryClick?: (properties: any) => void
  selectedBoundaries?: string[]
}

interface VectorTileLayer {
  id: string
  name: string
  visible: boolean
  source: string
  style: any
}

const OptimizedMapComponent: React.FC<MapProps> = ({
  initialCenter = [90, 23], // Default to Bangladesh region
  initialZoom = 6,
  className = "w-full h-96",
  onBoundaryClick,
  selectedBoundaries = []
}) => {
  // Check if mapboxgl is available, if not render a placeholder
  if (typeof mapboxgl === 'undefined') {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300`}>
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">Map Component</p>
          <p className="text-sm">Mapbox GL JS not loaded</p>
          <p className="text-xs mt-2">Install: npm install mapbox-gl</p>
        </div>
      </div>
    )
  }

  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [vectorLayers, setVectorLayers] = useState<VectorTileLayer[]>([])
  const boundaryService = boundaryTileService
  const { layers: boundaryLayers, addEventListener } = useBoundaryLayers()

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: initialCenter,
      zoom: initialZoom,
      antialias: true
    })

    map.current.on('load', () => {
      setMapLoaded(true)
      loadVectorTileLayers()
    })

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    // Add scale control
    map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left')

    return () => {
      map.current?.remove()
    }
  }, [])

  // Listen for boundary layer events to automatically add new layers
  useEffect(() => {
    if (!mapLoaded) return

    const cleanup = addEventListener((event) => {
      if (event.type === 'layer_added' && event.layerConfig) {
        // Automatically add newly uploaded boundary to map
        addVectorTileLayer(event.layerConfig)
        
        // Optionally fit map to new layer bounds
        if (event.layerConfig.boundingBox) {
          const [minX, minY, maxX, maxY] = event.layerConfig.boundingBox
          map.current?.fitBounds([[minX, minY], [maxX, maxY]], {
            padding: 50,
            duration: 2000
          })
        }
      } else if (event.type === 'layer_removed') {
        // Remove layer from map
        removeVectorTileLayer(event.layerId)
      }
    })

    return cleanup
  }, [mapLoaded, addEventListener])

  // Load vector tile layers from GeoServer
  const loadVectorTileLayers = async () => {
    if (!map.current) return

    try {
      // Load from boundary context instead of direct service call
      for (const tileLayer of boundaryLayers) {
        await addVectorTileLayer(tileLayer)
      }
    } catch (error) {
      console.error('Failed to load vector tile layers:', error)
    }
  }

  // Remove vector tile layer from map
  const removeVectorTileLayer = (layerId: string) => {
    if (!map.current) return

    const fillLayerId = `boundary-layer-${layerId}`
    const strokeLayerId = `boundary-layer-${layerId}-stroke`
    const sourceId = `boundary-${layerId}`

    // Remove layers if they exist
    if (map.current.getLayer(fillLayerId)) {
      map.current.removeLayer(fillLayerId)
    }
    if (map.current.getLayer(strokeLayerId)) {
      map.current.removeLayer(strokeLayerId)
    }
    
    // Remove source if it exists
    if (map.current.getSource(sourceId)) {
      map.current.removeSource(sourceId)
    }

    // Update local state
    setVectorLayers(prev => prev.filter(layer => layer.id !== layerId))
  }

  // Add vector tile layer to map
  const addVectorTileLayer = async (tileLayer: any) => {
    if (!map.current || !mapLoaded) return

    try {
      const tileUrl = tileLayer.tileUrl
      const sourceId = `boundary-${tileLayer.id}`
      const layerId = `boundary-layer-${tileLayer.id}`

      // Add vector tile source
      map.current.addSource(sourceId, {
        type: 'vector',
        tiles: [tileUrl],
        minzoom: 0,
        maxzoom: 14
      })

      // Add fill layer
      map.current.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        'source-layer': tileLayer.name,
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            '#ff6b6b', // Selected color
            '#4ecdc4'  // Default color
          ],
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.8,
            0.6
          ]
        }
      })

      // Add stroke layer
      map.current.addLayer({
        id: `${layerId}-stroke`,
        type: 'line',
        source: sourceId,
        'source-layer': tileLayer.name,
        paint: {
          'line-color': '#ffffff',
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            3,
            1
          ]
        }
      })

      // Add click handler
      map.current.on('click', layerId, (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0]
          
          // Toggle selection
          const isSelected = feature.state?.selected || false
          map.current?.setFeatureState(
            { source: sourceId, sourceLayer: tileLayer.name, id: feature.id },
            { selected: !isSelected }
          )

          // Call click handler
          if (onBoundaryClick && feature.properties) {
            onBoundaryClick({
              ...feature.properties,
              layerId: tileLayer.id,
              layerName: tileLayer.name
            })
          }
        }
      })

      // Add hover effects
      map.current.on('mouseenter', layerId, (e) => {
        map.current!.getCanvas().style.cursor = 'pointer'
        if (e.features && e.features.length > 0) {
          const feature = e.features[0]
          map.current?.setFeatureState(
            { source: sourceId, sourceLayer: tileLayer.name, id: feature.id },
            { hover: true }
          )
        }
      })

      map.current.on('mouseleave', layerId, (e) => {
        map.current!.getCanvas().style.cursor = ''
        if (e.features && e.features.length > 0) {
          const feature = e.features[0]
          map.current?.setFeatureState(
            { source: sourceId, sourceLayer: tileLayer.name, id: feature.id },
            { hover: false }
          )
        }
      })

      // Add to vector layers state
      setVectorLayers(prev => [...prev, {
        id: tileLayer.id,
        name: tileLayer.name,
        visible: true,
        source: sourceId,
        style: {
          fillColor: '#4ecdc4',
          strokeColor: '#ffffff',
          fillOpacity: 0.6,
          strokeWidth: 1
        }
      }])

    } catch (error) {
      console.error(`Failed to add vector tile layer ${tileLayer.name}:`, error)
    }
  }

  // Toggle layer visibility
  const toggleLayerVisibility = (layerId: string) => {
    if (!map.current) return

    const layer = vectorLayers.find(l => l.id === layerId)
    if (!layer) return

    const visibility = layer.visible ? 'none' : 'visible'
    
    map.current.setLayoutProperty(`boundary-layer-${layerId}`, 'visibility', visibility)
    map.current.setLayoutProperty(`boundary-layer-${layerId}-stroke`, 'visibility', visibility)

    setVectorLayers(prev => prev.map(l => 
      l.id === layerId ? { ...l, visible: !l.visible } : l
    ))
  }

  // Fit map to layer bounds
  const fitToLayer = async (layerId: string) => {
    if (!map.current) return

    try {
      const tileLayer = boundaryService.getTileConfigByCountry('', 0) // This needs to be updated to find by ID
      // For now, let's find the layer by ID from our vector layers
      const vectorLayer = vectorLayers.find(l => l.id === layerId)
      if (vectorLayer) {
        // Get the config from the boundary service
        const allConfigs = boundaryService.getAllTileConfigs()
        const config = allConfigs.find(c => c.id === layerId)
        
        if (config?.boundingBox) {
          const [minX, minY, maxX, maxY] = config.boundingBox
          map.current.fitBounds([[minX, minY], [maxX, maxY]], {
            padding: 50,
            duration: 1000
          })
        }
      }
    } catch (error) {
      console.error('Failed to fit to layer bounds:', error)
    }
  }

  // Reload layers when boundary context changes
  useEffect(() => {
    if (mapLoaded) {
      loadVectorTileLayers()
    }
  }, [boundaryLayers, mapLoaded])

  // Handle layer selection from props
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    vectorLayers.forEach(layer => {
      const isVisible = selectedBoundaries.includes(layer.id)
      const currentVisibility = map.current?.getLayoutProperty(`boundary-layer-${layer.id}`, 'visibility')
      
      if ((isVisible && currentVisibility === 'none') || (!isVisible && currentVisibility !== 'none')) {
        toggleLayerVisibility(layer.id)
      }
    })
  }, [selectedBoundaries, mapLoaded])

  return (
    <div className="relative">
      {/* Map Container */}
      <div 
        ref={mapContainer} 
        className={className}
        style={{ minHeight: '400px' }}
      />

      {/* Layer Controls */}
      {vectorLayers.length > 0 && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 max-w-xs">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Vector Layers</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {vectorLayers.map(layer => (
              <div key={layer.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={layer.visible}
                    onChange={() => toggleLayerVisibility(layer.id)}
                    className="rounded"
                  />
                  <span className="text-gray-700 truncate">{layer.name}</span>
                </div>
                <button
                  onClick={() => fitToLayer(layer.id)}
                  className="text-blue-600 hover:text-blue-800 ml-2"
                  title="Zoom to layer"
                >
                  📍
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {!mapLoaded && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="flex items-center gap-2 text-gray-600">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span>Loading high-performance map...</span>
          </div>
        </div>
      )}

      {/* Performance Info */}
      <div className="absolute bottom-4 right-4 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
        Vector Tiles • {vectorLayers.length} layers loaded
      </div>
    </div>
  )
}

export default OptimizedMapComponent