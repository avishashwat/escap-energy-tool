/**
 * Simplified GeoServer-style processing with pure JavaScript
 * Processes shapefiles directly to GeoJSON without external dependencies
 */

const express = require('express')
const multer = require('multer')
const AdmZip = require('adm-zip')
const path = require('path')
const fs = require('fs').promises

const router = express.Router()

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../data/uploads'))
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + '.zip')
  }
})
const upload = multer({ storage: storage })

/**
 * Test endpoint to verify geoserver routes are working
 */
router.get('/', (req, res) => {
  res.json({
    message: 'Pure JavaScript GeoServer API is working',
    timestamp: new Date().toISOString(),
    mode: 'JavaScript shapefile processing (no external dependencies)',
    availableEndpoints: [
      'GET /',
      'POST /upload-shapefile',
      'GET /data/geojson/:filename'
    ]
  })
})

/**
 * Process shapefile to GeoJSON using pure JavaScript
 */
async function processShapefileToGeoJSON(zipBuffer) {
  // Dynamically import the shapefile library
  const shp = await import('shpjs')
  
  // Convert buffer to ArrayBuffer if needed
  const arrayBuffer = zipBuffer instanceof ArrayBuffer ? zipBuffer : zipBuffer.buffer
  
  // Parse the shapefile
  const geojson = await shp.parseZip(arrayBuffer)
  
  if (!geojson || !geojson.features || geojson.features.length === 0) {
    throw new Error('No features found in shapefile')
  }
  
  return geojson
}

/**
 * Get basic info about the GeoJSON
 */
function getGeoJSONInfo(geojson) {
  if (!geojson.features || !Array.isArray(geojson.features)) {
    throw new Error('Invalid GeoJSON: no features array')
  }
  
  // Calculate bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  
  geojson.features.forEach(feature => {
    if (feature.geometry && feature.geometry.coordinates) {
      const processCoords = (coords) => {
        if (Array.isArray(coords[0])) {
          coords.forEach(processCoords)
        } else {
          const [x, y] = coords
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x)
          minY = Math.min(minY, y)
          maxY = Math.max(maxY, y)
        }
      }
      processCoords(feature.geometry.coordinates)
    }
  })
  
  // Get attribute names from first feature
  const attributes = geojson.features.length > 0 && geojson.features[0].properties 
    ? Object.keys(geojson.features[0].properties)
    : []
  
  return {
    featureCount: geojson.features.length,
    boundingBox: [minX, minY, maxX, maxY],
    attributes,
    geojson
  }
}

/**
 * Upload and process shapefile - pure JavaScript version
 */
router.post('/upload-shapefile', upload.single('shapefile'), async (req, res) => {
  const startTime = Date.now()
  
  try {
    const { layerName, workspace, country, adminLevel } = req.body
    const shapefileZip = req.file

    if (!shapefileZip) {
      return res.status(400).json({ error: 'No shapefile uploaded' })
    }

    console.log(`📁 Processing shapefile: ${shapefileZip.filename}`)
    console.log(`🎯 Layer: ${layerName}, Country: ${country}, Admin Level: ${adminLevel}`)

    // Create processing directories
    const processedDir = path.join(__dirname, '../../data/processed')
    await fs.mkdir(processedDir, { recursive: true })

    try {
      // Read the uploaded zip file
      console.log('📦 Reading shapefile zip...')
      const zipBuffer = await fs.readFile(shapefileZip.path)
      
      // Process shapefile to GeoJSON using pure JavaScript
      console.log('🔄 Converting to GeoJSON with JavaScript...')
      const geojson = await processShapefileToGeoJSON(zipBuffer)
      
      // Get info about the processed data
      console.log('📊 Analyzing processed data...')
      const info = getGeoJSONInfo(geojson)
      
      // Save the GeoJSON file
      const geojsonPath = path.join(processedDir, `${layerName}.geojson`)
      await fs.writeFile(geojsonPath, JSON.stringify(info.geojson, null, 2))
      
      // Create a "tile URL" that points to our GeoJSON file
      const tileUrl = `/api/geoserver/data/geojson/${layerName}.geojson`
      
      const processingTime = Date.now() - startTime
      console.log(`✅ Backend processing complete in ${processingTime}ms`)
      console.log(`📊 Features: ${info.featureCount}, Attributes: ${info.attributes.join(', ')}`)
      
      // Clean up uploaded zip
      await fs.unlink(shapefileZip.path).catch(() => {})
      
      res.json({
        success: true,
        layerName,
        tileUrl,
        boundingBox: info.boundingBox,
        featureCount: info.featureCount,
        attributes: info.attributes,
        processingTime,
        geojsonPath, // Include path for direct access
        metadata: {
          country,
          adminLevel,
          workspace,
          processedAt: new Date().toISOString(),
          processingMethod: 'javascript'
        }
      })

    } catch (processingError) {
      // Clean up on error
      await fs.unlink(shapefileZip.path).catch(() => {})
      throw processingError
    }

  } catch (error) {
    console.error('Shapefile processing failed:', error)
    res.status(500).json({ 
      error: 'Shapefile processing failed',
      message: error.message,
      details: error.stack
    })
  }
})

/**
 * Serve processed GeoJSON files
 */
router.get('/data/geojson/:filename', async (req, res) => {
  try {
    const filename = req.params.filename
    const filePath = path.join(__dirname, '../../data/processed', filename)
    
    // Check if file exists
    await fs.access(filePath)
    
    // Set appropriate headers for GeoJSON
    res.setHeader('Content-Type', 'application/geo+json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    
    // Stream the file
    const data = await fs.readFile(filePath, 'utf8')
    res.send(data)
    
  } catch (error) {
    console.error('Error serving GeoJSON:', error)
    res.status(404).json({ error: 'GeoJSON file not found' })
  }
})

module.exports = router