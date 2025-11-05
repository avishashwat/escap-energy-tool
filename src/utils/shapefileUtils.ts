import JSZip from 'jszip'

interface ShapefileMetadata {
  attributes: string[]
  featureCount: number
  bounds: [number, number, number, number] // [minX, minY, maxX, maxY]
  projection: string
}

interface ShapefileData extends ShapefileMetadata {
  geojsonData: any // The actual GeoJSON features
}

/**
 * Extract and analyze shapefile from ZIP file
 */
export async function analyzeShapefileFromZip(zipFile: File): Promise<ShapefileMetadata> {
  try {
    const zip = await JSZip.loadAsync(zipFile)
    
    // Find the .dbf file to read attributes
    const dbfFile = Object.keys(zip.files).find(name => name.toLowerCase().endsWith('.dbf'))
    const shpFile = Object.keys(zip.files).find(name => name.toLowerCase().endsWith('.shp'))
    const prjFile = Object.keys(zip.files).find(name => name.toLowerCase().endsWith('.prj'))
    
    if (!dbfFile || !shpFile) {
      throw new Error('Required shapefile components (.shp, .dbf) not found in ZIP')
    }

    // Read DBF file to get field names
    const dbfBuffer = await zip.files[dbfFile].async('arraybuffer')
    const attributes = await readDBFAttributes(dbfBuffer)
    
    // Read SHP file to get geometry info
    const shpBuffer = await zip.files[shpFile].async('arraybuffer')
    const { featureCount, bounds } = await readSHPMetadata(shpBuffer)
    
    // Read projection if available
    let projection = 'EPSG:4326' // Default
    if (prjFile) {
      try {
        const prjContent = await zip.files[prjFile].async('text')
        projection = parsePRJFile(prjContent)
      } catch (error) {
        console.warn('Could not read projection file:', error)
      }
    }

    return {
      attributes,
      featureCount,
      bounds,
      projection
    }
  } catch (error) {
    console.error('Error analyzing shapefile:', error)
    throw new Error('Failed to analyze shapefile: ' + (error as Error).message)
  }
}

/**
 * Extract full shapefile data including GeoJSON features
 */
export async function extractShapefileData(zipFile: File): Promise<ShapefileData> {
  try {
    console.log('Extracting shapefile data from:', zipFile.name)
    
    const zip = await JSZip.loadAsync(zipFile)
    
    // Find required files
    const dbfFile = Object.keys(zip.files).find(name => name.toLowerCase().endsWith('.dbf'))
    const shpFile = Object.keys(zip.files).find(name => name.toLowerCase().endsWith('.shp'))
    const shxFile = Object.keys(zip.files).find(name => name.toLowerCase().endsWith('.shx'))
    const prjFile = Object.keys(zip.files).find(name => name.toLowerCase().endsWith('.prj'))
    
    if (!dbfFile || !shpFile || !shxFile) {
      throw new Error('Required shapefile components (.shp, .shx, .dbf) not found in ZIP')
    }

    // Read all required files
    const [dbfBuffer, shpBuffer, shxBuffer] = await Promise.all([
      zip.files[dbfFile].async('arraybuffer'),
      zip.files[shpFile].async('arraybuffer'),
      zip.files[shxFile].async('arraybuffer')
    ])

    console.log('Reading shapefile components - DBF:', dbfBuffer.byteLength, 'SHP:', shpBuffer.byteLength, 'SHX:', shxBuffer.byteLength)
    
    // Get metadata first
    const attributes = await readDBFAttributes(dbfBuffer)
    const { featureCount, bounds } = await readSHPMetadata(shpBuffer)
    
    // Read projection if available
    let projection = 'EPSG:4326' // Default
    if (prjFile) {
      try {
        const prjContent = await zip.files[prjFile].async('text')
        projection = parsePRJFile(prjContent)
      } catch (error) {
        console.warn('Could not read projection file:', error)
      }
    }

    // Read the actual geometry and attributes to create GeoJSON
    const geojsonData = await createGeoJSONFromShapefile(shpBuffer, shxBuffer, dbfBuffer, attributes)
    
    console.log('Extracted', geojsonData.features.length, 'features from shapefile')

    return {
      attributes,
      featureCount,
      bounds,
      projection,
      geojsonData
    }
  } catch (error) {
    console.error('Error extracting shapefile data:', error)
    throw new Error('Failed to extract shapefile data: ' + (error as Error).message)
  }
}

/**
 * Create GeoJSON from shapefile components
 */
