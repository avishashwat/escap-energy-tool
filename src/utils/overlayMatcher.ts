// Overlay Matcher Utility for Dashboard CSV Integration
// Created: October 6, 2025
// Purpose: Match active overlays to CSV data using smart correlation logic

import { ClimateRow, GIRIRow, OverlayInfo } from './dashboardTypes'

export class OverlayMatcher {
  
  /**
   * Generate CSV key from climate overlay information
   * Converts overlay metadata to expected CSV variable format
   */
  static generateClimateKey(overlay: OverlayInfo): string {
    let key = overlay.name.toLowerCase()
    
    // Add scenario (convert to lowercase to match CSV format)
    if (overlay.scenario) {
      key += ` - ${overlay.scenario.toLowerCase()}`
    }
    
    // Add year range (skip for historical data)
    if (overlay.year && overlay.scenario?.toLowerCase() !== 'historical') {
      key += ` - ${overlay.year}`
    }
    
    // Add season (default to annual, convert to lowercase and format properly)
    let season = (overlay.season || 'annual').toLowerCase()
    
    // Fix season format: convert underscores to spaces with hyphens
    // e.g., "dec_feb" -> "dec - feb", "jun_aug" -> "jun - aug"
    season = season.replace(/_/g, ' - ')
    
    key += ` - ${season}`
    
    console.log(`🎯 Generated climate key: "${key}" from overlay:`, overlay)
    return key
  }

  /**
   * Match climate overlay to CSV data with fallback matching
   * @param overlay - Active overlay information from Dashboard
   * @param climateData - Loaded CSV climate data
   * @returns ClimateRow | null - Matched data row or null if no match
   */
  static matchClimateOverlay(overlay: OverlayInfo, climateData: ClimateRow[]): ClimateRow | null {
    if (overlay.type.toLowerCase() !== 'climate') {
      return null
    }

    const csvKey = this.generateClimateKey(overlay)
    
    // First try exact match
    let match = climateData.find(row => row.variable === csvKey)
    
    if (match) {
      console.log(`✅ Climate exact match found for "${overlay.name}":`, match.variable)
      return match
    }

    // Try word-by-word matching if exact match fails
    console.log(`🔍 Trying word-by-word matching for: "${csvKey}"`)
    
    const searchWords = csvKey
      .replace(/[_\-\s]+/g, ' ') // Normalize separators to spaces
      .split(' ')
      .filter(word => word.length > 0)
      .map(word => word.toLowerCase())

    // Find best match by counting matching words
    let bestMatch: ClimateRow | null = null
    let maxMatchCount = 0

    climateData.forEach(row => {
      const rowWords = row.variable
        .replace(/[_\-\s]+/g, ' ')
        .split(' ')
        .filter(word => word.length > 0)
        .map(word => word.toLowerCase())

      let matchCount = 0
      searchWords.forEach(searchWord => {
        if (rowWords.includes(searchWord)) {
          matchCount++
        }
      })

      // Require at least 80% of search words to match
      const matchPercentage = matchCount / searchWords.length
      if (matchPercentage >= 0.8 && matchCount > maxMatchCount) {
        maxMatchCount = matchCount
        bestMatch = row
      }
    })

    if (bestMatch !== null) {
      console.log(`✅ Climate fuzzy match found for "${overlay.name}":`, (bestMatch as ClimateRow).variable, `(${maxMatchCount}/${searchWords.length} words matched)`)
      return bestMatch
    }

    console.log(`❌ No climate match found for "${csvKey}". Available keys:`, 
      climateData.slice(0, 5).map(r => r.variable))
    
    return null
  }

