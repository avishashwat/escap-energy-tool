import React, { useEffect, useRef, useState } from 'react'
import { Map as OLMap, View } from 'ol'
import TileLayer from 'ol/layer/Tile'
import VectorTileLayer from 'ol/layer/VectorTile'
import VectorLayer from 'ol/layer/Vector'
import VectorTileSource from 'ol/source/VectorTile'
import VectorSource from 'ol/source/Vector'
import XYZ from 'ol/source/XYZ'
import { defaults as defaultControls } from 'ol/control'
import MVT from 'ol/format/MVT'
import { Style, Stroke, Fill, Text } from 'ol/style'
import { fromLonLat, transformExtent } from 'ol/proj'
import { Polygon, MultiPolygon, Point } from 'ol/geom'
import { LinearRing } from 'ol/geom'
import Feature from 'ol/Feature'
import 'ol/ol.css'

interface BoundaryFile {
  id: string
  name: string
  country: string
  vectorTileUrl?: string
  maskLayer?: {
    success: boolean
    maskLayerName: string
    vectorTileUrl: string
    processingTime?: number
  }
  processingMethod?: string
  hoverAttribute?: string
  attributes?: string[]
  metadata?: {
    featureCount: number
    bounds: [number, number, number, number]
  }
}

interface VectorTileMapComponentProps {
  boundaries: BoundaryFile[]
  onLayerToggle?: (layerId: string, visible: boolean) => void
}

