import React, { useState, useCallback, useEffect } from 'react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { MapComponent } from '@/components/MapComponent'
import { Sidebar } from '@/components/Sidebar'
import { Dashboard } from '@/components/Dashboard'
import { AdminApp } from '@/components/AdminApp'
import { AIChatbot } from '@/components/ai/AIChatbot'
import { RegionalAIAnalysis } from '@/components/ai/RegionalAIAnalysis'
import { BoundaryLayerProvider } from '@/contexts/BoundaryLayerContext'
// import AutoOverlayDemo from '@/components/AutoOverlayDemo' // Removed to prevent mapbox loading in admin mode
import { useMockData } from '@/hooks/useMockData'
import { SparkFallback } from './utils/sparkFallback'
import { Toaster } from 'sonner'
import { API_ENDPOINTS } from '@/config/api'

interface MapInstance {
  id: string
  center: [number, number]
  zoom: number
  layers: any[]
  overlayInfo?: {
    type: string
    name: string
    scenario?: string
    year?: string
    season?: string
  }
}

function MainApp() {
  // Initialize mock data
  useMockData()
  
  const [selectedCountry, setSelectedCountry] = useState('bhutan')
  const [mapLayout, setMapLayout] = useState(1)
  const [showDashboard, setShowDashboard] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [activeMapId, setActiveMapId] = useState('map-1')
  const [basemap, setBasemap] = useState('osm')
  const [sharedView, setSharedView] = useState<{ center: [number, number], zoom: number }>({
    center: [90.433601, 27.514162], // Bhutan center
    zoom: 7.5
  })
  
  // Store overlay information for each map
  const [mapOverlays, setMapOverlays] = useState<Record<string, any>>({})
  
  // AI Features state
  const [showChatbot, setShowChatbot] = useState(false)
  const [showRegionalAnalysis, setShowRegionalAnalysis] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  
  // Handler for region selection from map
  const handleRegionSelect = useCallback((regionName: string) => {
    console.log('🌍 Region selected:', regionName)
    setSelectedRegion(regionName)
    setShowRegionalAnalysis(true)
  }, [])
  
  // Pre-load boundary data for all countries on app start for better performance
  useEffect(() => {
    const preloadBoundaries = async () => {
      console.log('🔄 Pre-loading boundary data from GeoServer for faster map switching...')
      
      try {
        // Fetch boundaries from GeoServer instead of localStorage
        const response = await fetch(API_ENDPOINTS.boundaries)
        const data = await response.json()
        
        if (data.success && data.boundaries) {
          console.log(`🔄 Pre-loaded ${data.boundaries.length} boundaries from GeoServer:`)
          data.boundaries.forEach((boundary: any) => {
            console.log(`  - ${boundary.country}_adm${boundary.adminLevel} (${boundary.metadata?.featureCount || 0} features, mask: ${!!boundary.maskLayer})`)
          })
        } else {
          console.warn('⚠️ Failed to pre-load boundaries from GeoServer:', data)
        }
      } catch (error) {
        console.warn('⚠️ Failed to pre-load boundaries from GeoServer:', error)
        console.log('📝 Continuing without pre-loaded boundaries - they will load on demand')
      }
    }
    
    // Start pre-loading after a short delay to not block initial render
    const timer = setTimeout(preloadBoundaries, 100)
    return () => clearTimeout(timer)
  }, [])

  const handleCountryChange = useCallback((country: string) => {
    setSelectedCountry(country)
    
    // Clear overlays when changing country
    setMapOverlays({})
    
    // Update shared view based on country with proper zoom levels for each layout
    const getCountryZoom = (baseZoom: number) => {
      switch (mapLayout) {
        case 1: return baseZoom
        case 2: return Math.max(baseZoom - 0.5, 4) // Less aggressive zoom reduction for 2 maps
        case 4: return Math.max(baseZoom - 1, 3) // Less aggressive zoom reduction for 4 maps
        default: return baseZoom
      }
    }
    
    const countryBounds = {
      bhutan: { center: [90.433601, 27.514162] as [number, number], baseZoom: 7.5 },
      mongolia: { center: [103.835, 46.862] as [number, number], baseZoom: 4.2 },
      laos: { center: [103.865, 18.220] as [number, number], baseZoom: 5.2 }
    }
    
    const countryConfig = countryBounds[country as keyof typeof countryBounds]
    const adjustedZoom = getCountryZoom(countryConfig.baseZoom)
    setSharedView({ center: countryConfig.center, zoom: adjustedZoom })
  }, [mapLayout])

  // Trigger map resize when dashboard or sidebar toggles for smooth adaptation
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'))
    }, 200) // Small delay to allow CSS transitions

    return () => clearTimeout(timer)
  }, [showDashboard, showSidebar])

  const handleLayoutChange = useCallback((layout: number) => {
    setMapLayout(layout)
    setActiveMapId('map-1') // Reset to first map when layout changes
    // Clear overlays when changing layout
    setMapOverlays({})
    
    // Adjust zoom based on new layout and current country
    const getCountryZoom = (baseZoom: number) => {
      switch (layout) {
        case 1: return baseZoom
        case 2: return Math.max(baseZoom - 0.5, 4) // Less aggressive zoom reduction for 2 maps
        case 4: return Math.max(baseZoom - 1, 3) // Less aggressive zoom reduction for 4 maps
        default: return baseZoom
      }
    }
    
    const countryBounds = {
      bhutan: { center: [90.433601, 27.514162] as [number, number], baseZoom: 7.5 },
      mongolia: { center: [103.835, 46.862] as [number, number], baseZoom: 4.2 },
      laos: { center: [103.865, 18.220] as [number, number], baseZoom: 5.2 }
    }
    
    const countryConfig = countryBounds[selectedCountry as keyof typeof countryBounds]
    const adjustedZoom = getCountryZoom(countryConfig.baseZoom)
    setSharedView({ center: countryConfig.center, zoom: adjustedZoom })
  }, [selectedCountry])

  const handleMapActivate = useCallback((mapId: string) => {
    setActiveMapId(mapId)
  }, [])

  const handleViewChange = useCallback((center: [number, number], zoom: number) => {
    setSharedView({ center, zoom })
  }, [])

  const handleLayerChange = useCallback((mapId: string, layer: any, action: 'add' | 'remove' = 'add') => {
    // Handle layer changes for specific map
    console.log('Layer change for map:', mapId, layer, action)
    
    if (action === 'add' && layer) {
      // Handle opacity and visibility updates WITHOUT triggering layer replacement
      if (layer.action === 'opacity' || layer.action === 'visibility') {
        console.log(`🎛️ Updating layer properties (${layer.action}) without triggering replacement logic`)
        setMapOverlays(prev => {
          const currentOverlays = prev[mapId] || {}
          const layerType = layer.type.toLowerCase()
          
          // Only update the existing overlay properties, don't clean or replace
          if (currentOverlays[layerType]) {
            const updatedOverlays = {
              ...currentOverlays,
              [layerType]: {
                ...currentOverlays[layerType],
                action: layer.action, // Update action for MapComponent processing
                visible: layer.visible,
                opacity: layer.opacity,
                // Preserve all existing metadata
                type: currentOverlays[layerType].type,
                name: currentOverlays[layerType].name,
                scenario: currentOverlays[layerType].scenario,
                year: currentOverlays[layerType].year,
                season: currentOverlays[layerType].season
              }
            }
            
            return {
              ...prev,
              [mapId]: updatedOverlays
            }
          }
          
          return prev // No changes if overlay doesn't exist
        })
        return // Exit early, don't process as layer addition
      }
      
      // REGULAR LAYER ADDITION (new layers) - with conflict cleanup
      setMapOverlays(prev => {
        const currentOverlays = prev[mapId] || {}
        const newLayerType = layer.type.toLowerCase()
        
        // For raster overlays (climate/GIRI), they are mutually exclusive
        // Remove conflicting overlay types when adding a new one
        let cleanedOverlays = { ...currentOverlays }
        
        if (newLayerType === 'climate' || newLayerType === 'giri') {
          // Remove both climate and GIRI overlays since they're mutually exclusive
          delete cleanedOverlays.climate
          delete cleanedOverlays.giri
          console.log(`🧹 Cleared conflicting raster overlays for new ${newLayerType} layer`)
        } else if (newLayerType === 'energy') {
          // Energy layers replace other energy layers only
          delete cleanedOverlays.energy
          console.log(`🧹 Cleared existing energy overlay for new energy layer`)
        }
        
        // Add the new overlay
        const updatedOverlays = {
          ...cleanedOverlays,
          [newLayerType]: {
            type: layer.type || 'Unknown',
            name: layer.name || 'Unknown Layer',
            scenario: layer.scenario,
            year: layer.year,
            season: layer.season,
            action: layer.action, // Preserve action for opacity/visibility handling
            visible: layer.visible,
            opacity: layer.opacity
          }
        }
        
        const newState = {
          ...prev,
          [mapId]: updatedOverlays
        }
        
        return newState
      })
    } else if (action === 'remove') {
      // Mark overlay for removal (don't delete immediately - let MapComponent process it first)
      setMapOverlays(prev => {
        let newState = { ...prev }
        
        if (!layer) {
          // Mark all overlays for this map as removed
          const currentOverlays = prev[mapId] || {}
          const markedOverlays = Object.keys(currentOverlays).reduce((acc, key) => {
            acc[key] = { ...currentOverlays[key], action: 'remove' }
            return acc
          }, {} as Record<string, any>)
          
          newState = {
            ...prev,
            [mapId]: markedOverlays
          }
        } else {
          // Handle immediate cleanup for cross button removals
          if (layer.immediateClean) {
            console.log(`🗑️ IMMEDIATE CLEAN: Removing ${layer.type} overlay from state`)
            const currentOverlays = prev[mapId] || {}
            const overlayKey = layer.type.toLowerCase()
            const cleanedOverlays = { ...currentOverlays }
            delete cleanedOverlays[overlayKey]
            
            newState = {
              ...prev,
              [mapId]: cleanedOverlays
            }
          } else {
            // Mark specific category overlay for removal (normal replacement flow)
            const currentOverlays = prev[mapId] || {}
            const overlayKey = layer.type.toLowerCase()
            
            if (currentOverlays[overlayKey]) {
              newState = {
                ...prev,
                [mapId]: {
                  ...currentOverlays,
                  [overlayKey]: {
                    ...currentOverlays[overlayKey],
                    action: 'remove',
                    explicitRemoval: layer.explicitRemoval // Preserve explicit removal flag
                  }
                }
              }
            }
          }
        }
        
        return newState
      })
      
      // Clean up the marked overlays after MapComponent processes them
      setTimeout(() => {
        setMapOverlays(prev => {
          let newState = { ...prev }
          
          if (!layer) {
            // Remove all overlays for this map only if they're still marked for removal
            const currentOverlays = prev[mapId] || {}
            const shouldRemove = Object.values(currentOverlays).every(overlay => 
              overlay && typeof overlay === 'object' && (overlay as any).action === 'remove'
            )
            if (shouldRemove) {
              delete newState[mapId]
            }
          } else {
            // Remove specific category overlay only if it's still marked for removal
            const currentOverlays = prev[mapId] || {}
            const overlayKey = layer.type.toLowerCase()
            const overlayToCheck = currentOverlays[overlayKey]
            
            if (overlayToCheck && (overlayToCheck as any).action === 'remove') {
              const updatedOverlays = { ...currentOverlays }
              delete updatedOverlays[overlayKey]
              
              if (Object.keys(updatedOverlays).length === 0) {
                // If no overlays left, remove the map entry
                delete newState[mapId]
              } else {
                newState = {
                  ...prev,
                  [mapId]: updatedOverlays
                }
              }
            }
          }
          
          return newState
        })
      }, 300) // Increased wait time for MapComponent to process the removal
    }
  }, [])

  const handleBasemapChange = useCallback((newBasemap: string) => {
    setBasemap(newBasemap)
  }, [])

  const renderMaps = () => {
    const maps: React.ReactElement[] = []
    const mapIds = Array.from({ length: mapLayout }, (_, i) => `map-${i + 1}`)
    
    for (let i = 0; i < mapLayout; i++) {
      const mapId = mapIds[i]
      maps.push(
        <div key={`${mapLayout}-${mapId}`} className="h-full">
          <MapComponent
            id={mapId}
            isActive={activeMapId === mapId}
            onActivate={() => handleMapActivate(mapId)}
            center={sharedView.center}
            zoom={sharedView.zoom}
            onViewChange={handleViewChange}
            country={selectedCountry}
            basemap={basemap}
            overlayInfo={mapOverlays[mapId]}
            allMapOverlays={mapOverlays}
            mapLayout={mapLayout}
            onOverlayChange={handleLayerChange}
            onRegionSelect={handleRegionSelect}
          />
        </div>
      )
    }
    
    return maps
  }

  const getMapGridClass = () => {
    switch (mapLayout) {
      case 1:
        return 'grid-cols-1'
      case 2:
        return 'grid-cols-2'
      case 4:
        return 'grid-cols-2 grid-rows-2'
      default:
        return 'grid-cols-1'
    }
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header
        selectedCountry={selectedCountry}
        onCountryChange={handleCountryChange}
        mapLayout={mapLayout}
        onLayoutChange={handleLayoutChange}
        showDashboard={showDashboard}
        onToggleDashboard={() => setShowDashboard(!showDashboard)}
        basemap={basemap}
        onBasemapChange={handleBasemapChange}
        showSidebar={showSidebar}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
      />
      
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Sidebar */}
        {showSidebar && (
          <div className="w-80 flex-shrink-0 flex flex-col">
            <div className="flex-1">
              <Sidebar
                activeMapId={activeMapId}
                onLayerChange={handleLayerChange}
                mapLayout={mapLayout} // Pass layout to clear layers on change
                selectedCountry={selectedCountry} // Pass country to clear layers on change
              />
            </div>
          </div>
        )}
        
        {/* Main Map Area */}
        <div className="flex-1">
          <div className={`grid ${getMapGridClass()} h-full gap-3`}>
            {renderMaps()}
          </div>
        </div>
        
        {/* Dashboard */}
        {showDashboard && (
          <div className="w-[26rem] xl:w-[32rem] flex-shrink-0">
            <Dashboard
              selectedCountry={selectedCountry}
              activeMapCount={mapLayout}
              mapOverlays={activeMapId ? { [activeMapId]: mapOverlays[activeMapId] } : {}}
            />
          </div>
        )}
      </div>
      
      {/* Footer */}
      <Footer />
      
      {/* Toast notifications */}
      <Toaster position="bottom-right" />
      
      {/* AI Features */}
      <AIChatbot
        selectedCountry={selectedCountry}
        isVisible={showChatbot}
        onToggle={() => setShowChatbot(!showChatbot)}
      />
      
      <RegionalAIAnalysis
        selectedRegion={selectedRegion}
        selectedCountry={selectedCountry}
        isVisible={showRegionalAnalysis}
        onClose={() => {
          setShowRegionalAnalysis(false)
          setSelectedRegion(null)
        }}
      />
      
      {/* Admin Access Card */}
      {/* Removed - replaced with header button */}
    </div>
  )
}

