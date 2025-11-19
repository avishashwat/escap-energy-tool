// Enhanced layer validation utilities for robust file handling
// Ensures frontend doesn't break when selected rasters haven't been uploaded yet

import { generateSeasonFilename } from './countrySeasons'

export interface LayerValidationResult {
  isValid: boolean
  hasRealData: boolean
  missingFiles: string[]
  warnings: string[]
  fallbackAvailable: boolean
}

export interface LayerRequest {
  country: string
  dataType: string
  variable: string
  scenario?: string
  yearRange?: string
  seasonality?: string
  season?: string
}

export interface ValidatedLayerInfo {
  type: string
  name: string
  scenario?: string
  year?: string
  season?: string
  hasRealData: boolean
  isValidated: boolean
  validationWarnings: string[]
  fallbackMode: boolean
  classifications?: any
  statistics?: any
}

export class LayerValidator {
  static async validateLayerRequest(request: LayerRequest): Promise<LayerValidationResult> {
    const result: LayerValidationResult = {
      isValid: true,
      hasRealData: false,
      missingFiles: [],
      warnings: [],
      fallbackAvailable: true
    }

    try {
      // Check if uploaded files exist for this configuration
      const expectedFilename = this.generateExpectedFilename(request)
      const uploadedFiles = await this.getUploadedFiles(request.dataType)
      
      // Look for exact match first
      console.log(`🎯 LayerValidator searching for: country=${request.country}, dataType=${request.dataType}, variable=${request.variable}, scenario=${request.scenario}`)
      console.log(`📋 Available files:`, uploadedFiles.map(f => ({ name: f.name, country: f.country, category: f.category, subcategory: f.subcategory, scenario: f.scenario })))
      
      const exactMatch = uploadedFiles.find(file => 
        file.country?.toLowerCase() === request.country?.toLowerCase() &&
        file.category?.toLowerCase() === request.dataType?.toLowerCase() &&
        file.subcategory?.toLowerCase() === request.variable?.toLowerCase() &&
        (!request.scenario || file.scenario?.toLowerCase() === request.scenario?.toLowerCase()) &&
        (file.status === 'active' || !file.status) // GeoServer data might not have status field
      )

      if (exactMatch) {
        console.log(`✅ LayerValidator found exact match:`, exactMatch.name)
        result.hasRealData = true
        return result
      }

      // Look for partial matches (same country, variable, but different scenario/timeframe)
      const partialMatches = uploadedFiles.filter(file =>
        file.country?.toLowerCase() === request.country?.toLowerCase() &&
        file.category?.toLowerCase() === request.dataType?.toLowerCase() &&
        file.subcategory?.toLowerCase() === request.variable?.toLowerCase() &&
        (file.status === 'active' || !file.status) // GeoServer data might not have status field
      )

      if (partialMatches.length > 0) {
        console.log(`🔍 LayerValidator found ${partialMatches.length} partial matches:`, partialMatches.map(f => f.name))
        result.warnings.push(`Found ${partialMatches.length} related files with different scenarios/timeframes.`)
        result.hasRealData = true  // We have some real data, even if not exact match
        result.fallbackAvailable = true
      } else {
        console.log(`❌ LayerValidator found no matches for request`)
        result.missingFiles.push(expectedFilename)
        //result.warnings.push(`No uploaded data found for ${request.variable} in ${request.country}. Using fallback data.`)
        result.hasRealData = false
        result.fallbackAvailable = true
      }

      // Always allow fallback for demo purposes
      result.isValid = true

    } catch (error) {
      console.warn('Layer validation failed:', error)
      result.warnings.push('Could not validate layer - using fallback data')
      result.fallbackAvailable = true
      result.isValid = true
    }

    return result
  }

  static generateExpectedFilename(request: LayerRequest): string {
    const {
      country,
      dataType, 
      variable,
      scenario,
      yearRange,
      seasonality,
      season
    } = request

    // Generate expected filename based on naming convention
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')
    
    let filename = `${country}_${dataType}`
    
    // Add variable (subcategory)
    const safeVariable = variable.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    filename += `_${safeVariable}`
    
    // Add scenario if present
    if (scenario) {
      filename += `_${scenario.toLowerCase()}`
    }
    
    // Add year range if present
    if (yearRange) {
      filename += `_${yearRange.replace('-', '_')}`
    }
    
    // Add seasonality using the new season configuration system
    const seasonSuffix = generateSeasonFilename(seasonality || 'Annual', season)
    if (seasonSuffix) {
      filename += seasonSuffix
    }
    
    return `${filename}.tif`
  }

