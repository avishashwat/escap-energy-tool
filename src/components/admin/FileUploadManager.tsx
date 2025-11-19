import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Upload, File as FileIcon, Image, Trash, Eye, Pencil, Check, X, Thermometer, Drop, Flashlight, Plus } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { SimpleRasterConfig } from './SimpleRasterConfig'
import { SimpleShapefileConfig } from './SimpleShapefileConfig'
import { getSeasonsForCountry, COUNTRY_SEASONS } from '../../utils/countrySeasons'
import { COUNTRIES_LIST } from '@/constants/countries'
import { API_ENDPOINTS } from '@/config/api'

interface FileUploadManagerProps {
  onStatsUpdate: () => void
}

interface UploadedFile {
  id: string
  name: string
  type: 'raster' | 'shapefile' | 'boundary' | 'icon' | 'energy_infrastructure'
  fileType?: 'raster' | 'energy'  // Added to distinguish between raster and energy files
  category?: string
  subcategory?: string
  scenario?: string
  yearRange?: string
  seasonality?: string
  season?: string
  country: string
  uploadDate: string
  size: string
  status: 'active' | 'inactive'
  classification?: any
  config?: any
  rasterStats?: {
    min: number
    max: number
    mean: number
  }
  layerType?: string
  geometryType?: string
  wfsUrl?: string
  displayName?: string
}

interface LayerStructure {
  id: string
  label: string
  icon: any
  color: string
  subcategories?: string[]
  hasScenarios?: boolean
  scenarios?: string[]
  hasYearRanges?: boolean
  yearRanges?: string[]
  hasSeasonality?: boolean
  seasonality?: string[]
  seasons?: string[]
}

