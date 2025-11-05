import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Stack, Thermometer, Drop, Flashlight, Eye, EyeSlash, X, Plus } from '@phosphor-icons/react'
import { SparkFallback } from '../utils/sparkFallback'
import { LayerValidator } from '../utils/layerValidator'
import { getSeasonsForCountry } from '../utils/countrySeasons'
import { toast } from 'sonner'

interface LayerConfig {
  id: string
  name: string
  category: 'climate' | 'giri' | 'energy'
  visible: boolean
  opacity: number
  // Dashboard metadata fields - preserve scenario/year/season for dashboard integration
  scenario?: string
  year?: string
  season?: string
}

const climateVariables = [
  'Maximum Temperature',
  'Minimum Temperature', 
  'Mean Temperature',
  'Precipitation',
  'Solar Radiation',
  'Cooling Degree Days',
  'Heating Degree Days'
]

const scenarios = [
  'Historical',
  'SSP1',
  'SSP2', 
  'SSP3',
  'SSP5'
]

const seasonality = [
  'Annual',
  'Seasonal'
]

const yearRanges = [
  '2021-2040',
  '2041-2060',
  '2061-2080', 
  '2081-2100'
]

const giriVariables = [
  'Flood',
  'Drought'
]

const giriScenarios = [
  'Existing',
  'SSP1',
  'SSP5'
]

const energyInfrastructure = [
  'Hydro Power Plants',
  'Solar Power Plants',
  'Wind Power Plants'
]

// Function to convert technical layer names to user-friendly display names
const getDisplayName = (layerName: string, category: string): string => {
  if (category !== 'energy') {
    return layerName // Return original name for non-energy layers
  }
  
  const name = layerName.toLowerCase()
  
  // Map common energy infrastructure filename patterns to clean display names
  if (name.includes('hydro') || name.includes('hydropower') || name.includes('hydroelectric')) {
    return 'Hydro Power Plants'
  }
  if (name.includes('solar') || name.includes('photovoltaic') || name.includes('pv')) {
    return 'Solar Power Plants'
  }
  if (name.includes('wind')) {
    return 'Wind Power Plants'
  }
  if (name.includes('geothermal')) {
    return 'Geothermal Power Plants'
  }
  if (name.includes('biomass')) {
    return 'Biomass Power Plants'
  }
  if (name.includes('nuclear')) {
    return 'Nuclear Power Plants'
  }
  
  // If no pattern matches, return a cleaned version of the original name
  // Remove common filename extensions and prefixes
  let cleanName = layerName
    .replace(/\.(shp|geojson|kml|gpx)$/i, '') // Remove file extensions
    .replace(/^[a-z0-9_-]*[_-]/i, '') // Remove prefix patterns like "country_" or "data_"
    .replace(/[_-]/g, ' ') // Replace underscores and hyphens with spaces
    .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize first letter of each word
  
  return cleanName || layerName // Fallback to original name if cleaning results in empty string
}