function App() {
  // Check if we're on the admin route or auto-overlay demo immediately
  const checkAdminMode = () => {
    const searchParams = new URLSearchParams(window.location.search)
    return searchParams.get('admin') === 'true' || window.location.pathname.includes('admin')
  }
  
  const checkAutoOverlayMode = () => {
    const searchParams = new URLSearchParams(window.location.search)
    return searchParams.get('demo') === 'auto-overlay' || window.location.pathname.includes('auto-overlay')
  }
  
  const [isAdminMode, setIsAdminMode] = useState(checkAdminMode())
  const [isAutoOverlayDemo, setIsAutoOverlayDemo] = useState(checkAutoOverlayMode())
  
  useEffect(() => {
    // Double-check URL or other conditions to determine admin mode
    const searchParams = new URLSearchParams(window.location.search)
    console.log('URL search params:', searchParams.toString())
    console.log('Checking admin param:', searchParams.get('admin'))
    console.log('Current pathname:', window.location.pathname)
    
    if (searchParams.get('admin') === 'true' || window.location.pathname.includes('admin')) {
      console.log('Setting admin mode to true')
      setIsAdminMode(true)
    }
    if (searchParams.get('demo') === 'auto-overlay' || window.location.pathname.includes('auto-overlay')) {
      setIsAutoOverlayDemo(true)
    }
  }, [])

  console.log('App render - isAdminMode:', isAdminMode, 'isAutoOverlayDemo:', isAutoOverlayDemo)

  // If admin mode, render admin app
  if (isAdminMode) {
    console.log('Rendering AdminApp')
    return (
      <BoundaryLayerProvider>
        <div className="h-screen bg-background">
          <AdminApp />
          <Toaster position="bottom-right" />
        </div>
      </BoundaryLayerProvider>
    )
  }

  // If auto-overlay demo mode, render demo directly
  if (isAutoOverlayDemo) {
    console.log('Rendering AutoOverlayDemo')
    
    // Dynamic import to avoid loading mapbox dependencies in admin mode
    const LazyAutoOverlayDemo = React.lazy(() => import('./components/AutoOverlayDemo'))
    
    return (
      <BoundaryLayerProvider>
        <React.Suspense fallback={<div className="flex items-center justify-center h-screen">Loading demo...</div>}>
          <LazyAutoOverlayDemo />
        </React.Suspense>
        <Toaster position="bottom-right" />
      </BoundaryLayerProvider>
    )
  }

  // Otherwise render main app
  console.log('Rendering MainApp')
  return (
    <BoundaryLayerProvider>
      <MainApp />
    </BoundaryLayerProvider>
  )
}

export default App