const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import routes
const geoserverRoutes = require('./routes/geoserver.js'); // Restore full GeoServer infrastructure  
const simpleUploadRoutes = require('./routes/simple-upload.js');

const app = express();
const PORT = process.env.PORT || 5000;

// Dynamic CORS origins - support both development and production
const allowedOrigins = [
  'http://localhost:3000', 
  'http://127.0.0.1:3000',
  'http://localhost:3001', 
  'http://127.0.0.1:3001',
  'http://localhost:3002', 
  'http://127.0.0.1:3002',
  'http://localhost:4000', 
  'http://localhost:5173',
  process.env.FRONTEND_URL, // Production frontend URL from env
  'https://escap-tools.thinkbluedata.org' // Production domain
].filter(Boolean); // Remove undefined values

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// ⚡ CRITICAL: Increase request timeout for large file uploads (default is 120s)
app.use((req, res, next) => {
  req.setTimeout(600000); // 10 minutes for upload processing
  next();
});

app.use(express.json({ limit: '1gb' })); // Support 1GB JSON bodies
app.use(express.urlencoded({ extended: true, limit: '1gb' })); // Support 1GB form data

// Create upload directories if they don't exist
const uploadDir = path.join(__dirname, '../data/uploads');
const processedDir = path.join(__dirname, '../data/processed');
const boundariesDir = path.join(__dirname, '../data/boundaries');

[uploadDir, processedDir, boundariesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// File upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 1024 // 1GB limit (increased from 100MB)
  },
  fileFilter: (req, file, cb) => {
    // Allow shapefile components and zip files
    const allowedMimes = [
      'application/zip',
      'application/x-zip-compressed',
      'application/octet-stream',
      'text/plain' // for .prj files
    ];
    
    const allowedExtensions = ['.shp', '.shx', '.dbf', '.prj', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only shapefiles and zip files are allowed.'));
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    port: PORT,
    message: 'Node.js backend server is running'
  });
});

// Root endpoint - serves basic info
app.get('/', (req, res) => {
  res.json({
    name: 'Agriculture and Energy Tool API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    port: PORT,
    endpoints: {
      health: '/health',
      api: '/api',
      geoserver: '/api/geoserver/*',
      simpleUpload: '/api/simple-upload/*',
      upload: '/api/upload'
    },
    message: 'Backend server is running successfully'
  });
});

// Basic API info
app.get('/api', (req, res) => {
  res.json({
    message: 'Agriculture and Energy Tool API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      geoserver: '/api/geoserver/*',
      upload: '/api/upload'
    }
  });
});

// File upload endpoint
app.post('/api/upload', upload.array('files'), (req, res) => {
  try {
    // Set individual request timeout for this endpoint
    req.setTimeout(600000); // 10 minutes
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = req.files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype
    }));

    res.json({
      message: 'Files uploaded successfully',
      files: uploadedFiles,
      count: uploadedFiles.length
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed: ' + error.message });
  }
});

// Use geoserver routes
app.use('/api/geoserver', geoserverRoutes);

// Use simple upload routes for testing
app.use('/api/simple-upload', simpleUploadRoutes);

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 100MB.' });
    }
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.path,
    method: req.method
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📁 Upload directory: ${uploadDir}`);
  console.log(`🗃️  Processed directory: ${processedDir}`);
  console.log(`🔗 API info: http://localhost:${PORT}/api`);
  console.log(`⏱️  Request timeout: 10 minutes (for large file uploads)`);
});

// ⚡ Set socket timeout for long-running requests
server.setTimeout(600000); // 10 minutes

// Graceful shutdown handlers - only shutdown on explicit signals, not crashes
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

// Remove SIGINT handler to prevent accidental shutdown during development
// This was causing the backend to shut down during request processing
// process.on('SIGINT', () => {
//   console.log('SIGINT received, shutting down gracefully');
//   process.exit(0);
// });

// Handle uncaught exceptions without shutting down
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Server continuing to run...');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('Server continuing to run...');
});