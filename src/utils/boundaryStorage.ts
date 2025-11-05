// Utility functions for boundary data storage and retrieval
import { SparkFallback } from './sparkFallback.js'

export interface BoundaryFile {
  id: string
  name: string
  country: string
  adminLevel: number
  size: number
  attributes: string[]
  hoverAttribute: string
  uploadedAt: number
  filePath: string
  metadata?: {
    featureCount: number
    bounds: [number, number, number, number] // [minX, minY, maxX, maxY]
    projection: string
    storageType?: 'direct' | 'chunked'
    compressedSize?: number
    originalSize?: number
    compressionRatio?: number
  }
}

/**
 * Retrieve boundary GeoJSON data, handling both direct and chunked storage
 */
export async function getBoundaryGeoJSON(boundaryId: string, storageType?: 'direct' | 'chunked'): Promise<any | null> {
  try {
    if (storageType === 'chunked') {
      console.log('Loading chunked boundary data for:', boundaryId)
      
      const meta = await SparkFallback.get<{ chunks: number; originalSize: number; timestamp: number }>(`boundary_geojson_${boundaryId}_meta`)
      if (!meta) {
        console.error('No chunked metadata found for:', boundaryId)
        return null
      }
      
      let data = ''
      for (let i = 0; i < meta.chunks; i++) {
        const chunk = await SparkFallback.get<string>(`boundary_geojson_${boundaryId}_chunk_${i}`)
        if (chunk) {
          data += chunk
        } else {
          console.error(`Missing chunk ${i} for boundary:`, boundaryId)
          return null
        }
      }
      
      if (data.length !== meta.originalSize) {
        console.error(`Data length mismatch for boundary ${boundaryId}: expected ${meta.originalSize}, got ${data.length}`)
        return null
      }
      
      return JSON.parse(data)
    } else {
      console.log('Loading direct boundary data for:', boundaryId)
      return await SparkFallback.get(`boundary_geojson_${boundaryId}`)
    }
  } catch (error) {
    console.error('Error retrieving boundary GeoJSON:', error)
    return null
  }
}

/**
 * Get boundary file metadata for a specific country
 */
export async function getBoundaryForCountry(country: string): Promise<BoundaryFile | null> {
  try {
    const boundaryFiles = await SparkFallback.get<BoundaryFile[]>('admin_boundary_files') || []
    return boundaryFiles.find(file => file.country === country) || null
  } catch (error) {
    console.error('Error getting boundary for country:', error)
    return null
  }
}

/**
 * Get all boundary files
 */
export async function getAllBoundaryFiles(): Promise<BoundaryFile[]> {
  try {
    return await SparkFallback.get<BoundaryFile[]>('admin_boundary_files') || []
  } catch (error) {
    console.error('Error getting all boundary files:', error)
    return []
  }
}

/**
 * Get storage statistics for all boundaries
 */
export async function getBoundaryStorageStats(): Promise<{
  totalFiles: number
  totalOriginalSize: number
  totalCompressedSize: number
  totalCompressionSaved: number
  chunkedFiles: number
  directFiles: number
}> {
  try {
    const boundaryFiles = await getAllBoundaryFiles()
    
    let totalOriginalSize = 0
    let totalCompressedSize = 0
    let chunkedFiles = 0
    let directFiles = 0
    
    for (const file of boundaryFiles) {
      if (file.metadata?.originalSize) {
        totalOriginalSize += file.metadata.originalSize
      }
      if (file.metadata?.compressedSize) {
        totalCompressedSize += file.metadata.compressedSize
      }
      
      if (file.metadata?.storageType === 'chunked') {
        chunkedFiles++
      } else {
        directFiles++
      }
    }
    
    return {
      totalFiles: boundaryFiles.length,
      totalOriginalSize,
      totalCompressedSize,
      totalCompressionSaved: totalOriginalSize - totalCompressedSize,
      chunkedFiles,
      directFiles
    }
  } catch (error) {
    console.error('Error getting boundary storage stats:', error)
    return {
      totalFiles: 0,
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      totalCompressionSaved: 0,
      chunkedFiles: 0,
      directFiles: 0
    }
  }
}