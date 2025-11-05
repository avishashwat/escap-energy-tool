/**
 * Simple Upload API - Basic file upload without GeoServer integration
 * For testing API connectivity and basic file handling
 */

const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs').promises

const router = express.Router()

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../data/uploads')
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now()
    const originalName = file.originalname
    cb(null, `${timestamp}-${originalName}`)
  }
})

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow shapefile components and zip files
    const allowedMimes = [
      'application/zip',
      'application/x-zip-compressed',
      'application/octet-stream',
      'text/plain' // for .prj files
    ]
    
    const allowedExtensions = ['.shp', '.shx', '.dbf', '.prj', '.zip']
    const ext = path.extname(file.originalname).toLowerCase()
    
    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only shapefiles and zip files are allowed.'))
    }
  }
})

/**
 * Test endpoint
 */
router.get('/', (req, res) => {
  res.json({
    message: 'Simple Upload API is working',
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'GET /',
      'POST /upload'
    ]
  })
})

/**
 * Simple file upload endpoint
 */
router.post('/upload', upload.single('shapefile'), async (req, res) => {
  try {
    console.log('Upload request received:', {
      file: req.file ? req.file.originalname : 'No file',
      body: req.body
    })

    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      })
    }

    const { layerName, workspace, country, adminLevel } = req.body
    const uploadedFile = req.file

    // Basic file info
    const fileInfo = {
      originalName: uploadedFile.originalname,
      filename: uploadedFile.filename,
      path: uploadedFile.path,
      size: uploadedFile.size,
      mimetype: uploadedFile.mimetype
    }

    console.log('File uploaded successfully:', fileInfo)

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Return success response
    res.json({
      success: true,
      message: 'File uploaded successfully',
      file: fileInfo,
      metadata: {
        layerName: layerName || 'default-layer',
        workspace: workspace || 'default',
        country: country || 'unknown',
        adminLevel: adminLevel || '1'
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ 
      success: false,
      error: 'Upload failed: ' + error.message 
    })
  }
})

module.exports = router