// CSV Loader Utility for Dashboard
// Created: October 6, 2025
// Purpose: Load and parse CSV data files for Climate and GIRI analysis

import { ClimateRow, GIRIRow } from './dashboardTypes'

export class CSVLoader {
  private static baseDataPath = '/data/dashboard'

  /**
   * Load climate data for a specific country
   * @param country - Country name (e.g., "Bhutan", "Mongolia", "Laos")
   * @returns Promise<ClimateRow[]> - Parsed climate data
   */
  static async loadClimateData(country: string): Promise<ClimateRow[]> {
    try {
      // Capitalize country name to match file naming convention (e.g., "bhutan" → "Bhutan")
      const capitalizedCountry = country.charAt(0).toUpperCase() + country.slice(1)
      const csvPath = `${this.baseDataPath}/Climate/Climate trend ${capitalizedCountry}.csv`
      console.log(`📊 Loading climate data from: ${csvPath}`)
      
      const response = await fetch(csvPath)
      if (!response.ok) {
        throw new Error(`Failed to load climate CSV: ${response.statusText}`)
      }
      
      const csvText = await response.text()
      return this.parseClimateCSV(csvText)
    } catch (error) {
      console.error(`❌ Error loading climate data for ${country}:`, error)
      throw new Error(`Could not load climate data for ${country}`)
    }
  }

  /**
   * Load GIRI exposure data for a specific country and energy infrastructure type
   * @param country - Country name (e.g., "Bhutan", "Mongolia", "Laos") 
   * @param energyType - Energy infrastructure type (e.g., "Hydropower", "Solar", "Wind", "Geothermal")
   * @returns Promise<GIRIRow[]> - Parsed GIRI data
   */
  static async loadGIRIData(country: string, energyType: string = 'Hydropower'): Promise<GIRIRow[]> {
    try {
      // Generate standardized CSV filename based on energy type
      const csvPath = this.getGIRIFilePath(country, energyType)
      console.log(`📊 Loading GIRI ${energyType} data from: ${csvPath}`)
      
      const response = await fetch(csvPath)
      if (!response.ok) {
        // Fallback to hydropower if specific energy type not found
        if (energyType !== 'Hydropower') {
          console.warn(`⚠️ ${energyType} GIRI data not found, falling back to Hydropower`)
          return this.loadGIRIData(country, 'Hydropower')
        }
        throw new Error(`Failed to load GIRI CSV: ${response.statusText}`)
      }
      
      const csvText = await response.text()
      return this.parseGIRICSV(csvText)
    } catch (error) {
      console.error(`❌ Error loading GIRI ${energyType} data for ${country}:`, error)
      throw new Error(`Could not load GIRI ${energyType} data for ${country}`)
    }
  }

  /**
   * Generate standardized GIRI file path based on country and energy type
   * @param country - Country name
   * @param energyType - Energy infrastructure type
   * @returns string - Full CSV file path
   */
  private static getGIRIFilePath(country: string, energyType: string): string {
    // Normalize energy type for consistent file naming
    const normalizedEnergyType = this.normalizeEnergyType(energyType)
    // Capitalize country name to match file naming convention (e.g., "bhutan" → "Bhutan")
    const capitalizedCountry = country.charAt(0).toUpperCase() + country.slice(1)
    return `${this.baseDataPath}/${normalizedEnergyType}/${capitalizedCountry}_GIRIExposure_${normalizedEnergyType}_tool.csv`
  }

  /**
   * Normalize energy type names for consistent file system organization
   * @param energyType - Input energy type (may have variations in casing/spacing)
   * @returns string - Standardized energy type name
   */
  private static normalizeEnergyType(energyType: string): string {
    const normalized = energyType.toLowerCase().trim()
    
    // Map variations to standard names
    const energyTypeMap: Record<string, string> = {
      'hydropower': 'Hydropower',
      'hydro': 'Hydropower',
      'hydroelectric': 'Hydropower',
      'solar': 'Solar',
      'photovoltaic': 'Solar',
      'pv': 'Solar',
      'wind': 'Wind',
      'geothermal': 'Geothermal',
      'biomass': 'Biomass',
      'nuclear': 'Nuclear'
    }
    
    return energyTypeMap[normalized] || 'Hydropower'
  }

  /**
   * Parse climate CSV text into structured data
   * Format: Variable,Region1,Region2,Region3,...
   */
  private static parseClimateCSV(csvText: string): ClimateRow[] {
    const lines = csvText.trim().split('\n')
    if (lines.length < 2) {
      throw new Error('Invalid climate CSV format')
    }

    // Parse header to get region names
    const header = lines[0].split(',')
    const regionNames = header.slice(1) // Skip "Variable" column

    // Parse data rows
    const climateRows: ClimateRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',')
      if (row.length < 2) continue

      const variable = row[0].trim()
      const regions: Record<string, number> = {}
      
      // Parse regional values
      for (let j = 1; j < row.length && j - 1 < regionNames.length; j++) {
        const regionName = regionNames[j - 1].trim()
        const value = parseFloat(row[j].trim())
        if (!isNaN(value)) {
          regions[regionName] = value
        }
      }

      climateRows.push({ variable, regions })
    }

    console.log(`✅ Parsed ${climateRows.length} climate data rows`)
    return climateRows
  }

  /**
   * Parse GIRI CSV text into structured data
   * Format: Hazard,SSP,Height,Energy sector,Region1,Region2,Region3,...
   */
  private static parseGIRICSV(csvText: string): GIRIRow[] {
    const lines = csvText.trim().split('\n')
    if (lines.length < 2) {
      throw new Error('Invalid GIRI CSV format')
    }

    // Parse header to get region names  
    const header = lines[0].split(',')
    const regionNames = header.slice(4) // Skip first 4 columns: Hazard,SSP,Height,Energy sector

    // Parse data rows
    const giriRows: GIRIRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',')
      if (row.length < 5) continue

      const hazard = row[0].trim()
      const ssp = row[1].trim()
      const height = row[2].trim()
      const energySector = row[3].trim()
      const regions: Record<string, number> = {}

      // Parse regional values
      for (let j = 4; j < row.length && j - 4 < regionNames.length; j++) {
        const regionName = regionNames[j - 4].trim()
        const value = parseFloat(row[j].trim())
        if (!isNaN(value)) {
          regions[regionName] = value
        }
      }

      giriRows.push({ hazard, ssp, height, energySector, regions })
    }

    console.log(`✅ Parsed ${giriRows.length} GIRI data rows`)
    return giriRows
  }

  /**
   * Validate if country has data available
   * @param country - Country name to validate
   * @returns boolean - True if data files exist
   */
  static async validateCountryData(country: string): Promise<{climate: boolean, giri: boolean}> {
    const results = { climate: false, giri: false }
    // Capitalize country name to match file naming convention
    const capitalizedCountry = country.charAt(0).toUpperCase() + country.slice(1)

    try {
      // Check climate data
      const climateResponse = await fetch(`${this.baseDataPath}/Climate/Climate trend ${capitalizedCountry}.csv`, { method: 'HEAD' })
      results.climate = climateResponse.ok
    } catch (error) {
      console.warn(`Climate data not available for ${country}`)
    }

    try {
      // Check GIRI data
      const giriResponse = await fetch(`${this.baseDataPath}/Hydropower/${capitalizedCountry}_GIRIExposure_Hydropower_tool.csv`, { method: 'HEAD' })
      results.giri = giriResponse.ok
    } catch (error) {
      console.warn(`GIRI data not available for ${country}`)
    }

    return results
  }
}