export function FileUploadManager({ onStatsUpdate }: FileUploadManagerProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTab, setSelectedTab] = useState('upload')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [selectedCountry, setSelectedCountry] = useState('')
  const [showSelectionPanel, setShowSelectionPanel] = useState(false)
  const [editingFile, setEditingFile] = useState<string | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingConfig, setEditingConfig] = useState<any>(null)

  // Layer Selection State
  const [selectedLayer, setSelectedLayer] = useState<LayerStructure | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState('')
  const [selectedScenario, setSelectedScenario] = useState('')
  const [selectedYearRange, setSelectedYearRange] = useState('')
  const [selectedSeasonality, setSelectedSeasonality] = useState('')
  const [selectedSeason, setSelectedSeason] = useState('')
  const [showRasterConfig, setShowRasterConfig] = useState(false)
  const [showShapefileConfig, setShowShapefileConfig] = useState(false)

  // Layer structure matching the sidebar
  const layerStructure: LayerStructure[] = [
    {
      id: 'climate',
      label: 'Climate Variables',
      icon: Thermometer,
      color: 'text-orange-600',
      subcategories: [
        'Maximum Temperature',
        'Minimum Temperature', 
        'Mean Temperature',
        'Precipitation',
        'Solar Radiation',
        'Cooling Degree Days',
        'Heating Degree Days'
      ],
      hasScenarios: true,
      scenarios: ['Historical', 'SSP1', 'SSP2', 'SSP3', 'SSP5'],
      hasYearRanges: true,
      yearRanges: ['2021-2040', '2041-2060', '2061-2080', '2081-2100'],
      hasSeasonality: true,
      seasonality: ['Annual', 'Seasonal'],
      // seasons will be dynamically populated based on selected country
    },
    {
      id: 'giri',
      label: 'GIRI Hazards',
      icon: Drop,
      color: 'text-blue-600',
      subcategories: ['Flood', 'Drought'],
      hasScenarios: true,
      scenarios: ['Existing', 'SSP1', 'SSP5']
    },
    {
      id: 'energy',
      label: 'Energy Infrastructure',
      icon: Flashlight,
      color: 'text-yellow-600',
      subcategories: ['Hydro Power Plants', 'Solar Power Plants', 'Wind Power Plants']
    }
  ]

  useEffect(() => {
    loadFiles()
  }, [])

  const loadFiles = async () => {
    try {
      setLoading(true)
      
      console.log('📂 Loading rasters and energy infrastructure from backend API...')
      
      // Fetch rasters (keep existing logic intact)
      const rastersResponse = await fetch(API_ENDPOINTS.rasters)
      if (!rastersResponse.ok) {
        throw new Error(`Failed to fetch rasters: ${rastersResponse.statusText}`)
      }
      const rastersData = await rastersResponse.json()
      console.log('📊 Rasters response:', rastersData)
      
      // Fetch energy infrastructure 
      const energyResponse = await fetch(API_ENDPOINTS.energyInfrastructure)
      let energyData = { success: false, data: [] }
      try {
        if (energyResponse.ok) {
          energyData = await energyResponse.json()
          console.log('⚡ Energy infrastructure response:', energyData)
        } else {
          console.warn('⚠️ Energy infrastructure API not available:', energyResponse.statusText)
        }
      } catch (energyError) {
        console.warn('⚠️ Energy infrastructure API error:', energyError.message)
      }
      
      // Combine results - prioritize rasters working
      const allFiles: any[] = []
      
      // Add rasters (preserve exact existing logic)
      if (rastersData && rastersData.success) {
        const rasters = Array.isArray(rastersData.rasters) ? rastersData.rasters : []
        rasters.forEach((raster: any) => {
          allFiles.push({ ...raster, fileType: 'raster' })
        })
        console.log(`✅ Loaded ${rasters.length} rasters from backend`)
      }
      
      // Add energy infrastructure layers
      if (energyData && energyData.success) {
        const energyLayers = Array.isArray(energyData.data) ? energyData.data : []
        energyLayers.forEach((energy: any) => {
          // Extract country from layer name (e.g., "bhutan_energy_hydro_power_plants" -> "bhutan")
          const countryMatch = energy.name?.match(/^([a-z]+)_/)
          const country = countryMatch ? countryMatch[1] : 'unknown'
          
          allFiles.push({ 
            ...energy, 
            fileType: 'energy',
            country: country,
            size: 'N/A',
            uploadDate: new Date().toISOString(),
            status: 'active' as 'active' | 'inactive'
          })
        })
        console.log(`✅ Loaded ${energyLayers.length} energy infrastructure layers`)
      }
      
      console.log('📂 Setting combined files:', allFiles.length, 'total files')
      setFiles(allFiles)
      
      if (allFiles.length === 0 && (!rastersData || !rastersData.success)) {
        console.error('❌ Backend returned error:', rastersData && rastersData.error)
        toast.error('Failed to load managed files from server')
      }
      
    } catch (error) {
      console.error('❌ Failed to load managed files from backend:', error)
      toast.error('Failed to load managed files from server')
      setFiles([]) // No localStorage fallback - pure backend approach
    } finally {
      setLoading(false)
    }
  }

  const saveFiles = async (updatedFiles: UploadedFile[]) => {
    // Backend-driven approach: files are persisted via API, no localStorage needed
    console.log('🔄 Files persisted via backend API, triggering refresh...')
    await loadFiles() // Refresh from backend
    onStatsUpdate()
  }

  const resetLayerSelection = () => {
    setSelectedLayer(null)
    setSelectedSubcategory('')
    setSelectedScenario('')
    setSelectedYearRange('')
    setSelectedSeasonality('')
    setSelectedSeason('')
  }

  const handleLayerSelect = (layer: LayerStructure) => {
    setSelectedLayer(layer)
    setShowSelectionPanel(true)
    // Reset other selections
    setSelectedSubcategory('')
    setSelectedScenario('')
    setSelectedYearRange('')
    setSelectedSeasonality('')
    setSelectedSeason('')
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadedFile(file)
    
    // Determine file type based on file extension
    const fileExtension = file.name.toLowerCase().split('.').pop()
    const isRaster = fileExtension === 'tif' || fileExtension === 'tiff'
    const isShapefile = fileExtension === 'zip'  // Shapefiles are uploaded as ZIP files containing .shp and associated files
    
    if (isRaster) {
      // Use traditional flow for raster files (require layer selection first)
      if (!selectedLayer || !selectedSubcategory) {
        toast.error('Please select layer type and variable first for raster files')
        setUploadedFile(null)
        return
      }
      setShowRasterConfig(true)
    } else if (isShapefile) {
      // Use traditional flow for shapefiles (require layer selection first)
      if (!selectedLayer || !selectedSubcategory) {
        toast.error('Please select layer type and variable first for shapefiles (energy infrastructure)')
        setUploadedFile(null)
        return
      }
      setShowShapefileConfig(true)
    } else {
      toast.error('Unsupported file type. Please upload TIF/TIFF or SHP files.')
      setUploadedFile(null)
    }
  }

  const processFileUpload = async (file: File, config?: any) => {
    if (!selectedCountry || !selectedLayer || !selectedSubcategory) {
      toast.error('Please complete all selections')
      return
    }

    try {
      setLoading(true)

      // Generate layer name based on naming convention including season if selected
      let layerName = `${selectedCountry}_${selectedLayer.id}_${selectedSubcategory}`
      
      if (selectedScenario) {
        layerName += `_${selectedScenario}`
      }
      
      if (selectedYearRange) {
        layerName += `_${selectedYearRange}`
      }
      
      // Add season if seasonality is Seasonal and season is selected
      if (selectedSeasonality === 'Seasonal' && selectedSeason) {
        layerName += `_${selectedSeason}`
      }
      
      // Check file type for rasters (DO NOT add _classified here - backend will add it during publication)
      const fileExtension = file.name.toLowerCase().split('.').pop()
      const isRaster = fileExtension === 'tif' || fileExtension === 'tiff'
      
      if (isRaster) {
        layerName += '_classified'
      }

      if (isRaster) {
        // Use the working backend endpoint for raster uploads
        const formData = new FormData()
        formData.append('raster', file)
        formData.append('layerName', layerName)
        formData.append('country', selectedCountry)  // 🌍 Send country for clipping to boundary
        
        // Handle classifications intelligently based on user configuration
        if (config?.classification?.classes && Array.isArray(config.classification.classes) && config.classification.classes.length > 0) {
          // Send user-defined classifications (they customized them in the UI)
          console.log('🔍 Frontend: Sending user-defined classifications:')
          config.classification.classes.forEach((cls, i) => {
            console.log(`  Class ${i + 1}: min=${cls.min}, max=${cls.max}, color=${cls.color}, label=${cls.label}`)
          })
          
          // Validate frontend data before sending
          const validClasses = config.classification.classes.every(cls => 
            typeof cls.min === 'number' && 
            typeof cls.max === 'number' && 
            cls.color && 
            cls.min < cls.max
          )
          
          if (!validClasses) {
            throw new Error('Invalid classification data: missing or invalid min/max/color properties')
          }
          
          formData.append('classifications', JSON.stringify(config.classification.classes))
        } else {
          // No user-defined classifications - let backend auto-generate based on actual data
          console.log('🔍 Frontend: No user-defined classifications - backend will auto-generate based on actual data')
          // Don't append classifications to formData - let backend handle it automatically
        }

        console.log('🔍 Frontend: FormData contents:')
        for (let [key, value] of formData.entries()) {
          console.log(`  ${key}:`, typeof value === 'string' ? value : '[File object]')
        }

        // Upload to the working backend endpoint
        const response = await fetch(API_ENDPOINTS.UPLOAD_RASTER, {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          // Get the detailed error message from backend
          try {
            const errorData = await response.json()
            console.error('🔍 Backend error response:', errorData)
            throw new Error(`Upload failed: ${errorData.error || response.statusText}`)
          } catch (parseError) {
            console.error('🔍 Failed to parse error response:', parseError)
            throw new Error(`Upload failed: ${response.statusText}`)
          }
        }

        const result = await response.json()
        console.log('🔍 Upload response result:', result)
        
        if (result && result.success) {
          // Refresh file list from backend instead of creating local record
          console.log('🔄 Refreshing file list after successful upload...')
          try {
            await loadFiles() // This will fetch all rasters from backend API
            console.log('✅ File list refreshed successfully')
          } catch (loadError) {
            console.error('❌ Error refreshing file list:', loadError)
            // Don't fail the upload if file list refresh fails
          }
          
          const layerName = result.layerName || 'Unknown Layer'
          toast.success(`✅ Raster uploaded successfully! Layer: ${layerName}`)
          console.log('🚀 Backend processing result:', result)
        } else {
          const errorMsg = (result && result.error) || (result && result.message) || 'Backend processing failed'
          throw new Error(errorMsg)
        }
      } else {
        // For shapefiles (energy infrastructure), use energy infrastructure upload endpoint
        console.log('🔍 Processing shapefile upload for energy infrastructure...')
        
        const formData = new FormData()
        formData.append('shapefile', file)
        formData.append('layerName', layerName)
        formData.append('workspace', 'escap_climate')
        formData.append('country', selectedCountry || 'unknown')
        formData.append('energyType', selectedSubcategory || 'general')
        
        // Add energy configuration if provided
        if (config) {
          console.log('🔍 Adding energy infrastructure configuration to upload:', config)
          formData.append('capacityAttribute', config.capacityAttribute || '')
          formData.append('useCustomIcon', config.useCustomIcon ? 'true' : 'false')
          formData.append('selectedIcon', config.icon || 'circle')
          
          // Add custom icon file if provided
          if (config.useCustomIcon && config.customIconFile) {
            // config.customIconFile should be the actual File object
            const iconFile = config.customIconFile as File
            if (iconFile && iconFile.name && typeof iconFile.size === 'number' && typeof iconFile.type === 'string') {
              formData.append('customIcon', iconFile)
              console.log('📎 Added custom icon file:', iconFile.name, iconFile.size, 'bytes')
            } else {
              console.warn('⚠️ Custom icon file is not a valid File object:', iconFile)
            }
          }
        }
        
        console.log('🔍 Energy Infrastructure FormData contents:')
        for (let [key, value] of formData.entries()) {
          console.log(`  ${key}:`, typeof value === 'string' ? value : '[File object]')
        }

        // Upload to the energy infrastructure endpoint
        const response = await fetch(API_ENDPOINTS.UPLOAD_ENERGY_INFRASTRUCTURE, {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          // Get the detailed error message from backend
          try {
            const errorData = await response.json()
            console.error('🔍 Shapefile upload backend error response:', errorData)
            throw new Error(`Shapefile upload failed: ${errorData.error || response.statusText}`)
          } catch (parseError) {
            console.error('🔍 Failed to parse shapefile upload error response:', parseError)
            throw new Error(`Shapefile upload failed: ${response.statusText}`)
          }
        }

        const result = await response.json()
        console.log('🔍 Shapefile upload response result:', result)
        
        if (result && result.success) {
          // Refresh file list from backend to include the new energy infrastructure layer
          console.log('🔄 Refreshing file list after successful shapefile upload...')
          try {
            await loadFiles() // This will fetch both rasters and energy infrastructure
            console.log('✅ File list refreshed successfully')
          } catch (loadError) {
            console.error('❌ Error refreshing file list:', loadError)
            // Don't fail the upload if file list refresh fails
          }
          
          const layerName = result.layerName || result.cleanLayerName || 'Unknown Layer'
          toast.success(`✅ Energy infrastructure shapefile uploaded successfully! Layer: ${layerName}`)
          console.log('🚀 Shapefile upload backend processing result:', result)
        } else {
          const errorMsg = (result && result.error) || (result && result.message) || 'Shapefile upload processing failed'
          throw new Error(errorMsg)
        }
      }

      // Reset form
      setUploadedFile(null)
      resetLayerSelection()
      setShowSelectionPanel(false)
      setShowRasterConfig(false)
      setShowShapefileConfig(false)
      
    } catch (error) {
      console.error('❌ Upload failed:', error)
      toast.error(`Upload failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const generateFilename = (
    file: File, 
    layer: LayerStructure, 
    subcategory: string, 
    scenario?: string, 
    yearRange?: string, 
    seasonality?: string, 
    season?: string, 
    country?: string
  ) => {
    const extension = file.name.split('.').pop()
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')
    
    let filename = `${country}_${layer.id}`
    
    // Add subcategory (variable)
    const safeSub = subcategory.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    filename += `_${safeSub}`
    
    // Add scenario if present
    if (scenario) {
      filename += `_${scenario.toLowerCase()}`
    }
    
    // Add year range if present
    if (yearRange) {
      filename += `_${yearRange.replace('-', '_')}`
    }
    
    // Add seasonality info (season codes are now used directly)
    if (seasonality === 'Seasonal' && season) {
      filename += `_${season}`
    }
    
    filename += `_${timestamp}.${extension}`
    
    return filename
  }

  const deleteFile = async (fileId: string) => {
    try {
      console.log(`🚀 DELETE FUNCTION CALLED with fileId: ${fileId}`)
      
      // Find the file to get the layer name for backend deletion
      const fileToDelete = (files || []).find(f => f.id === fileId)
      console.log(`🔍 File to delete:`, fileToDelete)
      
      if (!fileToDelete) {
        console.error(`❌ File not found with ID: ${fileId}`)
        toast.error('File not found')
        return
      }

      // Delete from backend for both raster and energy infrastructure files
      if ((fileToDelete.type === 'raster' || fileToDelete.type === 'energy_infrastructure' || fileToDelete.fileType === 'raster' || fileToDelete.fileType === 'energy') && fileToDelete.name) {
        try {
          const layerType = (fileToDelete.type === 'energy_infrastructure' || fileToDelete.fileType === 'energy') ? 'energy infrastructure' : 'raster'
          console.log(`🗑️ Deleting ${layerType} layer from backend: ${fileToDelete.name}`)
          
          // Properly encode spaces as %20 instead of +
          const encodedLayerName = encodeURIComponent(fileToDelete.name).replace(/\+/g, '%20')
          console.log(`🗑️ encodedLayerName : ${encodedLayerName}`)
          const deleteUrl = `${API_ENDPOINTS.deleteRaster}/${encodedLayerName}`
          console.log(`🌐 DELETE URL: ${deleteUrl}`)
          
          const response = await fetch(deleteUrl, {
            method: 'DELETE'
          })
          
          console.log(`📡 Delete response status: ${response.status}`)
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
            console.warn('⚠️ Backend deletion failed:', errorData)
            toast.error(`Backend deletion failed: ${errorData.error || 'Unknown error'}`)
          } else {
            const result = await response.json()
            console.log(`✅ Backend deletion successful:`, result)
            toast.success(`✅ Successfully deleted ${fileToDelete.name} (${layerType})`)
          }
        } catch (backendError) {
          console.error('⚠️ Backend deletion error:', backendError)
          toast.error(`Delete error: ${backendError.message}`)
        }
      } else {
        console.log(`ℹ️ Skipping backend deletion - unsupported type or no name. Type: ${fileToDelete.type}, Name: ${fileToDelete.name}`)
      }

      // Refresh from backend to update UI
      console.log(`🔄 Refreshing file list...`)
      await loadFiles()
      console.log(`✅ File list refreshed`)
    } catch (error) {
      console.error('❌ Delete function failed:', error)
      toast.error(`Delete failed: ${error.message}`)
    }
  }

  const toggleFileStatus = async (fileId: string) => {
    try {
      const updatedFiles = (files || []).map(f => 
        f.id === fileId 
          ? { ...f, status: f.status === 'active' ? 'inactive' : 'active' as 'active' | 'inactive' }
          : f
      )
      await saveFiles(updatedFiles)
      toast.success('File status updated')
    } catch (error) {
      console.error('Update failed:', error)
      toast.error('Update failed')
    }
  }

  const startEditFile = (file: UploadedFile) => {
    setEditingFile(file.id)
    setEditingConfig({...file})
    setShowEditDialog(true)
  }

  const saveEditedFile = async () => {
    if (!editingConfig || !editingFile) return

    try {
      const updatedFiles = (files || []).map(f => 
        f.id === editingFile ? editingConfig : f
      )
      await saveFiles(updatedFiles)
      setShowEditDialog(false)
      setEditingFile(null)
      setEditingConfig(null)
      toast.success('File updated successfully')
    } catch (error) {
      console.error('Update failed:', error)
      toast.error('Update failed')
    }
  }

  const canProceedWithUpload = () => {
    if (!selectedCountry || !selectedLayer || !selectedSubcategory) return false
    
    // Check scenario requirements
    if (selectedLayer.hasScenarios && !selectedScenario) return false
    
    // Check year range requirements (only for non-Historical scenarios)
    if (selectedLayer.hasYearRanges && selectedScenario && selectedScenario !== 'Historical' && !selectedYearRange) return false
    
    // Check seasonality requirements
    if (selectedLayer.hasSeasonality && !selectedSeasonality) return false
    
    // Check season requirements (only for Seasonal)
    if (selectedSeasonality === 'Seasonal' && !selectedSeason) return false
    
    return true
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">File Upload Manager</h2>
        <p className="text-sm text-muted-foreground">
          Upload and manage data files using the same layer structure as the main application
        </p>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Upload Files</TabsTrigger>
          <TabsTrigger value="manage">Manage Files</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload size={20} />
                Upload New File
              </CardTitle>
              <CardDescription>
                For raster files (.tif/.tiff): Upload first for auto-metadata detection, then configure classification.
                For shapefiles (.zip): Select layer type first, then upload and configure.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Country Selection */}
              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES_LIST.map(country => (
                      <SelectItem key={country.id} value={country.id}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Layer Selection (Same as Sidebar) */}
              <div className="space-y-3">
                <Label>Data Layer Type</Label>
                <div className="grid gap-2">
                  {layerStructure.map((layer) => {
                    const Icon = layer.icon
                    return (
                      <button
                        key={layer.id}
                        className={`flex items-center justify-start w-full h-10 text-sm px-3 border-2 rounded-md transition-all duration-200 hover:bg-primary/5 hover:border-primary/50 ${
                          selectedLayer?.id === layer.id ? 'bg-primary/15 border-primary text-primary font-medium' : 'bg-white border-border text-foreground'
                        }`}
                        onClick={() => handleLayerSelect(layer)}
                      >
                        <Icon className={`w-4 h-4 mr-3 ${selectedLayer?.id === layer.id ? 'text-primary' : layer.color}`} />
                        {layer.label}
                        {selectedLayer?.id === layer.id && (
                          <Badge variant="secondary" className="ml-auto text-xs h-5 px-2">
                            Selected
                          </Badge>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Layer Configuration Panel */}
              {selectedLayer && showSelectionPanel && (
                <div className="space-y-3 border-2 rounded-lg p-4 bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/40 shadow-md">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm text-primary flex items-center gap-2">
                      <selectedLayer.icon className="w-4 h-4" />
                      Configure {selectedLayer.label}
                    </h4>
                    <button
                      className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors"
                      onClick={() => {
                        setShowSelectionPanel(false)
                        resetLayerSelection()
                      }}
                      title="Close selection panel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Variable/Type Selection */}
                  <div className="space-y-2">
                    <Label>Variable/Type</Label>
                    <Select value={selectedSubcategory} onValueChange={setSelectedSubcategory}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select variable/type" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedLayer.subcategories?.map(sub => (
                          <SelectItem key={sub} value={sub} className="text-sm">
                            {sub}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Scenario Selection */}
                  {selectedLayer.hasScenarios && selectedSubcategory && (
                    <div className="space-y-2">
                      <Label>Scenario</Label>
                      <Select value={selectedScenario} onValueChange={setSelectedScenario}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select scenario" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedLayer.scenarios?.map(scenario => (
                            <SelectItem key={scenario} value={scenario} className="text-sm">
                              {scenario}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Year Range Selection */}
                  {selectedLayer.hasYearRanges && selectedScenario && selectedScenario !== 'Historical' && (
                    <div className="space-y-2">
                      <Label>Year Range</Label>
                      <Select value={selectedYearRange} onValueChange={setSelectedYearRange}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select year range" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedLayer.yearRanges?.map(range => (
                            <SelectItem key={range} value={range} className="text-sm">
                              {range}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Seasonality Selection */}
                  {selectedLayer.hasSeasonality && selectedScenario && (selectedScenario === 'Historical' || selectedYearRange) && (
                    <div className="space-y-2">
                      <Label>Seasonality</Label>
                      <Select value={selectedSeasonality} onValueChange={setSelectedSeasonality}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select seasonality" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedLayer.seasonality?.map(seasonality => (
                            <SelectItem key={seasonality} value={seasonality} className="text-sm">
                              {seasonality}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Season Selection */}
                  {selectedSeasonality === 'Seasonal' && (
                    <div className="space-y-2">
                      <Label>Season</Label>
                      <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select season" />
                        </SelectTrigger>
                        <SelectContent>
                          {getSeasonsForCountry(selectedCountry).map(season => (
                            <SelectItem key={season.code} value={season.code} className="text-sm">
                              {season.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* File Upload */}
              {canProceedWithUpload() && (
                <div className="space-y-2">
                  <Label>File</Label>
                  <Input
                    type="file"
                    onChange={handleFileUpload}
                    accept={selectedLayer?.id === 'energy' ? '.zip' : '.tif,.tiff'}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    {selectedLayer?.id === 'energy' && 'Accepted formats: .zip (zipped shapefile with all associated files)'}
                    {(selectedLayer?.id === 'climate' || selectedLayer?.id === 'giri') && 'Accepted formats: .tif, .tiff (raster files)'}
                  </p>
                </div>
              )}

              {uploadedFile && (
                <div className="p-3 bg-muted rounded-md">
                  <div className="flex items-center gap-2">
                    <FileIcon size={16} />
                    <span className="text-sm font-medium">{uploadedFile.name}</span>
                    <Badge variant="secondary">
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </Badge>
                  </div>
                  {!showRasterConfig && !showShapefileConfig && (
                    <Button 
                      className="mt-2 w-full" 
                      onClick={() => processFileUpload(uploadedFile)}
                      disabled={loading}
                    >
                      {loading ? 'Processing...' : 'Complete Upload'}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileIcon size={20} />
                Uploaded Files ({(files || []).length})
              </CardTitle>
              <CardDescription>
                Manage, edit, and organize your uploaded data files
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(files || []).length === 0 ? (
                <div className="text-center py-8">
                  <FileIcon size={48} className="mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No files uploaded yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(files || []).map(file => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {(file.fileType === 'energy' || file.type === 'energy_infrastructure') && (
                            <Flashlight size={16} className="text-yellow-600" />
                          )}
                          <span className="font-medium text-sm">{file.displayName || file.name}</span>
                          <Badge variant={file.status === 'active' ? 'default' : 'secondary'}>
                            {file.status}
                          </Badge>
                          <Badge variant="outline" className={(file.fileType === 'energy' || file.type === 'energy_infrastructure') ? 'bg-yellow-50 text-yellow-700' : 'bg-blue-50 text-blue-700'}>
                            {file.fileType === 'energy' || file.type === 'energy_infrastructure' ? 'Energy Infra' : 'Raster'}
                          </Badge>
                          {file.category && (
                            <Badge variant="outline">{file.category}</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {file.country ? (file.country.charAt(0).toUpperCase() + file.country.slice(1)) : 'Unknown'} • {file.size || 'Unknown size'} • {file.uploadDate ? new Date(file.uploadDate).toLocaleDateString() : 'Unknown date'}
                          {file.subcategory && ` • ${file.subcategory}`}
                          {file.scenario && ` • ${file.scenario}`}
                          {file.layerType && ` • ${file.layerType}`}
                          {file.geometryType && ` • ${file.geometryType}`}
                        </div>
                        {file.rasterStats && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Min: {file.rasterStats.min.toFixed(2)} • Max: {file.rasterStats.max.toFixed(2)} • Mean: {file.rasterStats.mean.toFixed(2)}
                          </div>
                        )}
                        {(file.fileType === 'energy' || file.type === 'energy_infrastructure') && file.wfsUrl && (
                          <div className="text-xs text-muted-foreground mt-1">
                            WFS Endpoint Available • Capacity-based Visualization
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditFile(file)}
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleFileStatus(file.id)}
                        >
                          <Eye size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteFile(file.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit File Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit File Configuration</DialogTitle>
            <DialogDescription>
              Modify the file settings and classification
            </DialogDescription>
          </DialogHeader>
          {editingConfig && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>File Name</Label>
                  <Input
                    value={editingConfig.name}
                    onChange={(e) => setEditingConfig({...editingConfig, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editingConfig.status}
                    onValueChange={(value) => setEditingConfig({...editingConfig, status: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {editingConfig.classification && (
                <div className="space-y-2">
                  <Label>Classification</Label>
                  <div className="text-sm text-muted-foreground">
                    {editingConfig.classification.classes?.length || 0} classes configured
                  </div>
                </div>
              )}
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={saveEditedFile}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Raster Configuration Modal */}
      {showRasterConfig && uploadedFile && (
        <SimpleRasterConfig
          file={uploadedFile}
          onSave={(config) => {
            processFileUpload(uploadedFile, config)
          }}
          onCancel={() => {
            setShowRasterConfig(false)
            setUploadedFile(null)
          }}
        />
      )}

      {/* Shapefile Configuration Modal */}
      {showShapefileConfig && uploadedFile && (
        <SimpleShapefileConfig
          file={uploadedFile}
          onSave={(config) => {
            processFileUpload(uploadedFile, config)
          }}
          onCancel={() => {
            setShowShapefileConfig(false)
            setUploadedFile(null)
          }}
        />
      )}
    </div>
  )
}