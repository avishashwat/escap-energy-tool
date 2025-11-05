/**
 * Raster Analysis Utilities
 * Functions for analyzing GeoTIFF files and extracting statistics
 */

// Import GeoTIFF with proper typing
import { fromArrayBuffer } from 'geotiff'

export interface RasterStats {
  min: number
  max: number
  mean: number
  stdDev: number
  count: number
  noDataValue?: number
}

/**
 * Analyze a GeoTIFF file and extract statistical information
 */
export async function analyzeRasterFile(file: File): Promise<RasterStats> {
  try {
    console.log('Starting raster analysis for file:', file.name, 'Size:', file.size, 'Type:', file.type)
    
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    console.log('ArrayBuffer created, size:', arrayBuffer.byteLength)
    
    // Parse the GeoTIFF
    const tiff = await fromArrayBuffer(arrayBuffer)
    console.log('GeoTIFF parsed successfully')
    
    const image = await tiff.getImage()
    console.log('Image loaded, dimensions:', image.getWidth(), 'x', image.getHeight())
    
    // Get raster data
    const rasterData = await image.readRasters()
    console.log('Raster data loaded, bands:', rasterData.length)
    
    // Get the first band (assuming single-band raster for climate data)
    const band = rasterData[0] as any
    console.log('Band data type:', typeof band[0], 'length:', band.length)
    
    // Get no-data value if available
    const noDataValue = image.getGDALNoData()
    console.log('No-data value:', noDataValue)
    
    // Calculate statistics
    let min = Infinity
    let max = -Infinity
    let sum = 0
    let count = 0
    let validValues: number[] = []
    
    // Process all pixels
    for (let i = 0; i < band.length; i++) {
      let value = band[i]
      
      // Handle different data types
      if (typeof value === 'number') {
        // Already a number, good
      } else if (band.constructor === Float32Array || band.constructor === Float64Array) {
        value = Number(value)
      } else if (band.constructor === Int16Array || band.constructor === Int32Array) {
        value = Number(value)
      } else if (band.constructor === Uint16Array || band.constructor === Uint32Array) {
        value = Number(value)
      } else if (band.constructor === Uint8Array) {
        value = Number(value)
      } else {
        // Try to convert to number
        value = Number(value)
      }
      
      // Skip no-data values (check both exact match and approximate for floating point)
      if (noDataValue !== null && noDataValue !== undefined) {
        if (Math.abs(value - noDataValue) < 1e-10) {
          continue
        }
      }
      
      // Skip NaN and infinite values
      if (!isFinite(value)) {
        continue
      }
      
      // Skip extreme outliers that might be no-data values not properly marked
      if (Math.abs(value) > 1e10) {
        continue
      }
      
      validValues.push(value)
      min = Math.min(min, value)
      max = Math.max(max, value)
      sum += value
      count++
    }
    
    if (count === 0) {
      throw new Error('No valid data values found in raster')
    }
    
    const mean = sum / count
    
    // Calculate standard deviation
    let sumSquaredDiffs = 0
    for (const value of validValues) {
      sumSquaredDiffs += Math.pow(value - mean, 2)
    }
    const stdDev = Math.sqrt(sumSquaredDiffs / count)
    
    console.log('Analysis completed - found', count, 'valid pixels out of', band.length, 'total pixels')
    console.log('Final statistics:', { min, max, mean, stdDev, count })
    
    return {
      min: Number(min.toFixed(6)),
      max: Number(max.toFixed(6)),
      mean: Number(mean.toFixed(6)),
      stdDev: Number(stdDev.toFixed(6)),
      count,
      noDataValue: noDataValue || undefined
    }
    
  } catch (error) {
    console.error('Error analyzing raster file:', error)
    
    // Provide more specific error information
    if (error instanceof Error) {
      if (error.message.includes('Invalid TIFF file') || error.message.includes('magic')) {
        throw new Error('Invalid GeoTIFF file format - please ensure you uploaded a valid .tif or .tiff file')
      } else if (error.message.includes('No valid data')) {
        throw new Error('The raster file contains no valid data values - it may be corrupted or have incorrect no-data values')
      } else {
        throw new Error(`Failed to analyze raster file: ${error.message}`)
      }
    } else {
      throw new Error('Unknown error occurred during raster analysis')
    }
  }
}

/**
 * Validate that a file is a valid GeoTIFF
 */
export async function validateGeoTIFF(file: File): Promise<boolean> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const tiff = await fromArrayBuffer(arrayBuffer)
    const image = await tiff.getImage()
    
    // Check if it's georeferenced
    const geoKeys = image.getGeoKeys()
    const bbox = image.getBoundingBox()
    
    return !!(geoKeys && bbox)
  } catch (error) {
    console.error('GeoTIFF validation failed:', error)
    return false
  }
}

/**
 * Get basic raster information without full statistical analysis
 */
export async function getRasterInfo(file: File): Promise<{
  width: number
  height: number
  bbox: [number, number, number, number]
  projection?: string
  bands: number
}> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const tiff = await fromArrayBuffer(arrayBuffer)
    const image = await tiff.getImage()
    
    const width = image.getWidth()
    const height = image.getHeight()
    const bboxArray = image.getBoundingBox()
    const bbox: [number, number, number, number] = [
      bboxArray[0], bboxArray[1], bboxArray[2], bboxArray[3]
    ]
    const samplesPerPixel = image.getSamplesPerPixel()
    
    // Try to get projection information
    let projection: string | undefined
    try {
      const geoKeys = image.getGeoKeys()
      if (geoKeys?.ProjectedCSTypeGeoKey) {
        projection = `EPSG:${geoKeys.ProjectedCSTypeGeoKey}`
      } else if (geoKeys?.GeographicTypeGeoKey) {
        projection = `EPSG:${geoKeys.GeographicTypeGeoKey}`
      }
    } catch (projError) {
      console.warn('Could not determine projection:', projError)
    }
    
    return {
      width,
      height,
      bbox,
      projection,
      bands: samplesPerPixel
    }
  } catch (error) {
    console.error('Error getting raster info:', error)
    throw new Error(`Failed to get raster information: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Generate optimal classification breaks using equal intervals
 */
export function generateClassificationBreaks(
  min: number, 
  max: number, 
  numClasses: number = 5
): Array<{ min: number; max: number; label: string }> {
  const range = max - min
  const classSize = range / numClasses
  
  const breaks: Array<{ min: number; max: number; label: string }> = []
  
  for (let i = 0; i < numClasses; i++) {
    let classMin: number
    let classMax: number
    
    if (i === 0) {
      // First class: min is raster min
      classMin = min
      classMax = Number((min + classSize).toFixed(6))
    } else if (i === numClasses - 1) {
      // Last class: max is raster max
      classMin = Number((min + (classSize * i)).toFixed(6))
      classMax = max
    } else {
      classMin = Number((min + (classSize * i)).toFixed(6))
      classMax = Number((min + (classSize * (i + 1))).toFixed(6))
    }
    
    breaks.push({
      min: classMin,
      max: classMax,
      label: `${classMin} - ${classMax}`
    })
  }
  
  return breaks
}

/**
 * Generate classification breaks using natural breaks (Jenks)
 * This is a simplified version - in production you might want to use a more sophisticated algorithm
 */
export async function generateNaturalBreaks(
  file: File, 
  numClasses: number = 5
): Promise<Array<{ min: number; max: number; label: string }>> {
  // For now, fall back to equal intervals
  // In the future, this could implement Jenks natural breaks algorithm
  const stats = await analyzeRasterFile(file)
  return generateClassificationBreaks(stats.min, stats.max, numClasses)
}