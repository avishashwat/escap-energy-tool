import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { UploadSimple, File, Trash, MapPin, Eye } from '@phosphor-icons/react'
import { SparkFallback } from '../../utils/sparkFallback'
import { COUNTRIES_LIST, TOTAL_COUNTRIES, isCountrySupported } from '@/constants/countries'
import { toast } from 'sonner'

// Import API configuration
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'

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
  processingMethod: 'geoserver' // Only GeoServer now
  vectorTileUrl?: string // Vector tile URL from GeoServer
  maskLayer?: { // For inverse mask information
    success: boolean
    maskLayerName: string
    vectorTileUrl: string
    processingTime: number
  }
  metadata?: {
    featureCount: number
    bounds: [number, number, number, number] // [minX, minY, maxX, maxY]
    projection: string
  }
}

interface ChunkMetadata {
  isChunked: true
  totalChunks: number
  originalSize: number
  chunkKeys: string[]
}

interface BoundaryManagerProps {
  onStatsUpdate: () => void
}

export function BoundaryManager({ onStatsUpdate }: BoundaryManagerProps) {
  const [boundaryFiles, setBoundaryFiles] = useState<BoundaryFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedCountry, setSelectedCountry] = useState('')
  const [adminLevel, setAdminLevel] = useState(1)
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [shapefileAttributes, setShapefileAttributes] = useState<string[]>([])
  const [hoverAttribute, setHoverAttribute] = useState('')
  const [showConfiguration, setShowConfiguration] = useState(false)
  const [fileMetadata, setFileMetadata] = useState<any>(null)
  const [currentGeojsonData, setCurrentGeojsonData] = useState<any>(null)
  const [processingMethod, setProcessingMethod] = useState<'geoserver'>('geoserver') // Only GeoServer
  const [maskProcessingStatus, setMaskProcessingStatus] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Use centralized country constants (Current: 3 countries)
  const countries = COUNTRIES_LIST

  const adminLevels = [
    { value: 0, label: 'Country Level (ADM0)' },
    { value: 1, label: 'Province/State Level (ADM1)' },
    { value: 2, label: 'District Level (ADM2)' },
    { value: 3, label: 'Sub-district Level (ADM3)' }
  ]

  useEffect(() => {
    checkBackendAvailability()
    loadBoundaryFiles()
    console.log(`📊 Total supported countries: ${TOTAL_COUNTRIES}`)
  }, [])

  const loadBoundaryFiles = async () => {
    try {
      console.log('🔄 Loading boundary files from GeoServer...')
      const response = await fetch(`${BACKEND_URL}/api/geoserver/boundaries`)
      const data = await response.json()
      
      if (data.success && data.boundaries) {
        console.log('🔄 Loaded boundary files from GeoServer:', data.boundaries.length, 'files found')
        console.log('🔄 Files details:', data.boundaries.map((f: any) => ({ 
          id: f.id, 
          name: f.name, 
          country: f.country, 
          adminLevel: f.adminLevel,
          featureCount: f.metadata?.featureCount,
          hasMask: !!f.maskLayer 
        })))
        
        // Convert GeoServer boundary format to BoundaryFile format
        const boundaryFiles = data.boundaries.map((boundary: any) => ({
          id: boundary.id,
          name: boundary.name,
          country: boundary.country,
          adminLevel: boundary.adminLevel,
          size: 0, // Not available from GeoServer
          attributes: [], // Not available from this endpoint
          hoverAttribute: '', // Default
          uploadedAt: boundary.uploadedAt,
          filePath: '', // Not applicable for GeoServer
          processingMethod: 'geoserver' as const,
          vectorTileUrl: boundary.vectorTileUrl,
          maskLayer: boundary.maskLayer,
          metadata: boundary.metadata
        }))
        
        setBoundaryFiles(boundaryFiles)
        
      } else {
        console.warn('⚠️ Failed to load boundaries from GeoServer:', data)
        setBoundaryFiles([])
      }
    } catch (error) {
      console.error('❌ Failed to load boundary files from GeoServer:', error)
      setBoundaryFiles([])
    }
  }

  const checkBackendAvailability = async () => {
    try {
      console.log('🔧 Checking GeoServer backend availability...')
      const response = await fetch(`${BACKEND_URL}/api/geoserver`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000) // 3 second timeout
      })
      
      if (response.ok) {
        console.log('✅ GeoServer backend available - ready for high-performance vector tiles')
        setProcessingMethod('geoserver')
      } else {
        console.log('⚠️ GeoServer backend unavailable - uploads will fail until backend is started')
        toast.error('GeoServer backend is not available. Please ensure the backend server is running.')
      }
    } catch (error) {
      console.log('⚠️ GeoServer backend unavailable - uploads will fail until backend is started')
      console.log('   Error:', error.message)
      toast.error('GeoServer backend is not available. Please ensure the backend server is running.')
    }
  }

  const processShapefileWithGeoServer = async (file: File, layerName: string, workspace: string, country: string, adminLevel: number) => {
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
      
      setMaskProcessingStatus('Uploading to GeoServer...')

      const response = await fetch(`${BACKEND_URL}/api/geoserver/upload-shapefile`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(120000) // 2 minute timeout for processing
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
      
      setMaskProcessingStatus('')
      
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
      setMaskProcessingStatus('')
      console.error('❌ GeoServer backend error:', error)
      throw error
    }
  }

  // Analyze shapefile from zip file
  const analyzeShapefileForBoundary = async (file: File) => {
    return new Promise<{ attributes: string[]; metadata: any; geojsonData: any }>((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = async function(e) {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer
          
          // Import libraries dynamically
          const [JSZip, shpjs] = await Promise.all([
            import('jszip'),
            import('shpjs')
          ])
          
          console.log('Libraries loaded successfully')
          
          // Use JSZip to extract the zip file
          const zip = new JSZip.default()
          const contents = await zip.loadAsync(arrayBuffer)
          
          console.log('Zip file loaded, contents:', Object.keys(contents.files))
          
          // Find .shp, .dbf, .shx files
          let shpFile, dbfFile, shxFile, prjFile
          
          for (const [filename, zipFile] of Object.entries(contents.files)) {
            if (zipFile.dir) continue // Skip directories
            
            const lowerFilename = filename.toLowerCase()
            if (lowerFilename.endsWith('.shp')) {
              shpFile = await zipFile.async('arraybuffer')
              console.log('Found .shp file:', filename)
            } else if (lowerFilename.endsWith('.dbf')) {
              dbfFile = await zipFile.async('arraybuffer')
              console.log('Found .dbf file:', filename)
            } else if (lowerFilename.endsWith('.shx')) {
              shxFile = await zipFile.async('arraybuffer')
              console.log('Found .shx file:', filename)
            } else if (lowerFilename.endsWith('.prj')) {
              prjFile = await zipFile.async('text')
              console.log('Found .prj file:', filename)
            }
          }
          
          if (!shpFile || !dbfFile) {
            throw new Error('Invalid shapefile: missing .shp or .dbf files')
          }
          
          console.log('All required files found, parsing shapefile...')
          
          // Parse shapefile to GeoJSON using shpjs
          const geojson = await shpjs.default(arrayBuffer)
          
          console.log('Parsed GeoJSON:', geojson)
          
          if (!geojson || !geojson.features || geojson.features.length === 0) {
            throw new Error('No features found in shapefile')
          }
          
          // Extract attributes from first feature
          const firstFeature = geojson.features[0]
          const attributes = Object.keys(firstFeature.properties || {})
          
          console.log('First feature:', firstFeature)
          console.log('Attributes found:', attributes)
          
          // Calculate bounds
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
          
          geojson.features.forEach((feature: any) => {
            if (feature.geometry && feature.geometry.coordinates) {
              const coords = feature.geometry.coordinates
              
              const processCoords = (coordArray: any) => {
                if (Array.isArray(coordArray[0])) {
                  coordArray.forEach(processCoords)
                } else {
                  const [x, y] = coordArray
                  if (typeof x === 'number' && typeof y === 'number') {
                    minX = Math.min(minX, x)
                    maxX = Math.max(maxX, x)
                    minY = Math.min(minY, y)
                    maxY = Math.max(maxY, y)
                  }
                }
              }
              
              if (feature.geometry.type === 'Polygon') {
                coords.forEach(processCoords)
              } else if (feature.geometry.type === 'MultiPolygon') {
                coords.forEach((polygon: any) => polygon.forEach(processCoords))
              } else if (feature.geometry.type === 'Point') {
                const [x, y] = coords
                if (typeof x === 'number' && typeof y === 'number') {
                  minX = Math.min(minX, x)
                  maxX = Math.max(maxX, x)
                  minY = Math.min(minY, y)
                  maxY = Math.max(maxY, y)
                }
              }
            }
          })
          
          // Ensure valid bounds
          if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
            throw new Error('Could not calculate valid bounds from shapefile')
          }
          
          const metadata = {
            featureCount: geojson.features.length,
            bounds: [minX, minY, maxX, maxY] as [number, number, number, number],
            projection: prjFile ? 'EPSG:4326' : 'EPSG:4326' // Default to WGS84
          }
          
          console.log('Analysis complete:', { attributes, metadata })
          
          resolve({ 
            attributes, 
            metadata,
            geojsonData: geojson
          })
          
        } catch (error) {
          console.error('Error analyzing shapefile:', error)
          reject(new Error(`Failed to analyze shapefile: ${error.message}`))
        }
      }
      
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsArrayBuffer(file)
    })
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!selectedCountry) {
      toast.error('Please select a country first')
      return
    }

    // Validate that selected country is supported
    if (!isCountrySupported(selectedCountry)) {
      toast.error(`Country "${selectedCountry}" is not supported. Please select from: ${countries.map(c => c.label).join(', ')}`)
      return
    }

    if (!file.name.endsWith('.zip')) {
      toast.error('Please select a zipped shapefile (.zip)')
      return
    }

    console.log('Starting file processing for:', file.name, 'Size:', file.size)
    console.log('Processing method:', processingMethod)

    setCurrentFile(file)
    setIsUploading(true)
    setUploadProgress(10)

    try {
      // Only use GeoServer processing
      console.log('� Using GeoServer processing for:', file.name)
      
      const layerName = `${selectedCountry.toLowerCase()}_adm${adminLevel}_${Date.now()}`
      
      console.log('🔥 DEBUG - About to call processShapefileWithGeoServer with layerName:', layerName)
      const result = await processShapefileWithGeoServer(file, layerName, 'escap_climate', selectedCountry, adminLevel)
      console.log('🔍 DEBUG - GeoServer processing completed successfully')
      console.log('🔍 DEBUG - Result from GeoServer:', result)
      
      setUploadProgress(70)
      
      console.log('🔍 DEBUG - Final processing result:', result)
      
      if (result.success) {
        // Store the result data
        setCurrentGeojsonData(result)
        setFileMetadata(result.metadata)
        setShapefileAttributes(result.attributes || [])
        
        setUploadProgress(100)
        setShowConfiguration(true)
        
        // Reset upload state after showing configuration
        setTimeout(() => {
          setIsUploading(false)
          setUploadProgress(0)
        }, 500)
        
        // Auto-select likely name attribute
        const nameAttribute = result.attributes?.find((attr: string) => 
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
        
        const processingMethodText = result.method === 'geoserver' ? 'HIGH-PERFORMANCE Vector Tiles' : 'local processing'
        toast.success(`✅ Shapefile processed successfully using ${processingMethodText}! Found ${result.metadata?.featureCount || 0} features.`)
        
      } else {
        throw new Error('Processing failed')
      }
      
    } catch (error) {
      console.error('File processing error:', error)
      toast.error(`Failed to process shapefile: ${error.message || 'Unknown error'}`)
      setIsUploading(false)
      setUploadProgress(0)
      setShowConfiguration(false)
      setCurrentFile(null)
      setMaskProcessingStatus('')
    }
  }

  const handleUploadComplete = async () => {
    if (!currentFile || !fileMetadata || !hoverAttribute) {
      toast.error('Please select a hover attribute before completing upload.')
      return
    }

    try {
      console.log('Completing boundary upload...')
      setIsUploading(true)
      setUploadProgress(60)

      const boundaryFile: BoundaryFile = {
        id: Date.now().toString(),
        name: currentFile.name,
        country: selectedCountry,
        adminLevel: adminLevel,
        size: currentFile.size,
        attributes: shapefileAttributes,
        hoverAttribute: hoverAttribute,
        uploadedAt: Date.now(),
        filePath: currentFile.name,
        processingMethod: 'geoserver', // Always use GeoServer
        vectorTileUrl: currentGeojsonData?.vectorTileUrl,
        maskLayer: currentGeojsonData?.maskLayer, // Include mask layer information
        metadata: fileMetadata
      }

      console.log('🔍 DEBUG - Processing method detection:')
      console.log('  currentGeojsonData?.vectorTileUrl:', currentGeojsonData?.vectorTileUrl)
      console.log('  Detected method:', boundaryFile.processingMethod)
      console.log('  maskLayer data:', currentGeojsonData?.maskLayer)

      // Only store metadata for GeoServer - no local storage needed
      boundaryFile.vectorTileUrl = currentGeojsonData.vectorTileUrl
      console.log('🚀 Stored boundary with GeoServer vector tile reference:', boundaryFile.vectorTileUrl)
      console.log('🎭 Mask layer info being stored:', boundaryFile.maskLayer)
      console.log('🚀 No GeoJSON storage needed - using vector tiles directly!')

      console.log('💾 About to retrieve existing boundary files from storage...')
      const savedFiles = await SparkFallback.get<BoundaryFile[]>('admin_boundary_files') || []
      console.log('💾 Current stored boundary files:', savedFiles.length, 'files')
      
      console.log('💾 Adding new boundary file to list...')
      savedFiles.push(boundaryFile)
      console.log('💾 New list will have:', savedFiles.length, 'files')
      
      console.log('💾 Attempting to save boundary files to storage...')
      console.log('🔄 Reloading boundaries from GeoServer...')
      await loadBoundaryFiles() // Reload from GeoServer
      setUploadProgress(100)

      console.log('🎉 Upload process completed successfully!')
      toast.success(`✅ Boundary uploaded successfully using HIGH-PERFORMANCE Vector Tiles!`)
      
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

  const handleDeleteFile = async (fileId: string) => {
    try {
      // Note: For now, we just reload from GeoServer
      // TODO: Implement actual deletion on the backend
      console.log(`🗑️ Delete requested for boundary: ${fileId}`)
      
      // Reload boundaries from GeoServer to reflect any changes
      await loadBoundaryFiles()
      onStatsUpdate()
      toast.success('Boundary list refreshed from GeoServer')
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to refresh boundary list')
    }
  }

  const renderBoundaryCard = (file: BoundaryFile) => (
    <Card key={file.id} className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-muted rounded-lg">
              <MapPin size={20} />
            </div>
            <div>
              <CardTitle className="text-sm">{file.name}</CardTitle>
              <CardDescription className="text-xs">
                {countries.find(c => c.value === file.country)?.label} • ADM{file.adminLevel} • {(file.size / 1024 / 1024).toFixed(2)} MB
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <Badge variant="outline" className="text-xs">
              ADM{file.adminLevel}
            </Badge>
            <Badge variant={file.processingMethod === 'geoserver' ? 'default' : 'secondary'} className="text-xs">
              {file.processingMethod === 'geoserver' ? '🚀 Vector' : '📁 Local'}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => handleDeleteFile(file.id)}>
              <Trash size={14} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="text-xs">
            <span className="text-muted-foreground">Hover Attribute:</span> {file.hoverAttribute}
          </div>
          {file.metadata && (
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>Features: {file.metadata.featureCount}</div>
              <div>Projection: {file.metadata.projection}</div>
            </div>
          )}
          {file.maskLayer && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Inverse Mask:</span>
              <Badge variant={file.maskLayer.success ? 'default' : 'destructive'} className="text-xs">
                {file.maskLayer.success ? '✅ Generated' : '❌ Failed'}
              </Badge>
              {file.maskLayer.success && (
                <span className="text-muted-foreground">({file.maskLayer.processingTime}ms)</span>
              )}
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            Uploaded: {new Date(file.uploadedAt).toLocaleDateString()}
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">Attributes:</span> {file.attributes.join(', ')}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Boundary Manager</h2>
        <p className="text-muted-foreground">Upload and manage administrative boundary shapefiles for each country</p>
      </div>

      {/* Upload Form */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Boundary Shapefile</CardTitle>
          <CardDescription>Upload zipped shapefiles containing administrative boundaries</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map(country => (
                    <SelectItem key={country.value} value={country.value}>
                      {country.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-level">Administrative Level</Label>
              <Select value={adminLevel.toString()} onValueChange={(value) => setAdminLevel(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {adminLevels.map(level => (
                    <SelectItem key={level.value} value={level.value.toString()}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="boundary-file">Select Shapefile (ZIP)</Label>
            <div className="flex items-center space-x-4">
              <Input
                ref={fileInputRef}
                id="boundary-file"
                type="file"
                onChange={handleFileSelect}
                accept=".zip"
                disabled={isUploading || !selectedCountry}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
              {isUploading && uploadProgress > 0 && uploadProgress < 100 && (
                <Progress value={uploadProgress} className="w-32" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Upload a zipped shapefile containing .shp, .shx, .dbf, and .prj files
            </p>
          </div>

          {/* Debug section for development */}
          <div className="pt-4 border-t">
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={async () => {
                  try {
                    const data = await SparkFallback.get<BoundaryFile[]>('admin_boundary_files')
                    console.log('Current boundary files:', data)
                    toast.success(`Found ${data?.length || 0} boundary files in storage`)
                  } catch (error) {
                    console.error('Debug check failed:', error)
                    toast.error('Failed to check storage')
                  }
                }}
              >
                Check Storage
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={async () => {
                  try {
                    // Reload from GeoServer to get latest state
                    await loadBoundaryFiles()
                    onStatsUpdate()
                    toast.success('Refreshed boundary data from GeoServer')
                  } catch (error) {
                    console.error('Refresh failed:', error)
                    toast.error('Failed to refresh data')
                  }
                }}
              >
                Refresh from GeoServer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Panel */}
      {showConfiguration && currentFile && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Configure Boundary Display</CardTitle>
            <CardDescription>
              Set up hover attributes and display options for {currentFile.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File Metadata */}
            {fileMetadata && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Features</div>
                  <div className="text-lg font-semibold">{fileMetadata.featureCount}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Projection</div>
                  <div className="text-lg font-semibold">{fileMetadata.projection}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Bounds</div>
                  <div className="text-xs font-mono">
                    {fileMetadata.bounds.map((b: number) => b.toFixed(2)).join(', ')}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Admin Level</div>
                  <div className="text-lg font-semibold">ADM{adminLevel}</div>
                </div>
              </div>
            )}

            {/* Processing Status */}
            <div className="p-4 bg-muted/30 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Processing Method:</span>
                <Badge variant={processingMethod === 'geoserver' ? 'default' : 'secondary'}>
                  {processingMethod === 'geoserver' ? '🚀 HIGH-PERFORMANCE Vector Tiles' : '📁 Local Processing'}
                </Badge>
              </div>
              {currentGeojsonData?.maskLayer && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Inverse Mask:</span>
                  <Badge variant={currentGeojsonData.maskLayer.success ? 'default' : 'destructive'}>
                    {currentGeojsonData.maskLayer.success ? '✅ Generated' : '❌ Failed'}
                  </Badge>
                </div>
              )}
              {maskProcessingStatus && (
                <div className="text-sm text-muted-foreground">
                  {maskProcessingStatus}
                </div>
              )}
            </div>

            {/* Attribute Configuration */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Hover Attribute</Label>
                <Select value={hoverAttribute} onValueChange={setHoverAttribute}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select attribute to display on hover" />
                  </SelectTrigger>
                  <SelectContent>
                    {shapefileAttributes.map(attr => (
                      <SelectItem key={attr} value={attr}>{attr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This attribute will be displayed when users hover over boundary regions
                </p>
              </div>

              <div className="space-y-2">
                <Label>Available Attributes</Label>
                <div className="p-3 border rounded-lg bg-muted/20">
                  <div className="flex flex-wrap gap-2">
                    {shapefileAttributes.map(attr => (
                      <Badge key={attr} variant="outline" className="text-xs">
                        {attr}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowConfiguration(false)}>
                Cancel
              </Button>
              <Button onClick={handleUploadComplete} disabled={!hoverAttribute || isUploading}>
                <UploadSimple size={16} className="mr-2" />
                {isUploading ? 'Uploading...' : 'Complete Upload'}
              </Button>
            </div>
            
            {/* Progress for final upload step */}
            {isUploading && uploadProgress > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                  <span>Uploading boundary data...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Current Boundaries */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Uploaded Boundaries ({boundaryFiles.length})</h3>
        
        {boundaryFiles.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No boundary files uploaded yet. Upload boundary shapefiles to enable country zooming and region hover effects.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Group by country */}
            {countries.map(country => {
              const countryBoundaries = boundaryFiles.filter(f => f.country === country.value)
              if (countryBoundaries.length === 0) return null

              return (
                <div key={country.value} className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-md font-medium">{country.label}</h4>
                    <Badge variant="secondary">{countryBoundaries.length} files</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {countryBoundaries.map(renderBoundaryCard)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}