export const VectorTileMapComponent: React.FC<VectorTileMapComponentProps> = ({ boundaries, onLayerToggle }) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<OLMap | null>(null)
  const [layerVisibility, setLayerVisibility] = useState<{ [key: string]: boolean }>({})
  const [boundaryLayers, setBoundaryLayers] = useState<VectorTileLayer[]>([])
  const [maskLayer, setMaskLayer] = useState<VectorLayer | null>(null)

  useEffect(() => {
    if (!mapRef.current) {
      console.error('❌ Map ref is not available')
      return
    }

    console.log('🗺️ Initializing OpenLayers map...')

    // Create base map with explicit basemap error handling
    const basemapSource = new XYZ({
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attributions: '© OpenStreetMap contributors',
      maxZoom: 18,
      crossOrigin: 'anonymous'
    })

    // Add basemap tile loading events
    basemapSource.on('tileloaderror', (event: any) => {
      console.error('❌ Basemap tile load error:', {
        url: event.tile?.src || 'unknown',
        error: event.error || 'unknown'
      })
    })

    basemapSource.on('tileloadend', (event: any) => {
      console.log('✅ Basemap tile loaded:', {
        url: event.tile?.src || 'unknown'
      })
    })

    basemapSource.on('tileloadstart', (event: any) => {
      console.log('🔄 Loading basemap tile:', {
        url: event.tile?.src || 'unknown'
      })
    })

    const map = new OLMap({
      target: mapRef.current,
      controls: defaultControls(),
      layers: [
        // Base layer - OpenStreetMap with error handling
        new TileLayer({
          source: basemapSource
        })
      ],
      view: new View({
        center: fromLonLat([89.5, 27.5]), // Bhutan center
        zoom: 7,
        enableRotation: false,
        constrainResolution: true
      })
    })

    console.log('✅ OpenLayers map created successfully')
    mapInstanceRef.current = map

    // Immediate visibility check
    console.log('🔍 Initial map layers count:', map.getLayers().getLength())
    map.getLayers().forEach((layer, index) => {
      console.log(`🔍 Layer ${index}:`, {
        visible: layer.getVisible(),
        opacity: layer.getOpacity(),
        source: (layer as any).getSource?.()?.constructor.name || 'unknown'
      })
    })

    // Add map load event listeners
    map.on('loadstart', () => {
      console.log('🔄 Map tiles loading...')
    })

    map.on('loadend', () => {
      console.log('✅ Map tiles loaded successfully')
    })

    // Force map to render after a brief delay
    setTimeout(() => {
      console.log('🔄 Forcing map to update size and render...')
      map.updateSize()
      map.render()
      
      // Check map container dimensions
      const mapDiv = mapRef.current
      if (mapDiv) {
        const rect = mapDiv.getBoundingClientRect()
        console.log('📏 Map container dimensions:', {
          width: rect.width,
          height: rect.height,
          visible: rect.width > 0 && rect.height > 0
        })
        
        // Force container visibility
        mapDiv.style.display = 'block'
        mapDiv.style.visibility = 'visible'
        mapDiv.style.opacity = '1'
        mapDiv.style.zIndex = '1'
      }
      
      // Force all layers to be visible
      map.getLayers().forEach((layer, index) => {
        console.log(`🔍 Layer ${index} visibility:`, layer.getVisible(), 'opacity:', layer.getOpacity())
        layer.setVisible(true)
        layer.setOpacity(1)
      })
      
      // Additional render attempts
      setTimeout(() => {
        map.updateSize()
        map.render()
        console.log('🔄 Additional render attempt completed')
      }, 500)
    }, 100)

    return () => {
      console.log('🧹 Cleaning up map instance')
      map.setTarget(undefined)
    }
  }, [])

  // Add vector tile layers when boundaries change
  useEffect(() => {
    if (!mapInstanceRef.current) {
      console.warn('⚠️ Map instance not ready for vector tile layers')
      return
    }
    
    if (boundaries.length === 0) {
      console.log('📍 No boundaries to display')
      return
    }

    console.log(`🚀 Processing ${boundaries.length} boundary file(s) for vector tiles...`)

    const map = mapInstanceRef.current

    // Initialize layer visibility state for all boundaries
    const initialVisibility: { [key: string]: boolean } = {}
    boundaries.forEach(boundary => {
      initialVisibility[boundary.id] = true
    })
    setLayerVisibility(initialVisibility)

    // Remove existing vector tile layers
    const layersToRemove = map.getLayers().getArray().filter(layer => 
      layer instanceof VectorTileLayer
    )
    
    if (layersToRemove.length > 0) {
      console.log(`🧹 Removing ${layersToRemove.length} existing vector tile layer(s)`)
      layersToRemove.forEach(layer => map.removeLayer(layer))
    }

    // Create custom tile URL function for WMS-style vector tiles
    const createTileUrlFunction = (baseUrl: string) => {
      return (tileCoord: [number, number, number]) => {
        const [z, x, y] = tileCoord
        
        // Calculate tile bounds in EPSG:4326 (WGS84)
        const n = Math.pow(2, z)
        const minLon = (x / n) * 360 - 180
        const maxLon = ((x + 1) / n) * 360 - 180
        const maxLat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI
        const minLat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180 / Math.PI
        
        // Replace the bbox placeholder with actual coordinates
        const url = baseUrl.replace('{bbox-epsg-4326}', `${minLon},${minLat},${maxLon},${maxLat}`)
        
        console.log(`🗺️ Loading vector tile [${z}/${x}/${y}] -> ${url}`)
        return url
      }
    }

    // Add new vector tile layers with error handling
    boundaries.forEach((boundary, index) => {
      if (!boundary.vectorTileUrl) {
        console.warn(`⚠️ No vector tile URL for boundary: ${boundary.name}`)
        console.warn(`⚠️ Boundary object:`, boundary)
        return
      }

      console.log(`🚀 Adding vector tile layer ${index + 1}/${boundaries.length}: ${boundary.name}`)
      console.log(`🔗 Vector tile URL: ${boundary.vectorTileUrl}`)
      console.log(`📊 Boundary metadata:`, boundary.metadata)
      console.log(`🏷️ Processing method: ${boundary.processingMethod}`)
      console.log(`🏷️ Hover attribute: ${boundary.hoverAttribute}`)
      console.log(`📋 Available attributes:`, boundary.attributes)
      const vectorTileLayer = new VectorTileLayer({
        source: new VectorTileSource({
          format: new MVT(),
          tileUrlFunction: createTileUrlFunction(boundary.vectorTileUrl),
          attributions: `Boundary: ${boundary.name}`,
          wrapX: false
        }),
        style: (feature, resolution) => {
          const styles: Style[] = []
          
          // Main polygon style - fully opaque and vibrant
          styles.push(new Style({
            stroke: new Stroke({
              color: `hsl(${(index * 137.5) % 360}, 70%, 45%)`, // Darker stroke
              width: 2
            }),
            fill: new Fill({
              color: `hsl(${(index * 137.5) % 360}, 60%, 65%)` // Solid, opaque fill
            })
          }))
          
          // Labels will be added dynamically on hover, not here
          return styles
        }
      })
      
      // Make labels clickable
      vectorTileLayer.set('boundary', boundary)
      vectorTileLayer.set('layerId', boundary.id)

      // Add error listener
      const source = vectorTileLayer.getSource()
      if (source) {
        source.on('tileloaderror', (event: any) => {
          console.error(`❌ Vector tile load error for ${boundary.name}:`, {
            url: event.tile?.src || 'unknown',
            error: event.error || 'unknown error',
            tileCoord: event.tile?.tileCoord || 'unknown'
          })
        })

        source.on('tileloadend', (event: any) => {
          console.log(`✅ Vector tile loaded successfully for ${boundary.name}:`, {
            url: event.tile?.src || 'unknown',
            tileCoord: event.tile?.tileCoord || 'unknown'
          })
        })

        source.on('tileloadstart', (event: any) => {
          console.log(`🔄 Loading vector tile for ${boundary.name}:`, {
            url: event.tile?.src || 'unknown',
            tileCoord: event.tile?.tileCoord || 'unknown'
          })
        })
      }

      map.addLayer(vectorTileLayer)
      setBoundaryLayers(prev => [...prev, vectorTileLayer])
    })

    // Add click handler for vector tile features
    map.on('click', async (event) => {
      console.log('🖱️ Map clicked at pixel:', event.pixel)
      console.log('🖱️ Coordinate:', event.coordinate)
      
      // Use forEachFeatureAtPixel for better vector tile detection
      let foundFeature = false
      map.forEachFeatureAtPixel(event.pixel, (feature, layer) => {
        if (layer instanceof VectorTileLayer && !foundFeature) {
          foundFeature = true
          const boundary = layer.get('boundary')
          const labelText = feature.get(boundary?.hoverAttribute)
          
          console.log(`🎯 Clicked on vector tile feature:`, {
            labelText,
            hoverAttribute: boundary?.hoverAttribute,
            featureProperties: feature.getProperties(),
            boundary: boundary?.name,
            layer: layer
          })
          
          if (labelText) {
            // Get feature geometry and zoom to it
            const geometry = feature.getGeometry()
            if (geometry) {
              const extent = geometry.getExtent()
              console.log('🎯 Zooming to feature extent:', extent)
              
              // Calculate extent dimensions for optimal fitting
              const extentWidth = extent[2] - extent[0]
              const extentHeight = extent[3] - extent[1]
              const view = map.getView()
              
              console.log('🎯 Feature extent analysis:', { 
                extentWidth, 
                extentHeight,
                widthToHeightRatio: extentWidth / extentHeight,
                extent 
              })
              
              // Use extent-based fitting - let OpenLayers calculate optimal zoom
              map.getView().fit(extent, {
                duration: 800,
                padding: [50, 50, 50, 50] // Reasonable padding for individual features
                // No maxZoom constraint - fit to actual polygon extent
              })
              
              console.log('🎯 Feature zoom level after fitting:', view.getZoom())
            }
          } else {
            console.log('🎯 Feature has no label text, still zooming to extent')
            const geometry = feature.getGeometry()
            if (geometry) {
              const extent = geometry.getExtent()
              
              // Calculate extent dimensions for optimal fitting
              const extentWidth = extent[2] - extent[0]
              const extentHeight = extent[3] - extent[1]
              
              console.log('🎯 Unlabeled feature extent analysis:', { 
                extentWidth, 
                extentHeight,
                extent 
              })
              
              map.getView().fit(extent, {
                duration: 800,
                padding: [50, 50, 50, 50]
                // No maxZoom constraint - fit to actual polygon extent
              })
            }
          }
        }
      }, {
        layerFilter: (layer) => {
          const isVectorTile = layer instanceof VectorTileLayer
          console.log('🔍 Layer filter:', layer.constructor.name, 'isVectorTile:', isVectorTile)
          return isVectorTile
        }
      })
      
      if (!foundFeature) {
        console.log('🖱️ No vector tile features found at click location')
        console.log('🔍 Available layers:', map.getLayers().getArray().map(l => ({
          type: l.constructor.name,
          visible: l.getVisible(),
          zIndex: l.getZIndex?.()
        })))
      }
    })

    // Add hover functionality for labels
    let currentHoverFeature: any = null
    let currentHoverLayer: VectorLayer | null = null

    map.on('pointermove', (event) => {
      // Remove previous hover overlay
      if (currentHoverLayer) {
        map.removeLayer(currentHoverLayer)
        currentHoverLayer = null
      }
      currentHoverFeature = null

      // Find features at hover position
      map.forEachFeatureAtPixel(event.pixel, (feature, layer) => {
        if (layer instanceof VectorTileLayer && !currentHoverFeature) {
          const boundary = layer.get('boundary')
          const labelText = feature.get(boundary?.hoverAttribute)
          
          console.log('🖱️ Hover detected:', { 
            labelText, 
            hoverAttribute: boundary?.hoverAttribute,
            featureProperties: feature.getProperties() 
          })
          
          if (labelText) {
            currentHoverFeature = feature
            
            // Get feature center for label positioning
            const geometry = feature.getGeometry()
            if (geometry) {
              const extent = geometry.getExtent()
              const center = [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2]
              
              // Create hover label feature
              const labelFeature = new Feature({
                geometry: new Point(center),
                labelText: labelText
              })
              
              // Create temporary layer for hover label
              currentHoverLayer = new VectorLayer({
                source: new VectorSource({
                  features: [labelFeature]
                }),
                style: new Style({
                  text: new Text({
                    text: String(labelText),
                    font: 'bold 14px Arial',
                    fill: new Fill({
                      color: '#2c3e50'
                    }),
                    stroke: new Stroke({
                      color: '#ffffff',
                      width: 3
                    }),
                    backgroundFill: new Fill({
                      color: 'rgba(255, 255, 255, 0.9)'
                    }),
                    backgroundStroke: new Stroke({
                      color: '#2c3e50',
                      width: 1
                    }),
                    padding: [4, 8, 4, 8],
                    textAlign: 'center',
                    textBaseline: 'middle'
                  })
                }),
                zIndex: 2000
              })
              
              map.addLayer(currentHoverLayer)
              console.log('✅ Hover label added for:', labelText)
            }
          }
        }
      }, {
        layerFilter: (layer) => layer instanceof VectorTileLayer
      })
    })

    // Use server-generated inverse mask for optimal performance
    console.log('🔍 DEBUG: All boundaries passed to map:', boundaries)
    console.log('🔍 DEBUG: Looking for boundaries with maskLayer.success...')
    
    boundaries.forEach((boundary, index) => {
      console.log(`🔍 DEBUG: Boundary ${index}:`, {
        name: boundary.name,
        id: boundary.id,
        hasMaskLayer: !!boundary.maskLayer,
        maskLayerSuccess: boundary.maskLayer?.success,
        maskLayerName: boundary.maskLayer?.maskLayerName,
        vectorTileUrl: boundary.maskLayer?.vectorTileUrl
      })
    })
    
    const maskBoundary = boundaries.find(b => b.maskLayer?.success)
    console.log('🔍 DEBUG: Selected mask boundary:', maskBoundary)
    
    if (maskBoundary?.maskLayer) {
      console.log('🎭 Using high-performance server-generated inverse mask:', maskBoundary.maskLayer.maskLayerName)
      console.log('🔍 DEBUG: Mask layer URL:', maskBoundary.maskLayer.vectorTileUrl)
      
      // Create vector tile layer for the pre-computed inverse mask
      const inverseMaskLayer = new VectorTileLayer({
        source: new VectorTileSource({
          format: new MVT(),
          tileUrlFunction: createTileUrlFunction(maskBoundary.maskLayer.vectorTileUrl),
          attributions: `Inverse mask for ${maskBoundary.name}`,
          wrapX: false
        }),
        style: new Style({
          fill: new Fill({
            color: 'rgba(128, 128, 128, 0.6)' // Grey overlay
          })
        }),
        zIndex: 999 // Just below hover labels
      })
      
      inverseMaskLayer.setVisible(true) // Start visible by default
      map.addLayer(inverseMaskLayer)
      setMaskLayer(inverseMaskLayer as any) // Type assertion for compatibility
      
      console.log(`✅ High-performance server mask loaded and visible (${maskBoundary.maskLayer.processingTime || 'unknown'}ms processing time)`)
      
    } else if (boundaries.length > 0 && boundaries[0].metadata?.bounds) {
      // Fallback to client-side rectangular mask only if server mask failed
      console.log('🎭 Fallback: Using client-side rectangular mask (server mask not available)')
      const bounds = boundaries[0].metadata.bounds
      const worldExtent = transformExtent([-180, -90, 180, 90], 'EPSG:4326', 'EPSG:3857')
      const boundaryExtent = transformExtent([bounds[0], bounds[1], bounds[2], bounds[3]], 'EPSG:4326', 'EPSG:3857')
      
      // Create a polygon that covers the world but has a hole for the boundary area
      const worldPoly = new Polygon([[
        [worldExtent[0], worldExtent[1]],
        [worldExtent[2], worldExtent[1]], 
        [worldExtent[2], worldExtent[3]],
        [worldExtent[0], worldExtent[3]],
        [worldExtent[0], worldExtent[1]]
      ]])
      
      // Add hole for boundary area (rectangular fallback)
      const boundaryHole = new LinearRing([
        [boundaryExtent[0], boundaryExtent[1]],
        [boundaryExtent[0], boundaryExtent[3]],
        [boundaryExtent[2], boundaryExtent[3]],
        [boundaryExtent[2], boundaryExtent[1]],
        [boundaryExtent[0], boundaryExtent[1]]
      ])
      worldPoly.appendLinearRing(boundaryHole)
      
      const maskFeature = new Feature({
        geometry: worldPoly
      })
      
      const maskLayer = new VectorLayer({
        source: new VectorSource({
          features: [maskFeature]
        }),
        style: new Style({
          fill: new Fill({
            color: 'rgba(128, 128, 128, 0.6)' // Grey overlay
          })
        }),
        zIndex: 999 // Just below hover labels
      })
      
      maskLayer.setVisible(true) // Start visible by default
      map.addLayer(maskLayer)
      setMaskLayer(maskLayer)
      
      console.log('⚠️ Using fallback rectangular mask (visible by default) - consider re-uploading for optimal performance')
    }

    // Zoom to boundaries extent after adding all layers
    if (boundaries.length > 0) {
      console.log('🎯 Calculating extent for', boundaries.length, 'boundaries...')
      
      // Find the overall extent from all boundaries
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      let hasValidBounds = false
      
      boundaries.forEach((boundary, index) => {
        if (boundary.metadata?.bounds) {
          const bounds = boundary.metadata.bounds
          console.log(`📏 Boundary ${index + 1} bounds:`, bounds)
          
          minX = Math.min(minX, bounds[0])
          minY = Math.min(minY, bounds[1])
          maxX = Math.max(maxX, bounds[2])
          maxY = Math.max(maxY, bounds[3])
          hasValidBounds = true
        } else {
          console.warn(`⚠️ No bounds for boundary: ${boundary.name}`)
        }
      })
      
      if (hasValidBounds) {
        // Transform from EPSG:4326 to EPSG:3857 (Web Mercator)
        const bottomLeft = fromLonLat([minX, minY])
        const topRight = fromLonLat([maxX, maxY])
        const extent = [bottomLeft[0], bottomLeft[1], topRight[0], topRight[1]]
        
        console.log('🎯 Fitting to extent:', { minX, minY, maxX, maxY })
        console.log('🎯 Web Mercator extent:', extent)
        
        // Calculate extent dimensions to determine optimal fitting
        const extentWidth = extent[2] - extent[0]  // maxX - minX
        const extentHeight = extent[3] - extent[1] // maxY - minY
        const view = map.getView()
        const mapSize = map.getSize() || [800, 600]
        
        console.log('🎯 Extent analysis:', { 
          extentWidth, 
          extentHeight, 
          widthToHeightRatio: extentWidth / extentHeight,
          mapSize,
          extent 
        })
        
        // Use extent-based fitting without arbitrary zoom calculations
        // Let OpenLayers calculate the optimal zoom based on the actual extent
        map.getView().fit(extent, { 
          padding: [30, 30, 30, 30], // Minimal padding for tight fit
          duration: 1500
          // No maxZoom constraint - let it fit naturally
        })
        
        console.log('🎯 Final zoom after extent fitting:', view.getZoom())
      } else {
        console.warn('⚠️ No valid bounds found, using default Bhutan center')
        map.getView().animate({
          center: fromLonLat([89.5, 27.5]),
          zoom: 7,
          duration: 1000
        })
      }
    }

  }, [boundaries])

  // Toggle layer visibility
  const toggleLayerVisibility = (layerId: string) => {
    const newVisibility = !layerVisibility[layerId]
    console.log(`🔄 Toggling layer ${layerId}: ${layerVisibility[layerId]} -> ${newVisibility}`)
    
    setLayerVisibility(prev => ({ ...prev, [layerId]: newVisibility }))
    
    // Update the actual layer visibility
    const layer = boundaryLayers.find(l => l.get('layerId') === layerId)
    if (layer) {
      layer.setVisible(newVisibility)
      console.log(`✅ Layer ${layerId} visibility updated to: ${newVisibility}`)
    } else {
      console.warn(`⚠️ Layer ${layerId} not found in boundaryLayers`)
      console.log('Available layers:', boundaryLayers.map(l => l.get('layerId')))
    }
    
    onLayerToggle?.(layerId, newVisibility)
  }

  // Toggle mask layer
  const toggleMask = () => {
    if (maskLayer) {
      const currentVisibility = maskLayer.getVisible()
      maskLayer.setVisible(!currentVisibility)
    }
  }

  return (
    <div className="h-full w-full relative min-h-[500px]" style={{ height: '100%', width: '100%' }}>
      <div 
        ref={mapRef} 
        className="h-full w-full min-h-[500px]" 
        style={{ 
          height: '100%', 
          width: '100%', 
          display: 'block',
          visibility: 'visible',
          opacity: 1,
          backgroundColor: '#f0f0f0',
          position: 'relative',
          zIndex: 1
        }} 
      />
      
      {/* Layer Controls */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 max-w-xs">
        <h4 className="font-medium text-gray-800 mb-2 text-sm">🗺️ Layer Controls</h4>
        
        {boundaries.map((boundary) => (
          <div key={boundary.id} className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600 truncate max-w-[120px]" title={boundary.name}>
              {boundary.name}
            </span>
            <button
              onClick={() => toggleLayerVisibility(boundary.id)}
              className={`ml-2 px-2 py-1 text-xs rounded ${
                layerVisibility[boundary.id] 
                  ? 'bg-green-100 text-green-800 border border-green-300' 
                  : 'bg-gray-100 text-gray-600 border border-gray-300'
              }`}
            >
              {layerVisibility[boundary.id] ? '👁️ ON' : '👁️ OFF'}
            </button>
          </div>
        ))}
        
        {maskLayer && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
            <span className="text-xs text-gray-600">
              Focus Mode
            </span>
            <button
              onClick={toggleMask}
              className="ml-2 px-2 py-1 text-xs rounded bg-purple-100 text-purple-800 border border-purple-300"
            >
              🎭 MASK
            </button>
          </div>
        )}
      </div>
      
      {/* Vector Tile Info Overlay */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm">
        <h3 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
          �️ GeoServer Live Map
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          High-performance vector tiles served directly from GeoServer
        </p>
        
        {boundaries.length > 0 && (
          <div className="mb-3 p-2 bg-green-50 rounded border border-green-200">
            <div className="text-xs text-green-800 font-medium">
              ✅ {boundaries.length} Vector Layer{boundaries.length > 1 ? 's' : ''} Active
            </div>
            {boundaries.map((boundary, index) => (
              <div key={boundary.id} className="text-xs text-green-700 mt-1">
                • {boundary.name} ({boundary.metadata?.featureCount || 0} features)
              </div>
            ))}
          </div>
        )}
        
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500">Format:</span>
            <span className="text-blue-600 font-medium">MVT</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Source:</span>
            <span className="text-purple-600 font-medium">GeoWebCache</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Status:</span>
            <span className="text-green-600 font-medium">Optimized</span>
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs text-gray-500">
            High-performance vector tiles via GeoServer
          </p>
        </div>
      </div>
    </div>
  )
}