  private static async getUploadedFiles(dataType?: string): Promise<any[]> {
    try {
      // Choose correct API endpoint based on data type
      let endpoint = '/api/geoserver/rasters' // default for climate/giri
      let dataKey = 'rasters'
      
      if (dataType === 'energy') {
        endpoint = '/api/geoserver/energy-infrastructure'
        dataKey = 'data' // energy infrastructure uses 'data' key, not 'rasters'
        console.log('🔍 LayerValidator fetching energy infrastructure from GeoServer API...')
      } else {
        console.log('🔍 LayerValidator fetching rasters from GeoServer API...')
      }
      
      const response = await fetch(endpoint)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ${dataType || 'rasters'}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || `Failed to fetch ${dataType || 'rasters'}`)
      }
      
      console.log(`✅ LayerValidator found ${data.count} ${dataType || 'rasters'} in GeoServer`)
      return data[dataKey] || []
    } catch (error) {
      console.warn('Could not fetch uploaded files from GeoServer:', error)
      
      // Fallback to localStorage (for backward compatibility)
      try {
        const { SparkFallback } = await import('../utils/sparkFallback')
        const localData = await SparkFallback.get('uploaded_files')
        const localFiles = Array.isArray(localData) ? localData : []
        console.log(`📁 LayerValidator fallback to localStorage: ${localFiles.length} files`)
        return localFiles
      } catch (localError) {
        console.warn('LocalStorage fallback also failed:', localError)
        return []
      }
    }
  }

  // Enhanced layer info generation with validation
  static async generateValidatedLayerInfo(request: LayerRequest): Promise<{
    layerInfo: ValidatedLayerInfo
    validation: LayerValidationResult
  }> {
    const validation = await this.validateLayerRequest(request)
    
    const layerInfo: ValidatedLayerInfo = {
      type: this.getLayerTypeLabel(request.dataType),
      name: request.variable,
      scenario: request.scenario,
      year: request.yearRange,
      season: request.season || (request.seasonality === 'Annual' ? 'Annual' : undefined),
      // Include metadata about data availability
      hasRealData: validation.hasRealData,
      isValidated: true,
      validationWarnings: validation.warnings,
      fallbackMode: !validation.hasRealData
    }

    // Only include real data if available
    if (validation.hasRealData) {
      try {
        const uploadedData = await this.getUploadedDataConfig(request)
        if (uploadedData) {
          layerInfo.classifications = uploadedData.classifications
          layerInfo.statistics = uploadedData.statistics
        }
      } catch (error) {
        console.warn('Could not load real data config:', error)
      }
    }

    return { layerInfo, validation }
  }

  private static getLayerTypeLabel(dataType: string): string {
    const typeMap: Record<string, string> = {
      'climate': 'Climate',
      'giri': 'GIRI',
      'energy': 'Energy'
    }
    return typeMap[dataType] || dataType
  }

  private static async getUploadedDataConfig(request: LayerRequest): Promise<any> {
    try {
      const { SparkFallback } = await import('../utils/sparkFallback')
      const uploadedData = await SparkFallback.get('uploaded-data-configs')
      
      if (!uploadedData) return null

      const categoryKey = request.variable.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')
      return uploadedData[request.country]?.[categoryKey] || null
    } catch (error) {
      console.warn('Could not load uploaded data config:', error)
      return null
    }
  }

//   Utility to show user-friendly messages about missing data
  static generateUserMessage(validation: LayerValidationResult, request: LayerRequest): string {
    if (validation.hasRealData) {
      return `Showing real data for ${request.variable}`
    }

    // if (validation.warnings.length > 0) {
    //   return `${validation.warnings[0]} Showing demo data instead.`
    // }

    return `Showing data for ${request.variable}`
  }
}