export function Sidebar({ activeMapId, onLayerChange, mapLayout, selectedCountry }: { 
  activeMapId: string, 
  onLayerChange: (mapId: string, layer: any, action?: 'add' | 'remove') => void, 
  mapLayout: number,
  selectedCountry: string 
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [showSelectionPanel, setShowSelectionPanel] = useState(false)
  const [climateVariable, setClimateVariable] = useState<string>('')
  const [scenario, setScenario] = useState<string>('')
  const [seasonalityType, setSeasonalityType] = useState<string>('')
  const [yearRange, setYearRange] = useState<string>('')
  const [season, setSeason] = useState<string>('')
  const [giriVariable, setGiriVariable] = useState<string>('')
  const [giriScenario, setGiriScenario] = useState<string>('')
  const [energyType, setEnergyType] = useState<string>('')
  const [activeLayers, setActiveLayers] = useState<LayerConfig[]>([])
  const [showGiriModal, setShowGiriModal] = useState(false)
  
  // Access uploaded data configurations
  const [uploadedData, setUploadedData] = useState<Record<string, any>>({})
  
  // Load uploaded data from storage
  useEffect(() => {
    const loadUploadedData = async () => {
      try {
        const data = await SparkFallback.get('admin-processed-data') as Record<string, any> | null
        if (data) {
          setUploadedData(data)
        }
      } catch (error) {
        console.warn('Failed to load uploaded data:', error)
      }
    }
    loadUploadedData()
  }, [])

  // Clear layers when layout changes
  useEffect(() => {
    setActiveLayers([])
    resetSelections()
  }, [mapLayout])

  // Clear layers when country changes
  useEffect(() => {
    setActiveLayers([])
    resetSelections()
    setShowSelectionPanel(false)
    setSelectedCategory('')
  }, [selectedCountry])

  // Track active layers by category for current map
  const getActiveLayersByCategory = () => {
    return activeLayers.reduce((acc, layer) => {
      if (layer.id.startsWith(activeMapId)) {
        acc[layer.category] = layer
      }
      return acc
    }, {} as Record<string, LayerConfig>)
  }

  const resetSelections = () => {
    setClimateVariable('')
    setScenario('')
    setSeasonalityType('')
    setYearRange('')
    setSeason('')
    setGiriVariable('')
    setGiriScenario('')
    setEnergyType('')
    // Don't hide the panel, just reset the form values
  }

  const handleCategoryChange = (category: string) => {
    // Always show the selection panel when a category is clicked
    setSelectedCategory(category)
    setShowSelectionPanel(true)
    resetSelections()
  }

  const addLayer = async () => {
    let layerRequest: any = null
    
    if (selectedCategory === 'climate' && climateVariable && scenario) {
      layerRequest = {
        country: selectedCountry,
        dataType: 'climate',
        variable: climateVariable,
        scenario: scenario,
        yearRange: yearRange || undefined,
        seasonality: seasonalityType,
        season: season
      }
    } else if (selectedCategory === 'giri' && giriVariable && giriScenario) {
      layerRequest = {
        country: selectedCountry,
        dataType: 'giri',
        variable: giriVariable,
        scenario: giriScenario,
        seasonality: 'Annual'
      }
    } else if (selectedCategory === 'energy' && energyType) {
      layerRequest = {
        country: selectedCountry,
        dataType: 'energy',
        variable: energyType,
        seasonality: 'Annual'
      }
    }

    if (layerRequest) {
      try {
        let layerInfo: any
        
        // Skip LayerValidator for energy overlays - they're handled directly in MapComponent
        if (layerRequest.dataType === 'energy') {
          console.log(`⚡ Skipping LayerValidator for energy overlay - handled by loadEnergyOverlay()`)
          // Create simple layerInfo for energy overlays (validation handled in MapComponent)
          layerInfo = {
            name: `${layerRequest.country}_${layerRequest.dataType}_${layerRequest.variable}`,
            type: layerRequest.dataType, // Add missing type property for App.tsx compatibility
            request: layerRequest,
            hasRealData: true, // Assume true - MapComponent will handle actual validation
            url: null // Not needed for energy overlays
          }
          toast.success(`Loading ${layerRequest.variable} for ${layerRequest.country}`)
        } else {
          // Validate layer request and generate layer info for climate/GIRI data
          const result = await LayerValidator.generateValidatedLayerInfo(layerRequest)
          layerInfo = result.layerInfo
          
          // Show user message about data availability
          const message = LayerValidator.generateUserMessage(result.validation, layerRequest)
          if (result.validation.hasRealData) {
            toast.success(message)
          } else {
            toast.info(message)
          }
        }

        const activeLayersByCategory = getActiveLayersByCategory()
        
        // Remove existing layers based on rules:
        // 1. Only one layer per category
        // 2. Climate and GIRI are mutually exclusive (both are raster overlays)
        let layersToRemove: string[] = []
        
        if (selectedCategory === 'climate') {
          // Remove existing climate layer
          if (activeLayersByCategory.climate) {
            layersToRemove.push(activeLayersByCategory.climate.id)
          }
          // Remove existing GIRI layer (mutually exclusive)
          if (activeLayersByCategory.giri) {
            layersToRemove.push(activeLayersByCategory.giri.id)
          }
        } else if (selectedCategory === 'giri') {
          // Remove existing GIRI layer
          if (activeLayersByCategory.giri) {
            layersToRemove.push(activeLayersByCategory.giri.id)
          }
          // Remove existing climate layer (mutually exclusive)
          if (activeLayersByCategory.climate) {
            layersToRemove.push(activeLayersByCategory.climate.id)
          }
        } else if (selectedCategory === 'energy') {
          // Remove existing energy layer
          if (activeLayersByCategory.energy) {
            layersToRemove.push(activeLayersByCategory.energy.id)
          }
        }
        
        // Remove conflicting layers and notify App.tsx about removals
        if (layersToRemove.length > 0) {
          // First, notify App.tsx about each layer being removed
          const layersToRemoveObjects = activeLayers.filter(layer => layersToRemove.includes(layer.id))
          layersToRemoveObjects.forEach(layer => {
            console.log(`🗑️ Notifying removal of ${layer.category} layer: ${layer.name}`)
            onLayerChange(activeMapId, {
              type: layer.category,
              name: layer.name
            }, 'remove')
          })
          
          // Then remove from activeLayers
          setActiveLayers(prev => prev.filter(layer => !layersToRemove.includes(layer.id)))
        }

        const addNewLayer = () => {
          const newLayer: LayerConfig = {
            id: `${activeMapId}-${Date.now()}`,
            name: layerInfo.name,
            category: selectedCategory as 'climate' | 'giri' | 'energy',
            visible: true,
            opacity: 80,
            // Preserve Dashboard metadata for proper dashboard integration
            scenario: layerInfo.scenario || layerRequest.scenario,
            year: layerInfo.year || layerRequest.yearRange,
            season: layerInfo.season || layerRequest.season
          }
          
          console.log(`➕ Adding new layer:`, newLayer)
          setActiveLayers(prev => {
            const updated = [...prev.filter(layer => !layersToRemove.includes(layer.id)), newLayer]
            console.log(`📋 Updated activeLayers:`, updated)
            return updated
          })
          onLayerChange(activeMapId, layerInfo, 'add')
          
          // Show GIRI visualization modal if adding a GIRI layer
          if (selectedCategory === 'giri') {
            console.log('🌊 GIRI layer added - showing visualization guidance modal')
            setShowGiriModal(true)
          }
        }

        // If we removed layers, wait a bit before adding the new one to avoid race conditions
        if (layersToRemove.length > 0) {
          console.log(`⏱️ Delaying new layer addition to prevent race condition with ${layersToRemove.length} removals`)
          setTimeout(addNewLayer, 150) // Increased delay to ensure removal is processed first
        } else {
          addNewLayer() // No delay needed if no removal
        }
        
        // Hide selection panel after successful layer addition
        setShowSelectionPanel(false)
        setSelectedCategory('')
        resetSelections()
        
      } catch (error) {
        console.error('Failed to add layer:', error)
        toast.error('Failed to add layer - using fallback data')
        
        // Fallback to original behavior if validation fails
        const fallbackLayerInfo = {
          type: selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1),
          name: layerRequest.variable,
          scenario: layerRequest.scenario,
          year: layerRequest.yearRange,
          season: layerRequest.season,
          fallbackMode: true
        }
        
        const newLayer: LayerConfig = {
          id: `${activeMapId}-${Date.now()}`,
          name: layerRequest.variable,
          category: selectedCategory as 'climate' | 'giri' | 'energy',
          visible: true,
          opacity: 80,
          // Preserve Dashboard metadata for fallback mode
          scenario: layerRequest.scenario,
          year: layerRequest.yearRange,
          season: layerRequest.season
        }
        
        setActiveLayers(prev => [...prev, newLayer])
        onLayerChange(activeMapId, fallbackLayerInfo, 'add')
        
        setShowSelectionPanel(false)
        setSelectedCategory('')
        resetSelections()
      }
    }
  }

  const toggleLayerVisibility = (layerId: string) => {
    setActiveLayers(prev => {
      const updatedLayers = prev.map(layer => 
        layer.id === layerId 
          ? { ...layer, visible: !layer.visible }
          : layer
      )
      
      // Notify map component about visibility change
      const updatedLayer = updatedLayers.find(l => l.id === layerId)
      if (updatedLayer) {
        console.log(`👁️ Toggling visibility for layer: ${updatedLayer.name} (${updatedLayer.visible ? 'show' : 'hide'})`)
        
        // Send layer visibility update - always use 'add' action type, let MapComponent handle the visibility
        onLayerChange(activeMapId, {
          ...updatedLayer,
          name: updatedLayer.name,
          type: updatedLayer.category,
          action: 'visibility',
          visible: updatedLayer.visible,
          opacity: updatedLayer.opacity,
          // Preserve Dashboard metadata for proper dashboard detection
          scenario: updatedLayer.scenario,
          year: updatedLayer.year,
          season: updatedLayer.season
        } as any, 'add')
      }
      
      return updatedLayers
    })
  }

  const updateLayerOpacity = (layerId: string, opacity: number) => {
    setActiveLayers(prev => {
      const updatedLayers = prev.map(layer => 
        layer.id === layerId 
          ? { ...layer, opacity }
          : layer
      )
      
      // Notify map component about opacity change
      const updatedLayer = updatedLayers.find(l => l.id === layerId)
      if (updatedLayer) {
        console.log(`🎛️ Updating opacity for layer: ${updatedLayer.name} to ${opacity}%`)
        
        // Send layer opacity update
        onLayerChange(activeMapId, {
          ...updatedLayer,
          name: updatedLayer.name,
          type: updatedLayer.category,
          action: 'opacity',
          visible: updatedLayer.visible,
          opacity: opacity,
          // Preserve Dashboard metadata for proper dashboard detection
          scenario: updatedLayer.scenario,
          year: updatedLayer.year,
          season: updatedLayer.season
        } as any, 'add') // Always 'add' for opacity changes
      }
      
      return updatedLayers
    })
  }

  const removeLayer = (layerId: string) => {
    const layer = activeLayers.find(l => l.id === layerId)
    
    if (layer) {
      console.log(`🗑️ CROSS BUTTON: Explicit removal of layer: ${layer.name} (${layer.category})`)
      
      // For cross button removal, we want to completely clean the overlay from App.tsx state
      // Use a special action that tells App.tsx to immediately clean the overlay
      onLayerChange(activeMapId, {
        ...layer,
        name: layer.name,
        type: layer.category,
        action: 'remove',
        explicitRemoval: true,
        immediateClean: true  // Flag for immediate state cleanup
      } as any, 'remove')
    }
    
    // Remove from active layers list immediately
    setActiveLayers(prev => prev.filter(l => l.id !== layerId))
  }

  const canAddLayer = () => {
    if (selectedCategory === 'climate') {
      return climateVariable && scenario && (scenario === 'Historical' ? true : yearRange)
    }
    if (selectedCategory === 'giri') {
      return giriVariable && giriScenario
    }
    if (selectedCategory === 'energy') {
      return energyType
    }
    return false
  }

  // Get active layers for the current map only
  const getCurrentMapLayers = () => {
    const filtered = activeLayers.filter(layer => layer.id.startsWith(activeMapId))
    console.log(`🔍 getCurrentMapLayers for ${activeMapId}:`, {
      allLayers: activeLayers.length,
      filteredLayers: filtered.length,
      layers: filtered.map(l => ({ id: l.id, name: l.name, visible: l.visible, opacity: l.opacity }))
    })
    return filtered
  }

  return (
    <>
      <Card className="h-full rounded-none border-y-0 border-l-0">
        <CardHeader className="pb-1 px-4 pt-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Stack className="w-4 h-4 text-primary" />
            Layer Controls
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-2 custom-scroll overflow-y-auto max-h-[calc(100vh-120px)] px-4">
          {/* Data Categories */}
          <div className="space-y-2">
            <h3 className="font-medium text-xs text-muted-foreground">DATA LAYERS</h3>
            <div className="grid gap-1.5">
              {[
                { 
                  id: 'climate', 
                  label: 'Climate Variables', 
                  icon: Thermometer, 
                  color: 'text-orange-600',
                  tooltip: 'Climate Data: Access temperature, precipitation, humidity, and weather patterns. Essential for understanding climate risks, seasonal variations, and long-term environmental trends affecting agriculture, water resources, and human settlements.'
                },
                { 
                  id: 'giri', 
                  label: 'GIRI Hazards', 
                  icon: Drop, 
                  color: 'text-blue-600',
                  tooltip: 'Disaster Risk Assessment: Explore flood zones, drought areas, storm surge risks, and multi-hazard vulnerability maps. Critical for disaster preparedness, emergency planning, and resilience building in vulnerable communities.'
                },
                { 
                  id: 'energy', 
                  label: 'Energy Infrastructure', 
                  icon: Flashlight, 
                  color: 'text-yellow-600',
                  tooltip: 'Energy Systems: View power plants, renewable energy installations, transmission networks, and energy access patterns. Important for energy security analysis, renewable transition planning, and infrastructure resilience assessment.'
                }
              ].map(({ id, label, icon: Icon, color, tooltip }) => (
                <Tooltip key={id}>
                  <TooltipTrigger asChild>
                    <button
                      className={`flex items-center justify-start w-full h-8 text-xs px-2 border-2 rounded-md transition-all duration-200 hover:bg-primary/5 hover:border-primary/50 ${
                        selectedCategory === id ? 'bg-primary/15 border-primary text-primary font-medium' : 'bg-white border-border text-foreground'
                      }`}
                      onClick={() => handleCategoryChange(id)}
                    >
                      <Icon className={`w-3 h-3 mr-2 ${selectedCategory === id ? 'text-primary' : color}`} />
                      {label}
                      {selectedCategory === id && (
                        <Badge variant="secondary" className="ml-auto text-xs h-4 px-1">
                          Active
                        </Badge>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-sm bg-slate-800 text-white border border-slate-600">
                    <div className="space-y-1">
                      <div className="font-semibold">
                        {id === 'climate' && <span className="text-orange-300">🌡️ Climate Data</span>}
                        {id === 'giri' && <span className="text-blue-300">🌊 Disaster Risks</span>}
                        {id === 'energy' && <span className="text-yellow-300">⚡ Energy Systems</span>}
                      </div>
                      <div className="text-sm">{tooltip}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* Selection Panel - Show when category is selected */}
          {selectedCategory && showSelectionPanel && (
            <div className="space-y-2 border-2 rounded-lg p-3 bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/40 shadow-md relative z-10 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <h4 className="font-semibold text-xs text-primary flex items-center gap-2 cursor-help">
                      {selectedCategory === 'climate' && (
                        <>
                          <Thermometer className="w-3 h-3" />
                          Configure Climate Variables
                        </>
                      )}
                      {selectedCategory === 'giri' && (
                        <>
                          <Drop className="w-3 h-3" />
                          Configure GIRI Hazards
                        </>
                      )}
                      {selectedCategory === 'energy' && (
                        <>
                          <Flashlight className="w-3 h-3" />
                          Configure Energy Infrastructure
                        </>
                      )}
                    </h4>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-sm bg-slate-800 text-white border border-slate-600">
                    <div className="space-y-1">
                      <div className="font-semibold">
                        {selectedCategory === 'climate' && <span className="text-orange-300">🌡️ Climate Configuration</span>}
                        {selectedCategory === 'giri' && <span className="text-blue-300">🌊 Disaster Risk Configuration</span>}
                        {selectedCategory === 'energy' && <span className="text-yellow-300">⚡ Energy Infrastructure Configuration</span>}
                      </div>
                      <div className="text-sm">
                        {selectedCategory === 'climate' && "Select specific climate variables (temperature, precipitation, humidity), scenarios (RCP pathways), time periods (years), and seasonal patterns. Configure these parameters to analyze climate trends and projections for your selected region."}
                        {selectedCategory === 'giri' && "Choose disaster risk categories (floods, droughts, storms), hazard intensity levels, return periods, and vulnerability assessments. Configure multi-hazard scenarios to understand cumulative disaster impacts and community resilience."}
                        {selectedCategory === 'energy' && "Select energy infrastructure types (power plants, renewable installations, transmission networks), capacity ranges, technology categories, and operational status. Configure energy system analysis for security and transition planning."}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors"
                      onClick={() => {
                        setShowSelectionPanel(false)
                        setSelectedCategory('')
                        resetSelections()
                      }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="bg-slate-800 text-white border border-slate-600">
                    <div className="text-sm">✕ Close configuration panel</div>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              {/* Climate Variables */}
              {selectedCategory === 'climate' && (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Variable</label>
                    <Select value={climateVariable} onValueChange={setClimateVariable}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Select variable" />
                      </SelectTrigger>
                      <SelectContent>
                        {climateVariables.map(variable => (
                          <SelectItem key={variable} value={variable} className="text-xs">
                            {variable}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {climateVariable && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Scenario</label>
                      <Select value={scenario} onValueChange={setScenario}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Select scenario" />
                        </SelectTrigger>
                        <SelectContent>
                          {scenarios.map(s => (
                            <SelectItem key={s} value={s} className="text-xs">
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {scenario && scenario !== 'Historical' && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Year Range</label>
                      <Select value={yearRange} onValueChange={setYearRange}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Select year range" />
                        </SelectTrigger>
                        <SelectContent>
                          {yearRanges.map(range => (
                            <SelectItem key={range} value={range} className="text-xs">
                              {range}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {scenario && (scenario === 'Historical' || yearRange) && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Seasonality</label>
                      <Select value={seasonalityType} onValueChange={setSeasonalityType}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Select seasonality" />
                        </SelectTrigger>
                        <SelectContent>
                          {seasonality.map(s => (
                            <SelectItem key={s} value={s} className="text-xs">
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {seasonalityType === 'Seasonal' && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Season</label>
                      <Select value={season} onValueChange={setSeason}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Select season" />
                        </SelectTrigger>
                        <SelectContent>
                          {getSeasonsForCountry(selectedCountry).map(seasonConfig => (
                            <SelectItem key={seasonConfig.code} value={seasonConfig.code} className="text-xs">
                              {seasonConfig.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* GIRI Variables */}
              {selectedCategory === 'giri' && (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Variable</label>
                    <Select value={giriVariable} onValueChange={setGiriVariable}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Select variable" />
                      </SelectTrigger>
                      <SelectContent>
                        {giriVariables.map(variable => (
                          <SelectItem key={variable} value={variable} className="text-xs">
                            {variable}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {giriVariable && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Scenario</label>
                      <Select value={giriScenario} onValueChange={setGiriScenario}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Select scenario" />
                        </SelectTrigger>
                        <SelectContent>
                          {giriScenarios.map(s => (
                            <SelectItem key={s} value={s} className="text-xs">
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* Energy Infrastructure */}
              {selectedCategory === 'energy' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Infrastructure Type</label>
                  <Select value={energyType} onValueChange={setEnergyType}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {energyInfrastructure.map(type => (
                        <SelectItem key={type} value={type} className="text-xs">
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={addLayer}
                    disabled={!canAddLayer()}
                    className="w-full h-7 text-xs bg-primary text-primary-foreground rounded px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Layer
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-slate-800 text-white border border-slate-600">
                  <div className="text-sm">
                    {canAddLayer() 
                      ? "➕ Add configured layer to the map for analysis" 
                      : "⚠️ Complete all required fields to add layer"}
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Active Layers */}
          {getCurrentMapLayers().length > 0 && (
            <>
              <Separator className="my-3" />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Stack className="w-4 h-4 text-blue-600" />
                  <h3 className="font-semibold text-sm text-foreground">
                    Active Layers 
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({activeMapId.toUpperCase()})
                    </span>
                  </h3>
                </div>
                
                <div className="space-y-2">
                  {getCurrentMapLayers().map(layer => (
                    <div key={layer.id} className="group relative bg-white border-2 border-gray-100 hover:border-blue-200 rounded-xl p-4 space-y-4 transition-all duration-300 hover:shadow-lg hover:shadow-blue-100/50 hover:-translate-y-0.5">
                      {/* Layer Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            {layer.category === 'climate' && <Thermometer className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />}
                            {layer.category === 'giri' && <Drop className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />}
                            {layer.category === 'energy' && <Flashlight className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0" />}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm font-medium text-foreground truncate cursor-help">
                                  {getDisplayName(layer.name, layer.category) || 'Unnamed Layer'}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-sm bg-slate-800 text-white border border-slate-600">
                                <div className="space-y-1">
                                  <div className="font-semibold">
                                    {layer.category === 'climate' && <span className="text-orange-300">🌡️ Climate Layer</span>}
                                    {layer.category === 'giri' && <span className="text-blue-300">🌊 Disaster Risk Layer</span>}
                                    {layer.category === 'energy' && <span className="text-yellow-300">⚡ Energy Infrastructure Layer</span>}
                                  </div>
                                  <div className="text-sm">
                                    <div className="font-medium">{getDisplayName(layer.name, layer.category) || 'Unnamed Layer'}</div>
                                    <div className="text-xs text-gray-300 mt-1">
                                      {layer.category === 'climate' && "This layer shows climate data patterns and projections. Use visibility and opacity controls to analyze climate variations across your selected region."}
                                      {layer.category === 'giri' && "This layer displays disaster risk and hazard information. Toggle visibility to see vulnerability patterns and risk zones for emergency planning."}
                                      {layer.category === 'energy' && "This layer shows energy infrastructure distribution and characteristics. Adjust transparency to overlay with other datasets for comprehensive energy analysis."}
                                    </div>
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <Badge 
                            variant="secondary" 
                            className={`text-[11px] h-6 px-3 font-semibold rounded-full border-2 ${
                              layer.category === 'climate' ? 'bg-orange-50 text-orange-700 border-orange-300' :
                              layer.category === 'giri' ? 'bg-green-50 text-green-700 border-green-300' :
                              layer.category === 'energy' ? 'bg-yellow-50 text-yellow-700 border-yellow-300' :
                              'bg-gray-50 text-gray-700 border-gray-300'
                            }`}
                          >
                            {(layer.category || 'unknown').toUpperCase()}
                          </Badge>
                        </div>
                        
                        {/* Layer Controls */}
                        <div className="flex items-center gap-3">
                          {/* Show/Hide Icon */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={`cursor-pointer transition-all duration-200 hover:scale-110 p-1 ${
                                  layer.visible ? 'text-blue-600' : 'text-gray-500'
                                }`}
                                onClick={() => {
                                  console.log(`👁️ Toggling visibility for layer: ${layer.id}`)
                                  toggleLayerVisibility(layer.id)
                                }}
                              >
                            {layer.visible ? (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                              </svg>
                            ) : (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                              </svg>
                            )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-slate-800 text-white border border-slate-600">
                              <div className="text-sm">
                                {layer.visible ? '👁️ Hide layer from map' : '👁️ Show layer on map'}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                          
                          {/* Remove Icon */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="cursor-pointer text-red-500 hover:text-red-700 transition-all duration-200 hover:scale-110 p-1"
                                onClick={() => {
                                  console.log(`🗑️ Removing layer: ${layer.id}`)
                                  removeLayer(layer.id)
                                }}
                              >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                </svg>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-slate-800 text-white border border-slate-600">
                              <div className="text-sm">🗑️ Remove layer from map</div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      
                      {/* Opacity Control */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs font-semibold text-foreground flex items-center gap-1 cursor-help">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                Opacity
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="bg-slate-800 text-white border border-slate-600">
                              <div className="text-sm">🎛️ Adjust layer transparency (0% = invisible, 100% = opaque)</div>
                            </TooltipContent>
                          </Tooltip>
                          <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded-md border border-blue-200">
                            {layer.opacity || 80}%
                          </span>
                        </div>
                        <div className="px-2 py-2 bg-gray-50 rounded-lg">
                          <Slider
                            value={[layer.opacity || 80]}
                            onValueChange={([value]) => {
                              console.log(`🎛️ Updating opacity for layer ${layer.id}: ${value}%`)
                              updateLayerOpacity(layer.id, value)
                            }}
                            min={0}
                            max={100}
                            step={5}
                            className="w-full slider-enhanced"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          

        </CardContent>
      </Card>

      {/* GIRI Visualization Guidance Modal */}
      <Dialog open={showGiriModal} onOpenChange={setShowGiriModal}>
        <DialogContent className="sm:max-w-[500px] border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-800">
              <Drop className="w-5 h-5 text-blue-600" />
              🌊 GIRI Data Visualization Guide
            </DialogTitle>
            <DialogDescription className="text-blue-700">
              Optimize your disaster risk data visualization for better analysis
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Main Message */}
            <div className="bg-amber-100 border-l-4 border-amber-500 p-4 rounded-r-lg">
              <div className="flex items-start gap-3">
                <div className="text-amber-600 text-xl">💡</div>
                <div>
                  <h4 className="font-semibold text-amber-800">Visualization Tip</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    GIRI disaster risk data contains very detailed, fine-grained information that can be difficult to see when overlaid on satellite or street map backgrounds.
                  </p>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                <span className="text-green-600">📋</span>
                Recommended Steps:
              </h4>
              
              <ol className="space-y-2 text-sm">
                <li className="flex items-start gap-3">
                  <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold flex-shrink-0 mt-0.5">1</span>
                  <div>
                    <span className="font-medium">Switch to "No Basemap"</span> - Go to the 
                    <span className="mx-1 px-2 py-1 bg-yellow-200 text-yellow-800 rounded text-xs font-mono animate-pulse">Basemap</span> 
                    dropdown in the header above ⬆️ and select 
                    <span className="mx-1 px-2 py-1 bg-green-200 text-green-800 rounded text-xs font-mono font-bold">No Basemap</span>
                  </div>
                </li>
                
                <li className="flex items-start gap-3">
                  <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold flex-shrink-0 mt-0.5">2</span>
                  <div>
                    <span className="font-medium">Click on regions</span> - Click on any region within your selected country to zoom in and see detailed disaster risk patterns
                  </div>
                </li>
                
                <li className="flex items-start gap-3">
                  <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold flex-shrink-0 mt-0.5">3</span>
                  <div>
                    <span className="font-medium">Adjust opacity</span> - Use the opacity slider below to fine-tune layer transparency for optimal visualization
                  </div>
                </li>
              </ol>
            </div>

            {/* Benefits */}
            <div className="bg-green-100 border-l-4 border-green-500 p-4 rounded-r-lg">
              <div className="flex items-start gap-3">
                <div className="text-green-600 text-xl">✅</div>
                <div>
                  <h4 className="font-semibold text-green-800">Benefits</h4>
                  <p className="text-sm text-green-700 mt-1">
                    This approach will reveal the intricate disaster risk patterns, vulnerability zones, and hazard intensities that are essential for emergency planning and resilience assessment.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-3">
            <Button 
              variant="outline" 
              onClick={() => setShowGiriModal(false)}
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Got It
            </Button>
            <Button 
              onClick={() => setShowGiriModal(false)}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Start Analyzing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}