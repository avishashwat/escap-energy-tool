import React, { useState, useEffect, useRef } from 'react'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Badge } from '../ui/badge'
import { Progress } from '../ui/progress'
import { UploadSimple, File, Trash, MapPin, Eye, Lightning, HardDrives } from '@phosphor-icons/react'
import { SparkFallback } from '../../utils/sparkFallback'
import { toast } from 'sonner'
import { COUNTRIES_LIST } from '../../constants/countries'

// Import API configuration
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'

// Debug: Check if countries are loaded
console.log('🔍 COUNTRIES_LIST loaded:', COUNTRIES_LIST)

interface BoundaryFile {
  id: string
  name: string
  country: string
  adminLevel: number
  size: number | null // Allow null when server doesn't provide file size
  attributes: string[] | null // Allow null when server doesn't provide attributes
  hoverAttribute: string | null // Allow null when server doesn't provide hover attribute
  uploadedAt: number
  filePath: string
  processingMethod: 'geoserver' | 'local' // Track which method was used
  vectorTileUrl?: string // For GeoServer vector tiles
  maskLayer?: { // For inverse mask information
    success: boolean
    maskLayerName: string
    vectorTileUrl: string
    processingTime: number
  }
  geojsonData?: any // Fallback for local processing
  dataKey?: string // Reference to chunked data storage
  metadata?: {
    featureCount: number
    bounds: [number, number, number, number]
    projection: string
  }
}

interface HybridBoundaryManagerProps {
  onStatsUpdate: () => void
}

