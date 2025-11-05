/**
 * Data Upload and Processing Utilities
 * Helper functions for handling file uploads and data integration
 */

export interface DataClassification {
  type: 'classified'
  classes: Array<{
    min: number
    max: number
    label: string
    color: string
  }>
}

export interface BoundaryInfo {
  country: string
  bounds: [number, number, number, number] // [minx, miny, maxx, maxy]
  center: [number, number]
  zoom: number
  extent: {
    minx: number
    miny: number
    maxx: number
    maxy: number
  }
}

export interface EnergyStats {
  min: number
  max: number
  mean: number
  count: number
}

/**
 * Upload and process boundary shapefile
 */
export async function uploadBoundaryShapefile(files: FileList): Promise<BoundaryInfo | null> {
  // Check for required shapefile components
  const requiredExtensions = ['.shp', '.shx', '.dbf', '.prj']
  const uploadedFiles = Array.from(files)
  
  const hasAllComponents = requiredExtensions.every(ext => 
    uploadedFiles.some(file => file.name.toLowerCase().endsWith(ext))
  )
  
  if (!hasAllComponents) {
    throw new Error('Please upload all shapefile components (.shp, .shx, .dbf, .prj)')
  }
  
  // In a real implementation, you would:
  // 1. Upload files to a processing endpoint
  // 2. Convert to GeoJSON on the server
  // 3. Extract bounds and center
  // 4. Return processed boundary info
  
  console.log('Boundary shapefile upload not yet implemented')
  return null
}

/**
 * Upload and process raster TIF file
 */
export async function uploadRasterFile(file: File, country: string, variable: string): Promise<string | null> {
  if (!file.name.toLowerCase().endsWith('.tif') && !file.name.toLowerCase().endsWith('.tiff')) {
    throw new Error('Please upload a valid TIF raster file')
  }
  
  // In a real implementation, you would:
  // 1. Upload TIF file to processing endpoint
  // 2. Convert to COG format on the server
  // 3. Generate appropriate styling based on classification
  // 4. Return URL to processed COG file
  
  console.log(`Raster file upload not yet implemented: ${file.name}`)
  return null
}

/**
 * Upload and process Excel classification file
 */
export async function uploadClassificationFile(file: File): Promise<DataClassification | null> {
  if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
    throw new Error('Please upload a valid Excel file (.xlsx or .xls)')
  }
  
  // In a real implementation, you would:
  // 1. Parse Excel file on client or server
  // 2. Validate required columns (min_value, max_value, class_name, color_hex)
  // 3. Convert to DataClassification format
  // 4. Return processed classification
  
  console.log(`Classification file upload not yet implemented: ${file.name}`)
  return null
}

/**
 * Upload and process energy infrastructure shapefile
 */
export async function uploadEnergyShapefile(file: File, energyType: string): Promise<EnergyStats | null> {
  if (!file.name.toLowerCase().endsWith('.shp')) {
    throw new Error('Please upload a valid shapefile (.shp)')
  }
  
  // In a real implementation, you would:
  // 1. Upload shapefile and components
  // 2. Validate designCapacity field exists
  // 3. Convert to GeoJSON
  // 4. Calculate capacity statistics for legend
  // 5. Return processed energy stats
  
  console.log(`Energy shapefile upload not yet implemented: ${file.name}`)
  return null
}

/**
 * Generate file upload instructions based on data type
 */
export function getUploadInstructions(dataType: 'boundary' | 'raster' | 'classification' | 'energy'): string {
  switch (dataType) {
    case 'boundary':
      return `
Upload boundary shapefile components:
• Upload ALL files: .shp, .shx, .dbf, .prj
• File should contain ADM1 level boundaries
• Coordinate system: EPSG:4326 (WGS84)
• Naming: {country}_adm1.shp
      `.trim()
    
    case 'raster':
      return `
Upload raster TIF file:
• File format: GeoTIFF (.tif or .tiff)
• Coordinate system: EPSG:4326 (WGS84)
• Naming: {country}_{variable}_{scenario}_{period}.tif
• Will be automatically converted to COG format
      `.trim()
    
    case 'classification':
      return `
Upload Excel classification file:
• File format: Excel (.xlsx or .xls)
• Required columns: min_value, max_value, class_name, color_hex
• Color format: #RRGGBB or RRGGBB
• Values should cover full data range
      `.trim()
    
    case 'energy':
      return `
Upload energy infrastructure shapefile:
• Upload ALL files: .shp, .shx, .dbf, .prj
• Required attribute: designCapacity (numeric)
• Coordinate system: EPSG:4326 (WGS84)
• Naming: {country}_{energy_type}_power_plants.shp
      `.trim()
    
    default:
      return 'Please select a data type for upload instructions.'
  }
}

/**
 * Validate file before upload
 */
export function validateFile(file: File, expectedType: string): { valid: boolean; error?: string } {
  const maxSize = 2000 * 1024 * 1024 // 2000MB (2GB)
  
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 2000MB (2GB)' }
  }
  
  const extension = file.name.toLowerCase().split('.').pop()
  
  switch (expectedType) {
    case 'raster':
      if (!['tif', 'tiff'].includes(extension || '')) {
        return { valid: false, error: 'Please upload a TIF file' }
      }
      break
    
    case 'shapefile':
      if (extension !== 'shp') {
        return { valid: false, error: 'Please upload a shapefile (.shp)' }
      }
      break
    
    case 'classification':
      if (!['xlsx', 'xls'].includes(extension || '')) {
        return { valid: false, error: 'Please upload an Excel file' }
      }
      break
    
    default:
      return { valid: false, error: 'Unknown file type' }
  }
  
  return { valid: true }
}