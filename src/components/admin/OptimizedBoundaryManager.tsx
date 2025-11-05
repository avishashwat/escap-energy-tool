import React, { useState, useCallback, useRef } from 'react'
import { Upload, FileText, Trash2, Map, Download, Layers, AlertCircle, CheckCircle } from 'lucide-react'
import { boundaryTileService } from '../../services/boundaryTileService'
import { useBoundaryLayers } from '../../contexts/BoundaryLayerContext'
import { COUNTRIES_LIST } from '@/constants/countries'

interface BoundaryFile {
  id: string
  name: string
  type: 'boundary' | 'admin'
  country: string
  adminLevel: number
  uploadDate: string
  status: 'processing' | 'ready' | 'error'
  layerName: string
  mbtilesPath: string
  featureCount: number
  boundingBox: [number, number, number, number]
  processingTime?: number
}

interface UploadProgress {
  file: string
  progress: number
  status: 'uploading' | 'processing' | 'complete' | 'error'
  message: string
}

const OptimizedBoundaryManager: React.FC = () => {
  const [files, setFiles] = useState<BoundaryFile[]>([])
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([])
  const [selectedCountry, setSelectedCountry] = useState('')
  const [selectedAdminLevel, setSelectedAdminLevel] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const tileService = boundaryTileService
  const { addLayer, removeLayer, refreshLayers } = useBoundaryLayers()

  // Load existing files on component mount
  React.useEffect(() => {
    loadExistingFiles()
  }, [])

  const loadExistingFiles = async () => {
    try {
      const existingConfigs = tileService.getAllTileConfigs()
      setFiles(existingConfigs.map(config => ({
        id: config.id,
        name: config.name,
        type: 'boundary' as const,
        country: config.country,
        adminLevel: config.adminLevel,
        uploadDate: new Date().toISOString(), // We don't have upload date in config
        status: 'ready' as const,
        layerName: config.geoserverLayer,
        mbtilesPath: config.mbtilesPath,
        featureCount: 0, // We don't have feature count in config
        boundingBox: config.boundingBox
      })))
    } catch (error) {
      console.error('Failed to load existing files:', error)
    }
  }

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])
    
    for (const file of selectedFiles) {
      if (!file.name.endsWith('.zip')) {
        alert('Please upload shapefile as ZIP archive')
        continue
      }

      const progressItem: UploadProgress = {
        file: file.name,
        progress: 0,
        status: 'uploading',
        message: 'Preparing upload...'
      }
      setUploadProgress(prev => [...prev, progressItem])

      try {
        // Upload and process the shapefile to vector tiles
        const layerName = `${selectedCountry}_admin${selectedAdminLevel}_${Date.now()}`
        
        // Update progress
        setUploadProgress(prev => prev.map(p => 
          p.file === file.name ? { ...p, progress: 25, message: 'Uploading file...' } : p
        ))

        const formData = new FormData()
        formData.append('shapefile', file)
        formData.append('layerName', layerName)
        formData.append('workspace', 'climate_boundaries')
        formData.append('country', selectedCountry)
        formData.append('adminLevel', selectedAdminLevel.toString())

        // Upload via backend API
        const response = await fetch('/api/geoserver/upload-shapefile', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`)
        }

        const result = await response.json()

        // Update progress
        setUploadProgress(prev => prev.map(p => 
          p.file === file.name ? { ...p, progress: 75, message: 'Processing vector tiles...' } : p
        ))

        // Create boundary tile configuration using the boundary service
        const tileConfig = await tileService.processShapefileToTiles(
          file,
          selectedCountry,
          selectedAdminLevel,
          'name' // Default hover attribute
        )

        // Add to files list
        const newFile: BoundaryFile = {
          id: tileConfig.id,
          name: file.name,
          type: 'boundary',
          country: selectedCountry,
          adminLevel: selectedAdminLevel,
          uploadDate: new Date().toISOString(),
          status: 'ready',
          layerName,
          mbtilesPath: result.mbtilesPath,
          featureCount: result.featureCount,
          boundingBox: result.boundingBox,
          processingTime: result.processingTime
        }

        setFiles(prev => [...prev, newFile])

        // Notify boundary context about the new layer for automatic map overlay
        addLayer(tileConfig)

        // Complete progress
        setUploadProgress(prev => prev.map(p => 
          p.file === file.name ? { 
            ...p, 
            progress: 100, 
            status: 'complete', 
            message: `✅ Processed ${result.featureCount} features in ${(result.processingTime / 1000).toFixed(1)}s - Layer automatically added to map!` 
          } : p
        ))

        // Remove progress after 3 seconds
        setTimeout(() => {
          setUploadProgress(prev => prev.filter(p => p.file !== file.name))
        }, 3000)

      } catch (error) {
        console.error('File processing failed:', error)
        setUploadProgress(prev => prev.map(p => 
          p.file === file.name ? { 
            ...p, 
            status: 'error', 
            message: error.message || 'Processing failed' 
          } : p
        ))
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [selectedCountry, selectedAdminLevel])

  const handleDeleteFile = async (file: BoundaryFile) => {
    try {
      // Delete from backend
      const response = await fetch(`/api/geoserver/layers/${file.layerName}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete layer')
      }

      // Delete tile configuration
      await tileService.deleteTileConfig(file.id)

      // Notify boundary context about layer removal
      removeLayer(file.id)

      // Remove from files list
      setFiles(prev => prev.filter(f => f.id !== file.id))
    } catch (error) {
      console.error('Failed to delete file:', error)
      alert('Failed to delete file: ' + error.message)
    }
  }

  const handlePreviewBoundary = async (file: BoundaryFile) => {
    try {
      // Get the tile config from the service
      const allConfigs = tileService.getAllTileConfigs()
      const tileConfig = allConfigs.find(config => config.id === file.id)
      
      if (!tileConfig) {
        throw new Error('Tile configuration not found')
      }
      
      // Use the tile URL from the config
      const tileUrl = tileConfig.tileUrl
      
      // You would integrate this with your map component
      // For now, just show the tile URL
      const previewWindow = window.open('', '_blank')
      if (previewWindow) {
        previewWindow.document.write(`
          <html>
            <head><title>Boundary Preview - ${file.name}</title></head>
            <body>
              <h2>Vector Tile Layer: ${file.layerName}</h2>
              <p><strong>Tile URL:</strong> ${tileUrl}</p>
              <p><strong>Features:</strong> ${file.featureCount}</p>
              <p><strong>Bounding Box:</strong> [${file.boundingBox.join(', ')}]</p>
              <div id="map" style="height: 500px; width: 100%;"></div>
              <script>
                // Here you would initialize a map with the vector tiles
                console.log('Tile URL:', '${tileUrl}')
              </script>
            </body>
          </html>
        `)
      }
    } catch (error) {
      console.error('Failed to preview boundary:', error)
      alert('Failed to generate preview: ' + error.message)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
          <Map className="w-6 h-6" />
          High-Performance Boundary Manager
        </h2>
        <p className="text-gray-600">
          Upload shapefiles and automatically convert to optimized vector tiles for fast loading
        </p>
      </div>

      {/* Upload Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Country
          </label>
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Country</option>
            {COUNTRIES_LIST.map(country => (
              <option key={country.id} value={country.id}>{country.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Administrative Level
          </label>
          <select
            value={selectedAdminLevel}
            onChange={(e) => setSelectedAdminLevel(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={0}>National (Level 0)</option>
            <option value={1}>Province/State (Level 1)</option>
            <option value={2}>District/County (Level 2)</option>
            <option value={3}>Sub-district (Level 3)</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!selectedCountry}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload Shapefile
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className="mb-6 space-y-2">
          <h3 className="text-lg font-semibold text-gray-800">Processing Files</h3>
          {uploadProgress.map((progress, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{progress.file}</span>
                <span className="text-sm text-gray-500">{progress.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    progress.status === 'error' ? 'bg-red-500' : 
                    progress.status === 'complete' ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${progress.progress}%` }}
                ></div>
              </div>
              <div className="flex items-center gap-2">
                {progress.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                {progress.status === 'complete' && <CheckCircle className="w-4 h-4 text-green-500" />}
                <span className="text-sm text-gray-600">{progress.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Files List */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Layers className="w-5 h-5" />
          Vector Tile Layers ({files.length})
        </h3>
        
        {files.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No boundary files uploaded yet</p>
            <p className="text-sm">Upload a shapefile to get started</p>
          </div>
        ) : (
          files.map((file) => (
            <div key={file.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <div>
                      <h4 className="font-medium text-gray-800">{file.name}</h4>
                      <div className="text-sm text-gray-600 flex items-center gap-4">
                        <span>{file.country} • Admin Level {file.adminLevel}</span>
                        <span>{file.featureCount} features</span>
                        {file.processingTime && (
                          <span>Processed in {(file.processingTime / 1000).toFixed(1)}s</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePreviewBoundary(file)}
                    className="px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 flex items-center gap-1"
                  >
                    <Map className="w-4 h-4" />
                    Preview
                  </button>
                  
                  <button
                    onClick={() => handleDeleteFile(file)}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
              
              <div className="mt-3 text-xs text-gray-500">
                <div>Layer: {file.layerName}</div>
                <div>Uploaded: {new Date(file.uploadDate).toLocaleString()}</div>
                <div>Bounding Box: [{file.boundingBox.map(n => n.toFixed(4)).join(', ')}]</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default OptimizedBoundaryManager