  /**
   * Match GIRI overlay to CSV data
   * @param overlay - Active overlay information from Dashboard
   * @param giriData - Loaded CSV GIRI data
   * @returns GIRIRow[] - Array of matching GIRI rows (can be multiple)
   */
  static matchGIRIOverlay(overlay: OverlayInfo, giriData: GIRIRow[]): GIRIRow[] {
    if (overlay.type.toLowerCase() !== 'giri') {
      return []
    }

    // Detect hazard type from overlay name
    const overlayName = overlay.name.toLowerCase()
    let targetHazard = ''
    
    if (overlayName.includes('drought') || overlayName.includes('precipitation')) {
      targetHazard = 'drought'
    } else if (overlayName.includes('flood') || overlayName.includes('inundation')) {
      targetHazard = 'flood'
    } else {
      // If hazard type is unclear from name, try to detect from scenario or other properties
      console.warn(`⚠️ Could not determine hazard type from overlay name: "${overlay.name}"`)
      // Default to showing all hazards if we can't determine the type
      targetHazard = 'any'
    }

    // GIRI overlays can have different naming patterns
    // Try to match based on hazard type and scenario
    let matches = giriData.filter(row => {
      // Match hazard type based on detected type
      let hazardMatch = false
      if (targetHazard === 'any') {
        hazardMatch = true // Show all hazards if type is unclear
      } else {
        hazardMatch = row.hazard.toLowerCase().includes(targetHazard)
      }
      
      // Match scenario if provided
      let scenarioMatch = true
      if (overlay.scenario) {
        scenarioMatch = row.ssp.toLowerCase() === overlay.scenario.toLowerCase()
      }
      
      // Match height/category if provided
      let heightMatch = true
      if (overlay.height) {
        heightMatch = row.height === overlay.height
      }
      
      return hazardMatch && scenarioMatch && heightMatch
    })

    console.log(`🎯 GIRI matches for ${overlay.name} (hazard: ${targetHazard}, scenario: ${overlay.scenario}, height: ${overlay.height}):`, 
      matches.length, 'rows')
    
    return matches
  }

  /**
   * Get all matched data for active overlays
   * @param overlays - Record of active overlays from Dashboard
   * @param climateData - Loaded climate CSV data
   * @param giriData - Loaded GIRI CSV data
   * @returns Object with matched climate and GIRI data
   */
  static getMatchedData(
    overlays: Record<string, any>, 
    climateData: ClimateRow[], 
    giriData: GIRIRow[]
  ) {
    const matchedClimate: ClimateRow[] = []
    const matchedGIRI: GIRIRow[] = []

    Object.values(overlays).forEach(overlay => {
      // Convert overlay to OverlayInfo format
      const overlayInfo: OverlayInfo = {
        name: overlay.name || overlay.variable || 'Unknown',
        type: overlay.type || 'Unknown',
        scenario: overlay.scenario,
        year: overlay.year,
        season: overlay.season,
        height: overlay.height
      }

      console.log(`🔍 Processing overlay:`, overlayInfo)

      // Try to match climate data (case-insensitive matching)
      if (overlayInfo.type.toLowerCase() === 'climate') {
        const climateMatch = this.matchClimateOverlay(overlayInfo, climateData)
        if (climateMatch) {
          matchedClimate.push(climateMatch)
        }
      }

      // Try to match GIRI data (case-insensitive matching)
      if (overlayInfo.type.toLowerCase() === 'giri') {
        console.log(`🎯 Processing GIRI overlay: "${overlayInfo.name}" (type: ${overlayInfo.type})`)
        const giriMatches = this.matchGIRIOverlay(overlayInfo, giriData)
        console.log(`📊 Found ${giriMatches.length} GIRI matches for "${overlayInfo.name}"`)
        matchedGIRI.push(...giriMatches)
      }
    })

    console.log(`📊 Final matches: ${matchedClimate.length} climate, ${matchedGIRI.length} GIRI`)
    
    return {
      climate: matchedClimate,
      giri: matchedGIRI
    }
  }

  /**
   * Format regional data for display
   * @param regions - Regional data record
   * @returns Array of {region, value} objects sorted by value
   */
  static formatRegionalData(regions: Record<string, number>): Array<{region: string, value: number}> {
    return Object.entries(regions)
      .map(([region, value]) => ({ region, value }))
      .sort((a, b) => b.value - a.value) // Sort by value descending
  }

  /**
   * Get summary statistics for matched data
   * @param matchedData - Array of matched climate or GIRI rows
   * @returns Summary statistics object
   */
  static getSummaryStats(matchedData: (ClimateRow | GIRIRow)[]): {
    totalRows: number
    totalRegions: number
    avgValue: number
    maxValue: number
    minValue: number
  } {
    if (matchedData.length === 0) {
      return { totalRows: 0, totalRegions: 0, avgValue: 0, maxValue: 0, minValue: 0 }
    }

    let allValues: number[] = []
    let regionSet = new Set<string>()

    matchedData.forEach(row => {
      Object.entries(row.regions).forEach(([region, value]) => {
        allValues.push(value)
        regionSet.add(region)
      })
    })

    const avgValue = allValues.length > 0 ? 
      allValues.reduce((sum, val) => sum + val, 0) / allValues.length : 0

    return {
      totalRows: matchedData.length,
      totalRegions: regionSet.size,
      avgValue: Number(avgValue.toFixed(2)),
      maxValue: allValues.length > 0 ? Math.max(...allValues) : 0,
      minValue: allValues.length > 0 ? Math.min(...allValues) : 0
    }
  }
}
