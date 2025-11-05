import { Vector as VectorSource } from 'ol/source'
import { Vector as VectorLayer, Image as ImageLayer } from 'ol/layer'
import { Style, Fill, Stroke, Circle } from 'ol/style'
import { GeoJSON } from 'ol/format'
import TileLayer from 'ol/layer/Tile'
import XYZ from 'ol/source/XYZ'

/**
 * Utility functions for loading and managing geospatial data
 */

// Data file path resolver
export const resolveDataPath = (type: string, country: string, ...pathParts: string[]): string => {
  const basePath = '/src/assets/data'
  return `${basePath}/${type}/${country}/${pathParts.join('/')}`
}

// Climate data path resolver
export const resolveClimatePath = (
  country: string,
  variable: string,
  scenario: string,
  yearRange?: string,
  seasonality?: string,
  season?: string
): string => {
  let path = `climate/${country}/${variable}/${scenario}`
  
  if (scenario !== 'historical' && yearRange) {
    path += `/${yearRange}`
  }
  
  if (seasonality) {
    path += `/${seasonality}`
  }
  
  if (season && seasonality === 'seasonal') {
    path += `/${variable}_${season}.cog`
  } else {
    path += `/${variable}_annual.cog`
  }
  
  return resolveDataPath('', '', path)
}

// GIRI data path resolver
export const resolveGiriPath = (
  country: string,
  variable: string,
  scenario: string
): string => {
  return resolveDataPath('giri', country, variable, `${variable}_${scenario}.cog`)
}

// Energy data path resolver
export const resolveEnergyPath = (
  country: string,
  type: string
): string => {
  return resolveDataPath('energy', country, `${type}_power_plants.shp`)
}

/**
 * Load COG raster as OpenLayers layer
 * For now, simplified implementation until proper COG support is added
 */
export const loadCogLayer = async (
  url: string,
  classification?: any
) => {
  try {
    // Simplified implementation - would use proper COG loading in production
    console.log(`Loading COG layer from: ${url}`)
    console.log('Classification:', classification)
    
    // Return a placeholder layer for now
    const layer = new TileLayer({
      source: new XYZ({
        url: '', // Will be replaced with actual COG tiles
        projection: 'EPSG:4326'
      }),
      opacity: 0.7,
      visible: false // Hide until properly implemented
    })

    return layer
  } catch (error) {
    console.error('Error loading COG layer:', error)
    throw error
  }
}

/**
 * Load shapefile as OpenLayers vector layer
 */
export const loadShapefileLayer = async (
  baseUrl: string,
  style?: any
) => {
  try {
    // For shapefiles, we need to load the .shp file and associated files
    // This is a simplified implementation - in production you'd use a proper shapefile loader
    
    const source = new VectorSource({
      url: baseUrl,
      format: new GeoJSON() // Assuming conversion to GeoJSON for web compatibility
    })

    const defaultStyle = new Style({
      fill: new Fill({
        color: 'rgba(0, 114, 188, 0.3)' // UN Blue with transparency
      }),
      stroke: new Stroke({
        color: '#0072bc',
        width: 2
      }),
      image: new Circle({
        radius: 6,
        fill: new Fill({
          color: '#0072bc'
        }),
        stroke: new Stroke({
          color: '#ffffff',
          width: 2
        })
      })
    })

    const layer = new VectorLayer({
      source,
      style: style || defaultStyle
    })

    return layer
  } catch (error) {
    console.error('Error loading shapefile layer:', error)
    throw error
  }
}

/**
 * Load classification data for a variable
 */
export const loadClassification = async (variable: string): Promise<any> => {
  try {
    const response = await fetch(resolveDataPath('classifications', '', `${variable}.json`))
    if (!response.ok) {
      throw new Error(`Classification not found for ${variable}`)
    }
    return await response.json()
  } catch (error) {
    console.warn(`No classification found for ${variable}, using default`)
    return null
  }
}

/**
 * Parse seasonal file names to extract season information
 */
export const parseSeasonalFiles = (files: string[]): Array<{ season: string, fromMonth: string, toMonth: string, file: string }> => {
  const seasons: Array<{ season: string, fromMonth: string, toMonth: string, file: string }> = []
  
  files.forEach(file => {
    const match = file.match(/.*_(\d{2})_(\d{2})\.(cog|tif)$/)
    if (match) {
      const fromMonth = match[1]
      const toMonth = match[2]
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ]
      
      const fromName = monthNames[parseInt(fromMonth) - 1]
      const toName = monthNames[parseInt(toMonth) - 1]
      const season = `${fromName}-${toName}`
      
      seasons.push({
        season,
        fromMonth,
        toMonth,
        file
      })
    }
  })
  
  return seasons.sort((a, b) => parseInt(a.fromMonth) - parseInt(b.fromMonth))
}

/**
 * Check if a file exists
 */
export const checkFileExists = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Get available files in a directory (would need backend support)
 */
export const getAvailableFiles = async (path: string): Promise<string[]> => {
  // This would require a backend endpoint to list files
  // For now, return empty array
  console.warn('File listing not implemented - requires backend support')
  return []
}