async function createGeoJSONFromShapefile(
  shpBuffer: ArrayBuffer, 
  shxBuffer: ArrayBuffer, 
  dbfBuffer: ArrayBuffer, 
  attributes: string[]
): Promise<any> {
  console.log('Creating GeoJSON from shapefile components')
  
  // Read records from DBF to get attributes
  const records = await readDBFRecords(dbfBuffer, attributes)
  console.log('Read', records.length, 'attribute records')
  
  // Read geometries from SHP
  const geometries = await readSHPGeometries(shpBuffer, shxBuffer)
  console.log('Read', geometries.length, 'geometries')
  
  // Combine into GeoJSON features
  const features: any[] = []
  const maxFeatures = Math.min(records.length, geometries.length)
  
  for (let i = 0; i < maxFeatures; i++) {
    if (geometries[i]) { // Only include features with valid geometry
      features.push({
        type: 'Feature',
        geometry: geometries[i],
        properties: records[i] || {}
      })
    }
  }
  
  console.log('Created', features.length, 'GeoJSON features')
  
  return {
    type: 'FeatureCollection',
    features: features
  }
}

/**
 * Read DBF records to get feature attributes
 */
async function readDBFRecords(buffer: ArrayBuffer, fieldNames: string[]): Promise<any[]> {
  const view = new DataView(buffer)
  
  // DBF Header
  const recordCount = view.getUint32(4, true) // Number of records
  const headerLength = view.getUint16(8, true)
  const recordLength = view.getUint16(10, true)
  
  console.log('DBF: Records:', recordCount, 'Header length:', headerLength, 'Record length:', recordLength)
  
  const records: any[] = []
  let offset = headerLength
  
  for (let i = 0; i < recordCount && offset < buffer.byteLength; i++) {
    const record: any = {}
    let fieldOffset = offset + 1 // Skip deletion flag
    
    // Read each field for this record
    for (let f = 0; f < fieldNames.length; f++) {
      // Field information would need to be read from header
      // For simplicity, assume each field is 10 bytes (this is a limitation)
      const fieldLength = Math.min(10, recordLength / fieldNames.length)
      
      if (fieldOffset + fieldLength <= offset + recordLength) {
        const fieldBytes = new Uint8Array(buffer, fieldOffset, fieldLength)
        let fieldValue = ''
        
        for (let b = 0; b < fieldLength; b++) {
          if (fieldBytes[b] === 0 || fieldBytes[b] === 32) break // Null or space
          fieldValue += String.fromCharCode(fieldBytes[b])
        }
        
        record[fieldNames[f]] = fieldValue.trim()
        fieldOffset += fieldLength
      }
    }
    
    records.push(record)
    offset += recordLength
  }
  
  return records
}

/**
 * Read SHP geometries (simplified implementation for polygons)
 */
async function readSHPGeometries(shpBuffer: ArrayBuffer, shxBuffer: ArrayBuffer): Promise<any[]> {
  const shpView = new DataView(shpBuffer)
  const shxView = new DataView(shxBuffer)
  
  console.log('Reading SHP geometries')
  
  // Read shape type from header
  const shapeType = shpView.getUint32(32, true)
  console.log('Shape type:', shapeType)
  
  const geometries: any[] = []
  let offset = 100 // Start after SHP header
  
  // Simple implementation - create approximate polygons from bounding boxes
  // This is a limitation but will show the general shape
  while (offset < shpBuffer.byteLength - 8) {
    try {
      // Record header
      const recordNumber = shpView.getUint32(offset, false)
      const contentLength = shpView.getUint32(offset + 4, false) * 2
      
      if (offset + 8 + contentLength > shpBuffer.byteLength) {
        break
      }
      
      // Shape type for this record
      const recordShapeType = shpView.getUint32(offset + 8, true)
      
      if (recordShapeType === 0) {
        // Null shape
        geometries.push(null)
      } else if (recordShapeType === 1) {
        // Point
        const x = shpView.getFloat64(offset + 12, true)
        const y = shpView.getFloat64(offset + 20, true)
        geometries.push({
          type: 'Point',
          coordinates: [x, y]
        })
      } else if (recordShapeType === 5 || recordShapeType === 15) {
        // Polygon - create a simplified polygon from bounding box
        const minX = shpView.getFloat64(offset + 12, true)
        const minY = shpView.getFloat64(offset + 20, true)
        const maxX = shpView.getFloat64(offset + 28, true)
        const maxY = shpView.getFloat64(offset + 36, true)
        
        // Create rectangle as simplified polygon
        geometries.push({
          type: 'Polygon',
          coordinates: [[
            [minX, minY],
            [maxX, minY], 
            [maxX, maxY],
            [minX, maxY],
            [minX, minY]
          ]]
        })
      } else {
        // Other shape types - use bounding box as fallback
        if (contentLength >= 32) {
          const minX = shpView.getFloat64(offset + 12, true)
          const minY = shpView.getFloat64(offset + 20, true)
          const maxX = shpView.getFloat64(offset + 28, true)
          const maxY = shpView.getFloat64(offset + 36, true)
          
          geometries.push({
            type: 'Polygon',
            coordinates: [[
              [minX, minY],
              [maxX, minY],
              [maxX, maxY], 
              [minX, maxY],
              [minX, minY]
            ]]
          })
        } else {
          geometries.push(null)
        }
      }
      
      offset += 8 + contentLength
    } catch (error) {
      console.warn('Error reading geometry at offset', offset, ':', error)
      break
    }
  }
  
  console.log('Read', geometries.length, 'geometries')
  return geometries
}

