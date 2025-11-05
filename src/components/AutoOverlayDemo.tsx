import React, { useState, useEffect, useCallback } from 'react'
import { Map, Upload, Layers, Zap } from 'lucide-react'
import { VectorTileMapComponent } from './VectorTileMapComponent'
import { HybridBoundaryManager } from './admin/HybridBoundaryManager'
import { SparkFallback } from '../utils/sparkFallback'

interface BoundaryFile {
  id: string
  name: string
  country: string
  adminLevel: number
  size: number
  attributes: string[]
  hoverAttribute: string
  uploadedAt: number
  filePath: string
  processingMethod: 'geoserver' | 'local'
  vectorTileUrl?: string
  maskLayer?: { // For inverse mask information
    success: boolean
    maskLayerName: string
    vectorTileUrl: string
    processingTime: number
  }
  geojsonData?: any
  dataKey?: string
  metadata?: {
    featureCount: number
    bounds: [number, number, number, number]
    projection: string
  }
}

const AutoOverlayDemo: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'upload' | 'map'>('upload')
  const [uploadedBoundaries, setUploadedBoundaries] = useState<BoundaryFile[]>([])
  const [mapRefreshKey, setMapRefreshKey] = useState(0)

  // Load uploaded boundaries on component mount
  useEffect(() => {
    loadUploadedBoundaries()
  }, [])

  const loadUploadedBoundaries = async () => {
    try {
      const savedFiles = await SparkFallback.get<BoundaryFile[]>('admin_boundary_files') || []
      setUploadedBoundaries(savedFiles)
      console.log('Loaded uploaded boundaries:', savedFiles.length)
    } catch (error) {
      console.error('Failed to load uploaded boundaries:', error)
    }
  }

  // Handle successful upload callback
  const handleUploadSuccess = useCallback(() => {
    console.log('Boundary upload successful - refreshing map...')
    loadUploadedBoundaries()
    setMapRefreshKey(prev => prev + 1) // Force map to refresh
    // Auto-switch to map view after successful upload
    setTimeout(() => {
      setActiveTab('map')
    }, 1000)
  }, [])

  // Convert uploaded boundaries to allMapOverlays format
  const createMapOverlays = useCallback(() => {
    if (uploadedBoundaries.length === 0) return {}
    
    const overlays: Record<string, any> = {}
    overlays['auto-overlay-map'] = {}
    
    uploadedBoundaries.forEach((boundary, index) => {
      overlays['auto-overlay-map'][`boundary-${index}`] = {
        type: 'boundary',
        name: boundary.name,
        geojsonData: boundary.geojsonData,
        vectorTileUrl: boundary.vectorTileUrl,
        metadata: boundary.metadata,
        hoverAttribute: boundary.hoverAttribute,
        processingMethod: boundary.processingMethod
      }
    })
    
    console.log('Created map overlays:', overlays)
    return overlays
  }, [uploadedBoundaries])

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-800">
              Auto-Overlay Demo: Upload → Instant Map Display
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              High Performance Mode
            </div>
          </div>
        </div>
        
        <p className="text-gray-600 mt-2">
          Upload a boundary shapefile and watch it automatically appear on the map with vector tile performance
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="px-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'upload'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Upload className="w-4 h-4 inline mr-2" />
              1. Upload Boundary
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'map'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Map className="w-4 h-4 inline mr-2" />
              2. View Auto-Overlaid Map
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'upload' ? (
          <div className="h-full p-6">
            <div className="max-w-4xl mx-auto">
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Layers className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-blue-900">How Auto-Overlay Works</h3>
                    <p className="text-blue-700 text-sm mt-1">
                      When you upload a shapefile, it's automatically processed into optimized vector tiles 
                      and instantly overlaid on the map. No manual layer management needed!
                    </p>
                  </div>
                </div>
              </div>
              
              <HybridBoundaryManager onStatsUpdate={handleUploadSuccess} />
              
              <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">Next Steps After Upload:</h4>
                <ol className="text-sm text-gray-600 space-y-1">
                  <li>1. ✅ Shapefile is processed to vector tiles (~15-30 seconds)</li>
                  <li>2. ✅ Layer is automatically registered in GeoServer</li>
                  <li>3. ✅ Map component receives notification and adds layer</li>
                  <li>4. ✅ Map auto-zooms to boundary extent</li>
                  <li>5. ✅ Vector tiles load in &lt;100ms for snappy performance</li>
                </ol>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full relative">
            {/* Always show the map component for debugging */}
            <VectorTileMapComponent 
              key={`vector-map-${mapRefreshKey}`}
              boundaries={uploadedBoundaries}
            />
            
            {uploadedBoundaries.length === 0 && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
                <div className="text-center p-8 bg-white rounded-lg">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-300 rounded-full flex items-center justify-center">
                    <Map className="w-8 h-8 text-gray-500" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">No Boundaries Uploaded</h3>
                  <p className="text-gray-500">Upload a boundary file to see vector tile overlay</p>
                  <p className="text-xs text-gray-400 mt-2">Map is loading behind this overlay...</p>
                </div>
              </div>
            )}
            
            {/* Map overlay info */}
            <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm">
              <h3 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                <Map className="w-4 h-4" />
                Live Vector Tile Map
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                This map automatically displays uploaded boundaries as optimized vector tiles.
              </p>
              
              {uploadedBoundaries.length > 0 && (
                <div className="mb-3 p-2 bg-green-50 rounded border border-green-200">
                  <div className="text-xs text-green-800 font-medium">
                    ✅ {uploadedBoundaries.length} Boundary{uploadedBoundaries.length > 1 ? 'ies' : ''} Loaded
                  </div>
                  {uploadedBoundaries.map((boundary, index) => (
                    <div key={boundary.id} className="text-xs text-green-700 mt-1">
                      • {boundary.name} ({boundary.metadata?.featureCount || 0} features)
                    </div>
                  ))}
                </div>
              )}
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Loading Time:</span>
                  <span className="text-green-600 font-medium">&lt;100ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tile Format:</span>
                  <span className="text-blue-600 font-medium">Vector (MVT)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Caching:</span>
                  <span className="text-purple-600 font-medium">7 days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Auto-Overlay:</span>
                  <span className={uploadedBoundaries.length > 0 ? "text-green-600" : "text-orange-600"}>
                    {uploadedBoundaries.length > 0 ? "✅ Active" : "⏳ Waiting"}
                  </span>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-gray-500">
                  {uploadedBoundaries.length > 0 
                    ? "Uploaded boundaries are displayed automatically!"
                    : "Upload a boundary file in the first tab to see it instantly appear here!"
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="bg-gray-800 text-white px-6 py-2 text-xs">
        <div className="flex justify-between items-center">
          <span>High-Performance Vector Tile Infrastructure • GeoServer + PostGIS + Nginx Caching</span>
          <span>Ready for automatic boundary overlay</span>
        </div>
      </div>
    </div>
  )
}

export default AutoOverlayDemo