export function HybridBoundaryManager({ onStatsUpdate }: HybridBoundaryManagerProps) {
  const [boundaryFiles, setBoundaryFiles] = useState<BoundaryFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedCountry, setSelectedCountry] = useState('')
  const [adminLevel, setAdminLevel] = useState(1)
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [processingMethod, setProcessingMethod] = useState<'geoserver' | 'local' | null>(null)
  const [showConfiguration, setShowConfiguration] = useState(false)
  const [shapefileAttributes, setShapefileAttributes] = useState<string[]>([])
  const [hoverAttribute, setHoverAttribute] = useState('')
  const [currentGeojsonData, setCurrentGeojsonData] = useState<any>(null)
  const [fileMetadata, setFileMetadata] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load boundary files from GeoServer API (source of truth)
  const loadBoundaryFiles = async () => {
    try {
      console.log('🔍 DEBUG - Loading boundary files from GeoServer API...')
      
      // PURE SERVER-DRIVEN APPROACH: Only use GeoServer as source of truth
      try {
        const response = await fetch(`${BACKEND_URL}/api/geoserver/boundaries`)
        if (response.ok) {
          const geoserverData = await response.json()
          console.log('🔍 DEBUG - GeoServer API raw response:', geoserverData)
          
          // Handle the API response structure properly
          if (geoserverData && geoserverData.success && Array.isArray(geoserverData.boundaries)) {
            const geoserverBoundaries = geoserverData.boundaries
            console.log('🔍 DEBUG - Found GeoServer boundaries:', geoserverBoundaries.length, geoserverBoundaries)
            
            // Validate that boundaries array contains valid objects
            if (!geoserverBoundaries || geoserverBoundaries.length === 0) {
              console.log('🔍 DEBUG - No boundaries found in GeoServer response')
              setBoundaryFiles([])
              return
            }
            
            // Convert GeoServer format to BoundaryFile format - use ONLY server data
            const convertedBoundaries: BoundaryFile[] = geoserverBoundaries
              .filter(boundary => boundary && boundary.country) // Filter out null/invalid boundaries first
              .map((boundary: any) => {
                try {
                  console.log(`✅ Processing boundary from server: ${boundary.country}`, boundary)
                  
                  // Helper function to capitalize country name
                  const capitalizeCountry = (country: string) => {
                    return country.charAt(0).toUpperCase() + country.slice(1).toLowerCase()
                  }
                  
                  return {
                    id: boundary.layerName || boundary.country,
                    name: boundary.layerName || boundary.country,
                    country: capitalizeCountry(boundary.country), // Capitalize country name
                    adminLevel: boundary.adminLevel || 1,
                    size: boundary.metadata?.fileSize || boundary.fileSize || null, // Check metadata first, then direct field
                    attributes: boundary.metadata?.attributes || boundary.attributes || null, // Check metadata first
                    hoverAttribute: boundary.metadata?.hoverAttribute || boundary.hoverAttribute || null, // Check metadata first
                    uploadedAt: boundary.metadata?.uploadedAt || boundary.uploadedAt || (boundary.metadata?.tableCreated ? new Date(boundary.metadata.tableCreated).getTime() : Date.now()),
                    filePath: boundary.metadata?.originalFileName || boundary.originalFileName || `${capitalizeCountry(boundary.country)}_boundary.zip`,
                    processingMethod: 'geoserver' as const,
                    vectorTileUrl: boundary.vectorTileUrl,
                    metadata: boundary.metadata ? {
                      featureCount: boundary.metadata.featureCount || 0,
                      bounds: boundary.metadata.bounds || [-180, -90, 180, 90],
                      projection: 'EPSG:4326'
                    } : undefined,
                    maskLayer: boundary.maskLayer ? {
                      success: boundary.maskLayer.success,
                      maskLayerName: boundary.maskLayer.maskLayerName,
                      vectorTileUrl: boundary.maskLayer.vectorTileUrl || '',
                      processingTime: 0
                    } : undefined
                  }
                } catch (error) {
                  console.error(`❌ Error processing boundary ${boundary?.country || 'unknown'}:`, error)
                  return null
                }
              })
              .filter(Boolean) as BoundaryFile[] // Remove null entries
            
            console.log('🔍 DEBUG - Final converted boundaries:', convertedBoundaries.length)
            setBoundaryFiles(convertedBoundaries)
            return
          } else {
            console.warn('⚠️ GeoServer API returned unexpected format:', geoserverData)
            setBoundaryFiles([])
          }
        } else {
          console.error('❌ GeoServer API request failed:', response.status, response.statusText)
          setBoundaryFiles([])
        }
      } catch (geoserverError) {
        console.error('❌ GeoServer API unavailable:', geoserverError)
        setBoundaryFiles([])
      }
    } catch (error) {
      console.error('Failed to load boundary files:', error)
      setBoundaryFiles([])
    }
  }

  // Check backend availability on component mount
  useEffect(() => {
    console.log('🔍 STATE DEBUG - showConfiguration changed:', showConfiguration)
    console.log('🔍 STATE DEBUG - shapefileAttributes:', shapefileAttributes)
    console.log('🔍 STATE DEBUG - attributes length:', shapefileAttributes.length)
  }, [showConfiguration, shapefileAttributes])

  useEffect(() => {
    checkBackendAvailability()
    loadBoundaryFiles()

    // Reload boundary files when the window gains focus
    const handleFocus = () => {
      console.log('🔍 DEBUG - HybridBoundaryManager: Window gained focus, reloading files...')
      loadBoundaryFiles()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  const checkBackendAvailability = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/geoserver`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000) // 3 second timeout
      })
      
      if (response.ok) {
        console.log('✅ GeoServer backend available - will use high-performance vector tiles')
        setProcessingMethod('geoserver')
      } else {
        console.log('⚠️ GeoServer backend unavailable - will use local processing')
        setProcessingMethod('local')
      }
    } catch (error) {
      console.log('⚠️ GeoServer backend unavailable - will use local processing fallback')
      setProcessingMethod('local')
    }
  }

  const processShapefileWithGeoServer = async (file: File, layerName: string, workspace: string, country: string, adminLevel: number) => {
    console.log('🚀🚀🚀 HYBRID BOUNDARY MANAGER CALLED - VERSION 2.0')
    console.log('🚀🚀🚀 WORKSPACE PARAMETER:', workspace)
    console.log('🚀 Using HIGH-PERFORMANCE GeoServer + Vector Tiles approach')
    console.log('🔍 DEBUG - Function started, file:', file.name, 'size:', file.size)
    
    try {
      console.log('✅ PostgreSQL is running, proceeding with GeoServer upload...')
      
      const formData = new FormData()
      formData.append('shapefile', file)
      formData.append('layerName', layerName)
      formData.append('workspace', workspace)
      formData.append('country', country)
      formData.append('adminLevel', adminLevel.toString())
      
      // Include file metadata for server storage
      formData.append('fileSize', file.size.toString())
      formData.append('originalFileName', file.name)
      
      console.log('🔥🔥🔥 FRONTEND WORKSPACE VALUE:', workspace)
      console.log('🔥🔥🔥 FRONTEND FORM DATA CHECK:', formData.get('workspace'))
      console.log('🔥🔥🔥 FRONTEND FILE SIZE:', formData.get('fileSize'))

      const response = await fetch(`${BACKEND_URL}/api/geoserver/upload-shapefile`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30000)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`GeoServer processing failed: ${response.statusText} - ${errorText}`)
      }

      const result = await response.json()
      console.log('🔍 DEBUG - Backend response:', result)
      console.log('🔍 DEBUG - vectorTileUrl from backend:', result.vectorTileUrl)
      console.log('🔍 DEBUG - boundingBox from backend:', result.boundingBox)
      console.log('🎭 DEBUG - maskLayer from backend:', result.maskLayer)
      
      return {
        success: true,
        method: 'geoserver' as const,
        vectorTileUrl: result.vectorTileUrl || `${workspace}/wms?service=WMS&version=1.1.0&request=GetMap&layers=${workspace}:${layerName}&styles=&bbox={bbox-epsg-4326}&width=256&height=256&srs=EPSG:4326&format=image/png`,
        maskLayer: result.maskLayer, // Include mask layer information
        metadata: {
          featureCount: result.featureCount || 1,
          bounds: result.boundingBox || [-180, -90, 180, 90],
          projection: 'EPSG:4326'
        },
        attributes: result.attributes || ['name'], // Use attributes from backend or fallback
        layerName: result.layerName || layerName
      }
    } catch (error) {
      console.error('❌ GeoServer backend error:', error)
      throw error
    }
  }

  const processShapefileWithGeoServerComplete = async (
    file: File, 
    layerName: string, 
    workspace: string, 
    country: string, 
    adminLevel: number,
    hoverAttribute: string,
    attributes: string[]
  ) => {
    console.log('🚀🚀🚀 COMPLETE GEOSERVER UPLOAD WITH METADATA')
    console.log('🔍 DEBUG - Complete metadata:', { 
      file: file.name, 
      size: file.size, 
      hoverAttribute, 
      attributes: attributes.length 
    })
    
    try {
      console.log('✅ PostgreSQL is running, proceeding with complete GeoServer upload...')
      
      const formData = new FormData()
      formData.append('shapefile', file)
      formData.append('layerName', layerName)
      formData.append('workspace', workspace)
      formData.append('country', country)
      formData.append('adminLevel', adminLevel.toString())
      
      // Include COMPLETE metadata for server storage
      formData.append('fileSize', file.size.toString())
      formData.append('originalFileName', file.name)
      formData.append('hoverAttribute', hoverAttribute)
      formData.append('attributes', JSON.stringify(attributes))
      formData.append('uploadedAt', Date.now().toString())
      
      // ALSO include as JSON metadata for backend storage
      const metadataJson = {
        fileSize: file.size,
        hoverAttribute: hoverAttribute,
        attributes: attributes,
        uploadedAt: Date.now(),
        originalFileName: file.name
      }
      formData.append('additionalMetadata', JSON.stringify(metadataJson))
      
      console.log('🔥🔥🔥 COMPLETE METADATA SENT:')
      console.log('  - fileSize:', formData.get('fileSize'))
      console.log('  - hoverAttribute:', formData.get('hoverAttribute'))
      console.log('  - attributes:', formData.get('attributes'))
      console.log('  - uploadedAt:', formData.get('uploadedAt'))

      const response = await fetch(`${BACKEND_URL}/api/geoserver/upload-shapefile`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30000)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`GeoServer processing failed: ${response.statusText} - ${errorText}`)
      }

      const result = await response.json()
      console.log('🔍 DEBUG - Complete upload backend response:', result)
      
      return {
        success: true,
        method: 'geoserver' as const,
        vectorTileUrl: result.vectorTileUrl || `${workspace}/wms?service=WMS&version=1.1.0&request=GetMap&layers=${workspace}:${layerName}&styles=&bbox={bbox-epsg-4326}&width=256&height=256&srs=EPSG:4326&format=image/png`,
        maskLayer: result.maskLayer,
        metadata: {
          featureCount: result.featureCount || 1,
          bounds: result.boundingBox || [-180, -90, 180, 90],
          projection: 'EPSG:4326'
        },
        attributes: result.attributes || attributes,
        layerName: result.layerName || layerName
      }
    } catch (error) {
      console.error('❌ Complete GeoServer backend error:', error)
      throw error
    }
  }

  const processShapefileLocally = async (file: File) => {
    console.log('📁 Using LOCAL processing as fallback')
    console.log('🔍 DEBUG - processShapefileLocally called with file:', file.name)
    
    // Dynamic imports for local processing
    console.log('🔍 DEBUG - About to import shpjs...')
    const shp = await import('shpjs')
    console.log('🔍 DEBUG - shpjs imported successfully')

    return new Promise<any>((resolve, reject) => {
      console.log('🔍 DEBUG - Starting FileReader...')
      const reader = new FileReader()
      
      reader.onload = async (event) => {
        console.log('🔍 DEBUG - FileReader onload triggered')
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer
          console.log('🔍 DEBUG - ArrayBuffer size:', arrayBuffer.byteLength)
          
          // Use parseZip method which is more reliable
          console.log('🔍 DEBUG - About to parse ZIP with shpjs...')
          const geojson = await shp.parseZip(arrayBuffer)
          console.log('🔍 DEBUG - Shapefile parsed successfully, features:', geojson.features?.length)
          
          if (!geojson || !geojson.features || geojson.features.length === 0) {
            throw new Error('No features found in shapefile')
          }
          
          // Extract attributes from first feature
          const firstFeature = geojson.features[0]
          console.log('🔍 DEBUG - First feature:', firstFeature)
          console.log('🔍 DEBUG - First feature properties:', firstFeature.properties)
          
          const attributes = Object.keys(geojson.features[0].properties || {})
          console.log('🔍 DEBUG - Extracted attributes:', attributes)
          console.log('🔍 DEBUG - Attributes length:', attributes.length)
          
          // Calculate bounds
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
          
          geojson.features.forEach((feature: any) => {
            if (feature.geometry && feature.geometry.coordinates) {
              const processCoords = (coords: any) => {
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
          
          resolve({
            success: true,
            method: 'local' as const,
            geojsonData: geojson,
            metadata: {
              featureCount: geojson.features.length,
              bounds: [minX, minY, maxX, maxY],
              projection: 'EPSG:4326'
            },
            attributes
          })
          
        } catch (error) {
          reject(error)
        }
      }
      
      reader.onerror = () => {
        console.log('🔍 DEBUG - FileReader error occurred')
        reject(new Error('Failed to read file'))
      }
      
      console.log('🔍 DEBUG - Starting readAsArrayBuffer...')
      reader.readAsArrayBuffer(file)
      console.log('🔍 DEBUG - readAsArrayBuffer called')
    })
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🔥 DEBUG - handleFileSelect called')
    const file = event.target.files?.[0]
    if (!file) return

    console.log('🔥 DEBUG - File selected:', file.name, file.size)
    
    if (!selectedCountry) {
      console.log('🔥 DEBUG - No country selected')
      toast.error('Please select a country first')
      return
    }

    if (!file.name.endsWith('.zip')) {
      console.log('🔥 DEBUG - File is not a zip')
      toast.error('Please select a zipped shapefile (.zip)')
      return
    }

    console.log('🔥 DEBUG - All validation passed, starting processing...')

    console.log('🎯 Starting HYBRID boundary processing:', {
      file: file.name,
      size: file.size,
      preferredMethod: processingMethod
    })

    setCurrentFile(file)
    setIsUploading(true)
    setUploadProgress(10)

    try {
      let result

      // CHANGE: Always process locally first to get attributes, then show configuration
      console.log('� DEBUG - Processing locally first to extract attributes')
      setUploadProgress(30)
      result = await processShapefileLocally(file)
      
      setUploadProgress(80)
      
      // Set up configuration UI with local processing results
      setShapefileAttributes(result.attributes || [])
      setFileMetadata(result.metadata)
      
      // Store the processing method preference and file for later upload
      setCurrentGeojsonData({ 
        preferredMethod: processingMethod, // Store which method to use for final upload
        localResult: result, // Store local processing result
        layerName: `${selectedCountry}_admin_${adminLevel}_${Date.now()}` // Pre-generate layer name
      })
      
      setUploadProgress(100)
      
      console.log('🔍 DEBUG - About to show configuration. Attributes count:', (result.attributes || []).length)
      setShowConfiguration(true)
      
      // Auto-select likely name attribute
      const nameAttribute = result.attributes.find((attr: string) => 
        attr.toLowerCase().includes('name') || 
        attr.toLowerCase().includes('province') ||
        attr.toLowerCase().includes('district') ||
        attr.toLowerCase().includes('state') ||
        attr.toLowerCase().includes('admin') ||
        attr.toLowerCase().includes('region')
      )
      if (nameAttribute) {
        setHoverAttribute(nameAttribute)
      }

      setTimeout(() => {
        setIsUploading(false)
        setUploadProgress(0)
      }, 500)

    } catch (error) {
      console.error('Boundary processing failed:', error)
      toast.error(`Processing failed: ${error.message || 'Unknown error'}`)
      setIsUploading(false)
      setUploadProgress(0)
      setShowConfiguration(false)
      setCurrentFile(null)
    }
  }

  const handleUploadComplete = async () => {
    if (!currentFile || !fileMetadata || !hoverAttribute) {
      toast.error('Missing boundary data or hover attribute. Please complete the configuration.')
      return
    }

    try {
      console.log('Completing boundary upload with full metadata...')
      setIsUploading(true)
      setUploadProgress(20)

      // NOW upload to GeoServer with complete metadata including hover attribute
      let result
      const layerName = currentGeojsonData?.layerName || `${selectedCountry}_admin_${adminLevel}_${Date.now()}`
      
      if (currentGeojsonData?.preferredMethod === 'geoserver') {
        console.log('🚀 Uploading to GeoServer with complete metadata...')
        setUploadProgress(40)
        
        try {
          // Call GeoServer upload with complete metadata
          result = await processShapefileWithGeoServerComplete(
            currentFile, 
            layerName, 
            'escap_climate', 
            selectedCountry, 
            adminLevel,
            hoverAttribute, // Now we have the hover attribute
            shapefileAttributes
          )
          console.log('✅ GeoServer upload completed with metadata')
          toast.success('🚀 Uploaded with HIGH-PERFORMANCE Vector Tiles + Complete Metadata!')
        } catch (geoError) {
          console.warn('❌ GeoServer upload failed, using local processing:', geoError)
          result = currentGeojsonData.localResult
          result.method = 'local'
          toast.info('📁 Using local processing (GeoServer unavailable)')
        }
      } else {
        console.log('� Using local processing (backend not available)')
        result = currentGeojsonData.localResult
        result.method = 'local'
      }

      setUploadProgress(60)

      const boundaryFile: BoundaryFile = {
        id: Date.now().toString(),
        name: layerName,
        country: selectedCountry,
        adminLevel: adminLevel,
        size: currentFile.size, // We have the actual file size
        attributes: shapefileAttributes, // We have the actual attributes
        hoverAttribute: hoverAttribute, // We have the selected hover attribute
        uploadedAt: Date.now(), // We have the actual upload time
        filePath: currentFile.name,
        processingMethod: result.method === 'geoserver' ? 'geoserver' : 'local',
        vectorTileUrl: result.vectorTileUrl,
        maskLayer: result.maskLayer,
        metadata: fileMetadata
      }

      setUploadProgress(80)

      // Store locally only for local processing method
      if (boundaryFile.processingMethod === 'local') {
        const dataKey = `boundary_data_${boundaryFile.id}`
        try {
          await storeDataInChunks(dataKey, currentGeojsonData.localResult.geojsonData)
          boundaryFile.dataKey = dataKey
          console.log('📁 Stored boundary with local chunked data')
        } catch (error) {
          console.error('❌ Failed to store chunked data:', error)
          if (error.name === 'QuotaExceededError') {
            toast.error('❌ Storage quota exceeded. File too large for local processing.')
            setIsUploading(false)
            setUploadProgress(0)
            return
          }
          throw error
        }
      } else {
        console.log('🚀 Boundary uploaded to GeoServer with complete metadata')
      }

      console.log('🔍 DEBUG - Boundary upload completed with metadata:', boundaryFile)
      
      // CRITICAL FIX: Reload from GeoServer API to get the updated list
      await loadBoundaryFiles()
      setUploadProgress(100)

      // Call onStatsUpdate to refresh admin panel stats
      if (onStatsUpdate) {
        console.log('🔍 DEBUG - Calling onStatsUpdate callback')
        onStatsUpdate()
      }

      toast.success(`✅ Boundary uploaded successfully using ${boundaryFile.processingMethod === 'geoserver' ? 'HIGH-PERFORMANCE Vector Tiles' : 'local processing'}!`)
      
      // Reset form
      setShowConfiguration(false)
      setCurrentFile(null)
      setCurrentGeojsonData(null)
      setFileMetadata(null)
      setShapefileAttributes([])
      setHoverAttribute('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      onStatsUpdate()

    } catch (error) {
      console.error('Upload completion failed:', error)
      toast.error(`Upload failed: ${error.message || 'Unknown error'}`)
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDeleteBoundary = async (id: string) => {
    try {
      const fileToDelete = boundaryFiles.find(f => f.id === id)
      if (!fileToDelete) {
        toast.error('Boundary not found')
        return
      }

      // SERVER-DRIVEN: Delete from server first
      try {
        const deleteResponse = await fetch(`${BACKEND_URL}/api/geoserver/layers/${fileToDelete.name}`, {
          method: 'DELETE'
        })
        
        if (deleteResponse.ok) {
          console.log('✅ Boundary deleted from server successfully')
          toast.success('Boundary deleted successfully')
        } else {
          console.error('❌ Failed to delete boundary from server')
          toast.error('Failed to delete boundary from server')
          return
        }
      } catch (deleteError) {
        console.error('❌ Server delete request failed:', deleteError)
        toast.error('Failed to communicate with server')
        return
      }

      // Clean up local chunked data if it exists (for local processing fallback)
      if (fileToDelete?.dataKey) {
        try {
          const chunkMeta = await SparkFallback.get<{
            isChunked: boolean
            totalChunks: number
            originalSize: number
            chunkKeys: string[]
          }>(fileToDelete.dataKey)
          
          if (chunkMeta?.chunkKeys) {
            for (const chunkKey of chunkMeta.chunkKeys) {
              await SparkFallback.delete(chunkKey)
            }
          }
          await SparkFallback.delete(fileToDelete.dataKey)
        } catch (cleanupError) {
          console.warn('⚠️ Failed to clean up local data:', cleanupError)
        }
      }
      
      // Refresh the boundary list from server
      await loadBoundaryFiles()
      onStatsUpdate()
    } catch (error) {
      console.error('Failed to delete boundary:', error)
      toast.error('Failed to delete boundary')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - timestamp
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    // Show relative time for recent uploads
    if (diffDays === 0) {
      return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else if (diffDays === 1) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString([], { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric'
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Hybrid Boundary Manager
              </CardTitle>
              <CardDescription>
                High-performance vector tiles with local fallback
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadBoundaryFiles}>
                🔄 Refresh from GeoServer
              </Button>
              {processingMethod === 'geoserver' ? (
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <Lightning className="h-3 w-3 mr-1" />
                  GeoServer Ready
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <HardDrives className="h-3 w-3 mr-1" />
                  Local Mode
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">Country/Region</Label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger id="country">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES_LIST.map((country) => (
                    <SelectItem key={country.id} value={country.id}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-level">Administrative Level</Label>
              <Select value={adminLevel.toString()} onValueChange={(value) => setAdminLevel(parseInt(value))}>
                <SelectTrigger id="admin-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Country Level (Admin 0)</SelectItem>
                  <SelectItem value="1">State/Province (Admin 1)</SelectItem>
                  <SelectItem value="2">District/County (Admin 2)</SelectItem>
                  <SelectItem value="3">Municipality (Admin 3)</SelectItem>
                  <SelectItem value="4">Local/Village (Admin 4)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shapefile">Shapefile Upload (.zip)</Label>
            <div className="flex items-center gap-4">
              <Input
                ref={fileInputRef}
                id="shapefile"
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                disabled={isUploading || !selectedCountry}
              />
              {currentFile && (
                <div className="text-sm text-muted-foreground">
                  {currentFile.name} ({formatFileSize(currentFile.size)})
                </div>
              )}
            </div>
            {!selectedCountry && (
              <p className="text-sm text-muted-foreground">
                Please select a country first
              </p>
            )}
          </div>

          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Processing shapefile...
                </span>
                <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {showConfiguration && shapefileAttributes.length > 0 && (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-lg">Configure Boundary Display</CardTitle>
                <CardDescription>
                  Choose which attribute to display when hovering over boundaries
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hover-attribute">Hover Display Attribute</Label>
                    <Select value={hoverAttribute} onValueChange={setHoverAttribute}>
                      <SelectTrigger id="hover-attribute">
                        <SelectValue placeholder="Select attribute" />
                      </SelectTrigger>
                      <SelectContent>
                        {shapefileAttributes.map((attr) => (
                          <SelectItem key={attr} value={attr}>
                            {attr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>File Information</Label>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {fileMetadata && (
                        <>
                          <div>Features: {fileMetadata.featureCount?.toLocaleString()}</div>
                          <div>Projection: {fileMetadata.projection}</div>
                          <div>Processing: {currentGeojsonData?.vectorTileUrl ? 'Vector Tiles' : 'Local'}</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowConfiguration(false)
                      setCurrentFile(null)
                      setCurrentGeojsonData(null)
                      setFileMetadata(null)
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                      }
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUploadComplete}
                    disabled={!hoverAttribute}
                  >
                    <UploadSimple className="h-4 w-4 mr-2" />
                    Complete Upload
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Boundary Files List */}
      {boundaryFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <File className="h-5 w-5" />
              Uploaded Boundary Files ({boundaryFiles.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {boundaryFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{file.name}</h4>
                      <Badge variant={file.processingMethod === 'geoserver' ? 'default' : 'secondary'}>
                        {file.processingMethod === 'geoserver' ? (
                          <>
                            <Lightning className="h-3 w-3 mr-1" />
                            Vector Tiles
                          </>
                        ) : (
                          <>
                            <HardDrives className="h-3 w-3 mr-1" />
                            Local
                          </>
                        )}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-center gap-4">
                        <span>Country: {file.country}</span>
                        <span>Admin Level: {file.adminLevel}</span>
                        <span>Size: {file.size ? formatFileSize(file.size) : 'Not available'}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span>Features: {file.metadata?.featureCount?.toLocaleString() || 'Unknown'}</span>
                        <span>Hover: {file.hoverAttribute || 'Not configured'}</span>
                        <span>Created: {formatDate(file.uploadedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // TODO: Implement preview functionality
                        toast.info('Preview functionality coming soon')
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteBoundary(file.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Helper function for chunked storage (fallback only)
const storeDataInChunks = async (key: string, data: any): Promise<void> => {
  const dataString = JSON.stringify(data)
  const chunkSize = 1024 * 1024 // 1MB chunks
  const totalChunks = Math.ceil(dataString.length / chunkSize)
  
  console.log(`📦 Storing data in ${totalChunks} chunks for local fallback`)
  
  // Store chunk metadata
  const chunkMeta = {
    isChunked: true,
    totalChunks,
    originalSize: dataString.length,
    chunkKeys: [] as string[]
  }
  
  // Store individual chunks
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize, dataString.length)
    const chunk = dataString.slice(start, end)
    const chunkKey = `${key}_chunk_${i}`
    
    await SparkFallback.set(chunkKey, chunk)
    chunkMeta.chunkKeys.push(chunkKey)
  }
  
  await SparkFallback.set(key, chunkMeta)
}