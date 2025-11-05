import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChartBar } from '@phosphor-icons/react'
import { useCSVData } from '../hooks/useCSVData'
import { ClimateAnalysisSection } from './ClimateAnalysisSection'
import { RiskAssessmentSection } from './RiskAssessmentSection'

interface LayerConfig {
  id: string
  name: string
  category: 'climate' | 'giri' | 'energy'
  visible: boolean
  opacity: number
}

interface DashboardProps {
  selectedCountry: string
  activeMapCount: number
  mapOverlays: Record<string, any> // Add overlay information
}

// Function to convert technical layer names to user-friendly display names (same as Sidebar)
const getDisplayName = (layerName: string, layerType: string): string => {
  if (layerType?.toLowerCase() !== 'energy' && layerType?.toLowerCase() !== 'giri') {
    return layerName // Return original name for non-energy/giri layers
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

export function Dashboard({ selectedCountry, activeMapCount, mapOverlays }: DashboardProps) {

  // Flatten mapOverlays structure for CSV matching
  // Convert nested structure: { "map-1": { "climate": {...} } } 
  // To flat structure: { "map-1-climate": {...} }
  const flattenedOverlays = useMemo(() => {
    const flattened: Record<string, any> = {}
    
    Object.entries(mapOverlays).forEach(([mapId, mapData]) => {
      if (mapData && typeof mapData === 'object') {
        Object.entries(mapData).forEach(([layerType, overlayInfo]) => {
          if (overlayInfo && typeof overlayInfo === 'object') {
            const flatKey = `${mapId}-${layerType}`
            flattened[flatKey] = {
              ...overlayInfo,
              mapId,
              layerType
            }
          }
        })
      }
    })
    
    console.log('� DEBUG: Raw mapOverlays received:', mapOverlays)
    console.log('�🔄 Flattened overlays for CSV matching:', flattened)
    
    // Debug individual overlay structure
    Object.entries(flattened).forEach(([key, overlay]) => {
      console.log(`📋 Overlay "${key}":`, {
        name: overlay.name,
        type: overlay.type,
        scenario: overlay.scenario,
        year: overlay.year,
        season: overlay.season
      })
    })
    
    return flattened
  }, [mapOverlays])

  // Extract energy infrastructure overlays and determine type
  const energyInfrastructure = useMemo(() => {
    // Look for energy infrastructure overlays to determine type
    const energyOverlays = Object.values(flattenedOverlays).filter(overlay => 
      overlay.name?.toLowerCase().includes('energy') || 
      overlay.name?.toLowerCase().includes('infrastructure') ||
      overlay.name?.toLowerCase().includes('power') ||
      overlay.name?.toLowerCase().includes('plant') ||
      overlay.name?.toLowerCase().includes('hydro') ||
      overlay.name?.toLowerCase().includes('solar') ||
      overlay.name?.toLowerCase().includes('wind') ||
      overlay.name?.toLowerCase().includes('geothermal') ||
      overlay.name?.toLowerCase().includes('biomass') ||
      overlay.name?.toLowerCase().includes('nuclear')
    )
    
    if (energyOverlays.length > 0) {
      const overlay = energyOverlays[0]
      const name = overlay.name?.toLowerCase() || ''
      
      if (name.includes('hydro')) return { hasEnergy: true, type: 'Hydropower' }
      if (name.includes('solar')) return { hasEnergy: true, type: 'Solar' }
      if (name.includes('wind')) return { hasEnergy: true, type: 'Wind' }
      if (name.includes('geothermal')) return { hasEnergy: true, type: 'Geothermal' }
      if (name.includes('biomass')) return { hasEnergy: true, type: 'Biomass' }
      if (name.includes('nuclear')) return { hasEnergy: true, type: 'Nuclear' }
      
      // Generic energy/power/infrastructure overlay - default to hydropower
      return { hasEnergy: true, type: 'Hydropower' }
    }
    
    // No energy infrastructure overlays detected
    return { hasEnergy: false, type: null }
  }, [flattenedOverlays])

  // CSV Integration - Load and match data based on active overlays and energy type
  // Pass null energy type when no energy infrastructure is present to skip GIRI loading
  const csvData = useCSVData(
    selectedCountry, 
    flattenedOverlays, 
    energyInfrastructure.hasEnergy ? energyInfrastructure.type! : null
  )

  // Export handlers for CSV data
  const handleClimateExport = () => {
    if (!csvData.climateData.length) return
    
    // Create CSV content
    const headers = ['Variable', ...Object.keys(csvData.climateData[0].regions)]
    const rows = csvData.climateData.map(row => [
      row.variable,
      ...Object.values(row.regions)
    ])
    
    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n')
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedCountry}_climate_data.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleGIRIExport = () => {
    if (!csvData.giriData.length) return
    
    // Create CSV content  
    const headers = ['Hazard', 'SSP', 'Height', 'Energy Sector', ...Object.keys(csvData.giriData[0].regions)]
    const rows = csvData.giriData.map(row => [
      row.hazard,
      row.ssp,
      row.height,
      row.energySector,
      ...Object.values(row.regions)
    ])
    
    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n')
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedCountry}_giri_exposure_data.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card className="h-full rounded-none border-y-0 border-r-0">
      <CardHeader className="pb-4 border-b">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ChartBar className="w-5 h-5 text-primary" />
          Analytics Dashboard
        </CardTitle>
        <div className="flex gap-2">
          <Badge variant="outline">
            {selectedCountry.charAt(0).toUpperCase() + selectedCountry.slice(1)}
          </Badge>
          <Badge variant="outline">
            {activeMapCount} Map{activeMapCount > 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 custom-scroll overflow-y-auto max-h-[calc(100vh-120px)] pt-4 px-4">
        {/* Active Overlays Summary */}
        {Object.keys(mapOverlays).length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <ChartBar className="w-4 h-4 text-primary" />
              Active Overlays
            </h3>
            
            <div className="grid gap-2">
              {Object.entries(flattenedOverlays).map(([overlayKey, overlay]) => (
                <Card key={overlayKey} className="p-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-foreground">
                        Map {overlay.mapId?.split('-')[1] || '?'} - {getDisplayName(overlay.name || 'Unknown Layer', overlay.type)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {overlay.scenario && `${overlay.scenario}`}
                        {overlay.year && ` • ${overlay.year}`}
                        {overlay.season && ` • ${overlay.season}`}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {overlay.type || 'Unknown'}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* CSV Data Analysis Sections - Mutually Exclusive (Climate OR GIRI, not both) */}
        {(() => {
          // Check what overlay types we have using flattenedOverlays (case-insensitive)
          const climateOverlays = Object.values(flattenedOverlays).filter(overlay => 
            overlay.type?.toLowerCase() === 'climate'
          )
          const giriOverlays = Object.values(flattenedOverlays).filter(overlay => 
            overlay.type?.toLowerCase() === 'giri'
          )
          
          console.log('🔍 DASHBOARD DEBUG - Overlay Detection:')
          console.log('  Climate overlays found:', climateOverlays.length, climateOverlays)
          console.log('  GIRI overlays found:', giriOverlays.length, giriOverlays)
          console.log('  CSV climate data:', csvData.climateData?.length || 0, 'rows')
          console.log('  CSV GIRI data:', csvData.giriData?.length || 0, 'rows')
          
          // Apply mutual exclusivity rule: if both types exist, show only the most recent one
          // We'll prioritize GIRI if both exist (since GIRI is typically added after climate)
          const hasClimateOverlay = climateOverlays.length > 0
          const hasGIRIOverlay = giriOverlays.length > 0
          
          // GIRI dashboard requires BOTH GIRI overlay AND energy infrastructure overlay
          let showGIRI = hasGIRIOverlay && energyInfrastructure.hasEnergy && csvData.giriData && csvData.giriData.length > 0
          let showClimate = hasClimateOverlay && csvData.climateData && csvData.climateData.length > 0
          
          console.log('🔍 DASHBOARD DEBUG - Display Logic:')
          console.log('  hasClimateOverlay:', hasClimateOverlay)
          console.log('  hasGIRIOverlay:', hasGIRIOverlay)
          console.log('  hasEnergyInfrastructure:', energyInfrastructure.hasEnergy)
          console.log('  energyType:', energyInfrastructure.type)
          console.log('  showClimate (before mutual exclusivity):', showClimate)
          console.log('  showGIRI (before mutual exclusivity):', showGIRI)
          
          // If both are true, show only GIRI (mutual exclusivity)
          if (showGIRI && showClimate) {
            showClimate = false
          }
          
          console.log('🔍 DASHBOARD DEBUG - Final Decision:')
          console.log('  Final showClimate:', showClimate)
          console.log('  Final showGIRI:', showGIRI)
          
          // Show GIRI section (prioritized in mutual exclusivity)
          if (showGIRI) {
            console.log('📊 Rendering GIRI Risk Assessment Section')
            return (
              <RiskAssessmentSection 
                data={csvData.giriData} 
                selectedCountry={selectedCountry}
                onExport={handleGIRIExport}
              />
            )
          }
          
          // Show Climate section (only if GIRI is not shown)
          if (showClimate) {
            console.log('🌤️ Rendering Climate Analysis Section')
            return (
              <ClimateAnalysisSection 
                data={csvData.climateData} 
                selectedCountry={selectedCountry}
                onExport={handleClimateExport}
              />
            )
          }
          
          // No dashboard section to render - provide specific reason
          if (hasGIRIOverlay && !energyInfrastructure.hasEnergy) {
            console.log('⚠️ GIRI overlay detected but no energy infrastructure overlay - GIRI dashboard requires both')
            return null
          }
          
          console.log('❌ No dashboard section to render - no active overlays with matching CSV data')
          return null
        })()}
      </CardContent>
    </Card>
  )
}