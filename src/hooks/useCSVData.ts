// Custom Hook for Dashboard CSV Data Management
// Created: October 6, 2025  
// Purpose: React hook to load and manage CSV data based on active overlays

import { useState, useEffect, useCallback } from 'react'
import { CSVLoader } from '../utils/csvLoader'
import { OverlayMatcher } from '../utils/overlayMatcher'
import { ClimateRow, GIRIRow, DashboardCSVData } from '../utils/dashboardTypes'

export function useCSVData(selectedCountry: string, mapOverlays: Record<string, any>, energyType: string | null = 'Hydropower') {
  const [csvData, setCSVData] = useState<DashboardCSVData>({
    climateData: [],
    giriData: [],
    loading: false,
    error: null
  })

  const [rawData, setRawData] = useState<{
    climate: ClimateRow[]
    giri: GIRIRow[]
    loadedCountry: string | null
    loadedEnergyType: string | null
  }>({
    climate: [],
    giri: [],
    loadedCountry: null,
    loadedEnergyType: null
  })

  // Load raw CSV data when country or energy type changes
  const loadCountryData = useCallback(async (country: string, currentEnergyType: string | null) => {
    if (!country || (rawData.loadedCountry === country && rawData.loadedEnergyType === currentEnergyType)) {
      console.log(`⏭️ Skipping CSV load for ${country} (${currentEnergyType}) - already loaded or invalid`)
      return // Already loaded or invalid country/energy type combination
    }

    console.log(`📊 🚀 STARTING CSV data load for ${country} (${currentEnergyType || 'no energy type'})`)
    setCSVData(prev => ({ ...prev, loading: true, error: null }))

    try {
      // Validate data availability first
      const availability = await CSVLoader.validateCountryData(country)
      console.log(`📋 Data availability for ${country}:`, availability)

      let climate: ClimateRow[] = []
      let giri: GIRIRow[] = []

      // Load climate data if available
      if (availability.climate) {
        try {
          climate = await CSVLoader.loadClimateData(country)
          console.log(`✅ Loaded ${climate.length} climate rows for ${country}`)
        } catch (error) {
          console.warn(`⚠️ Could not load climate data for ${country}:`, error)
        }
      }

      // Load GIRI data if available AND energy type is specified
      if (availability.giri && currentEnergyType) {
        try {
          giri = await CSVLoader.loadGIRIData(country, currentEnergyType)
          console.log(`✅ Loaded ${giri.length} GIRI ${currentEnergyType} rows for ${country}`)
        } catch (error) {
          console.warn(`⚠️ Could not load GIRI ${currentEnergyType} data for ${country}:`, error)
        }
      } else if (availability.giri && !currentEnergyType) {
        console.log(`⏭️ Skipping GIRI data load for ${country} - no energy infrastructure type specified`)
      }

      // Update raw data cache
      setRawData({
        climate,
        giri,
        loadedCountry: country,
        loadedEnergyType: currentEnergyType
      })

      setCSVData(prev => ({
        ...prev,
        loading: false,
        error: null
      }))

      console.log(`🎉 CSV data loading COMPLETED for ${country}`)

    } catch (error) {
      console.error(`❌ Failed to load CSV data for ${country}:`, error)
      setCSVData(prev => ({
        ...prev,
        loading: false,
        error: `Could not load data for ${country}: ${error instanceof Error ? error.message : 'Unknown error'}`
      }))
    }
  }, [rawData.loadedCountry, rawData.loadedEnergyType])

  // Load country data when selectedCountry or energyType changes
  useEffect(() => {
    if (selectedCountry) {
      loadCountryData(selectedCountry, energyType)
    }
  }, [selectedCountry, energyType, loadCountryData])

  // Match overlays to CSV data when overlays change
  useEffect(() => {
    if (!rawData.climate.length && !rawData.giri.length) {
      // No raw data loaded yet
      setCSVData(prev => ({ ...prev, climateData: [], giriData: [] }))
      return
    }

    if (Object.keys(mapOverlays).length === 0) {
      // No overlays active
      setCSVData(prev => ({ ...prev, climateData: [], giriData: [] }))
      return
    }

    console.log(`🔍 🎯 MATCHING overlays to CSV data:`, Object.keys(mapOverlays), mapOverlays)

    try {
      const matched = OverlayMatcher.getMatchedData(mapOverlays, rawData.climate, rawData.giri)
      
      setCSVData(prev => ({
        ...prev,
        climateData: matched.climate,
        giriData: matched.giri,
        error: null
      }))

      console.log(`📊 Updated dashboard data: ${matched.climate.length} climate, ${matched.giri.length} GIRI`)

    } catch (error) {
      console.error(`❌ Error matching overlay data:`, error)
      setCSVData(prev => ({
        ...prev,
        error: `Error processing overlay data: ${error instanceof Error ? error.message : 'Unknown error'}`
      }))
    }
  }, [mapOverlays, rawData])

  // Utility functions for components
  const getClimateStats = useCallback(() => {
    return OverlayMatcher.getSummaryStats(csvData.climateData)
  }, [csvData.climateData])

  const getGIRIStats = useCallback(() => {
    return OverlayMatcher.getSummaryStats(csvData.giriData)
  }, [csvData.giriData])

  const exportCSVData = useCallback((type: 'climate' | 'giri') => {
    const data = type === 'climate' ? csvData.climateData : csvData.giriData
    if (data.length === 0) {
      console.warn(`No ${type} data to export`)
      return
    }

    // Convert to CSV format for export
    const headers = type === 'climate' 
      ? ['Variable', ...Object.keys(data[0].regions)]
      : ['Hazard', 'SSP', 'Height', 'Energy Sector', ...Object.keys(data[0].regions)]
    
    const rows = data.map(row => {
      if (type === 'climate') {
        return [row.variable, ...Object.values(row.regions)]
      } else {
        const giriRow = row as GIRIRow
        return [giriRow.hazard, giriRow.ssp, giriRow.height, giriRow.energySector, ...Object.values(giriRow.regions)]
      }
    })

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
    
    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedCountry}_${type}_data.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    console.log(`💾 Exported ${type} data for ${selectedCountry}`)
  }, [csvData, selectedCountry])

  return {
    ...csvData,
    getClimateStats,
    getGIRIStats,
    exportCSVData,
    hasClimateData: csvData.climateData.length > 0,
    hasGIRIData: csvData.giriData.length > 0,
    dataAvailable: rawData.climate.length > 0 || rawData.giri.length > 0
  }
}