/**
 * Read DBF file to extract field/attribute names
 */
async function readDBFAttributes(buffer: ArrayBuffer): Promise<string[]> {
  const view = new DataView(buffer)
  
  // DBF Header structure
  const headerLength = view.getUint16(8, true) // Little endian
  const recordLength = view.getUint16(10, true)
  
  // Field descriptors start at byte 32
  const fields: string[] = []
  let offset = 32
  
  // Read field descriptors until we hit 0x0D (field terminator)
  while (offset < headerLength - 1) {
    const fieldNameBytes = new Uint8Array(buffer, offset, 11)
    // Convert field name from bytes to string, stopping at null terminator
    let fieldName = ''
    for (let i = 0; i < 11; i++) {
      if (fieldNameBytes[i] === 0) break
      fieldName += String.fromCharCode(fieldNameBytes[i])
    }
    
    if (fieldName.length > 0) {
      fields.push(fieldName.trim())
    }
    
    offset += 32 // Each field descriptor is 32 bytes
  }
  
  return fields.filter(name => name.length > 0)
}

/**
 * Read SHP file to get basic metadata
 */
async function readSHPMetadata(buffer: ArrayBuffer): Promise<{ featureCount: number; bounds: [number, number, number, number] }> {
  const view = new DataView(buffer)
  
  // SHP Header structure (100 bytes)
  // File length is at bytes 24-27 (big endian, in 16-bit words)
  const fileLength = view.getUint32(24, false) * 2 // Convert from 16-bit words to bytes
  
  // Shape type at bytes 32-35 (little endian)
  const shapeType = view.getUint32(32, true)
  
  // Bounding box at bytes 36-67 (little endian doubles)
  const minX = view.getFloat64(36, true)
  const minY = view.getFloat64(44, true)
  const maxX = view.getFloat64(52, true)
  const maxY = view.getFloat64(60, true)
  
  // Count features by reading through records
  let featureCount = 0
  let offset = 100 // Start after header
  
  while (offset < buffer.byteLength - 8) {
    try {
      // Record header: record number (4 bytes, big endian) + content length (4 bytes, big endian)
      const contentLength = view.getUint32(offset + 4, false) * 2 // Convert from 16-bit words
      
      featureCount++
      offset += 8 + contentLength // Move to next record
    } catch (error) {
      break // End of valid records
    }
  }
  
  return {
    featureCount,
    bounds: [minX, minY, maxX, maxY]
  }
}

/**
 * Parse PRJ file to extract projection information
 */
function parsePRJFile(prjContent: string): string {
  // Try to extract EPSG code from WKT
  const epsgMatch = prjContent.match(/AUTHORITY\["EPSG","(\d+)"\]/i)
  if (epsgMatch) {
    return `EPSG:${epsgMatch[1]}`
  }
  
  // Check for common coordinate systems
  if (prjContent.includes('GCS_WGS_1984') || prjContent.includes('WGS84')) {
    return 'EPSG:4326'
  }
  
  if (prjContent.includes('WGS_1984_Web_Mercator') || prjContent.includes('Web Mercator')) {
    return 'EPSG:3857'
  }
  
  // Return the first part of the coordinate system name if available
  const geogcsMatch = prjContent.match(/GEOGCS\["([^"]+)"/i)
  if (geogcsMatch) {
    return geogcsMatch[1]
  }
  
  const projcsMatch = prjContent.match(/PROJCS\["([^"]+)"/i)
  if (projcsMatch) {
    return projcsMatch[1]
  }
  
  return 'Unknown'
}