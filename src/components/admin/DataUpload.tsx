import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { CloudArrowUp, File, MapPin, Image as ImageIcon, Palette, Database } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { RasterClassificationConfig } from './RasterClassificationConfig'
import { ShapefileConfig } from './ShapefileConfig'
import { TemplateSelector } from './TemplateSelector'
import { SparkFallback } from '../../utils/sparkFallback'
import { COUNTRIES_LIST } from '@/constants/countries'

interface UploadedFile {
  id: string
  name: string
  type: 'raster' | 'shapefile'
  size: number
  lastModified: number
  file: File
}

interface DataCategory {
  id: string
  name: string
  type: 'climate' | 'giri' | 'energy'
}

const DATA_CATEGORIES: DataCategory[] = [
  // Climate Variables
  { id: 'max-temp', name: 'Maximum Temperature', type: 'climate' },
  { id: 'min-temp', name: 'Minimum Temperature', type: 'climate' },
  { id: 'mean-temp', name: 'Mean Temperature', type: 'climate' },
  { id: 'precipitation', name: 'Precipitation', type: 'climate' },
  { id: 'solar-radiation', name: 'Solar Radiation', type: 'climate' },
  { id: 'cooling-degree-days', name: 'Cooling Degree Days', type: 'climate' },
  { id: 'heating-degree-days', name: 'Heating Degree Days', type: 'climate' },
  
  // GIRI Variables
  { id: 'flood', name: 'Flood', type: 'giri' },
  { id: 'drought', name: 'Drought', type: 'giri' },
  
  // Energy Infrastructure
  { id: 'hydro-plants', name: 'Hydro Power Plants', type: 'energy' },
  { id: 'solar-plants', name: 'Solar Power Plants', type: 'energy' },
  { id: 'wind-plants', name: 'Wind Power Plants', type: 'energy' }
]

export function DataUpload() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [selectedCountry, setSelectedCountry] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [isUploading, setIsUploading] = useState(false)
  const [currentStep, setCurrentStep] = useState<'upload' | 'config' | 'review'>('upload')
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Store processed files and their configurations
  const [processedData, setProcessedData] = useState<Record<string, any>>({})
  
  // Load data from storage on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await SparkFallback.get('admin-processed-data') as Record<string, any> | null
        if (data) {
          setProcessedData(data)
        }
      } catch (error) {
        console.warn('Failed to load processed data:', error)
      }
    }
    loadData()
  }, [])
  
  // Save data to storage when it changes
  useEffect(() => {
    if (Object.keys(processedData).length > 0) {
      SparkFallback.set('admin-processed-data', processedData).catch(error => {
        console.warn('Failed to save processed data:', error)
      })
    }
  }, [processedData])

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    
    if (files.length === 0) return

    const newFiles: UploadedFile[] = files.map(file => {
      const fileName = file.name.toLowerCase()
      let type: 'raster' | 'shapefile'
      
      if (fileName.endsWith('.tif') || fileName.endsWith('.tiff')) {
        type = 'raster'
      } else if (fileName.endsWith('.zip') || fileName.endsWith('.shp')) {
        type = 'shapefile'
      } else {
        type = 'shapefile' // Default for other shapefile components
      }
      
      return {
        id: crypto.randomUUID(),
        name: file.name,
        type,
        size: file.size,
        lastModified: file.lastModified,
        file
      }
    })

    setUploadedFiles(newFiles)
    toast.success(`${files.length} file(s) selected for upload`)
  }, [])

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
  }, [])

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    const files = Array.from(event.dataTransfer.files)
    
    if (files.length === 0) return

    const newFiles: UploadedFile[] = files.map(file => {
      const fileName = file.name.toLowerCase()
      let type: 'raster' | 'shapefile'
      
      if (fileName.endsWith('.tif') || fileName.endsWith('.tiff')) {
        type = 'raster'
      } else if (fileName.endsWith('.zip') || fileName.endsWith('.shp')) {
        type = 'shapefile'
      } else {
        type = 'shapefile' // Default for other shapefile components
      }
      
      return {
        id: crypto.randomUUID(),
        name: file.name,
        type,
        size: file.size,
        lastModified: file.lastModified,
        file
      }
    })

    setUploadedFiles(newFiles)
    toast.success(`${files.length} file(s) dropped for upload`)
  }, [])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const canProceedToConfig = () => {
    return uploadedFiles.length > 0 && selectedCountry && selectedCategory
  }

  const handleProceedToConfig = () => {
    if (!canProceedToConfig()) {
      toast.error('Please select files, country, and data category')
      return
    }
    setCurrentStep('config')
  }

  const handleConfigComplete = async (config: any) => {
    try {
      // Store the configuration in the processed data
      const currentData = processedData || {}
      const countryData = currentData[selectedCountry] || {}
      
      const updatedProcessedData = {
        ...currentData,
        [selectedCountry]: {
          ...countryData,
          [selectedCategory]: config
        }
      }
      
      await setProcessedData(updatedProcessedData)
      
      console.log('Configuration completed and saved:', config)
      toast.success('Configuration saved successfully')
      setCurrentStep('review')
    } catch (error) {
      console.error('Failed to save configuration:', error)
      toast.error('Failed to save configuration')
    }
  }

  const selectedCategoryInfo = DATA_CATEGORIES.find(cat => cat.id === selectedCategory)
  const isRasterData = selectedCategoryInfo?.type === 'climate' || selectedCategoryInfo?.type === 'giri'
  const isShapefileData = selectedCategoryInfo?.type === 'energy'

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
            currentStep === 'upload' ? 'bg-primary text-primary-foreground' : 
            'bg-muted text-muted-foreground'
          }`}>
            1
          </div>
          <span className={currentStep === 'upload' ? 'font-medium' : 'text-muted-foreground'}>
            Upload Files
          </span>
          
          <div className="w-12 h-px bg-border" />
          
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
            currentStep === 'config' ? 'bg-primary text-primary-foreground' : 
            'bg-muted text-muted-foreground'
          }`}>
            2
          </div>
          <span className={currentStep === 'config' ? 'font-medium' : 'text-muted-foreground'}>
            Configuration
          </span>
          
          <div className="w-12 h-px bg-border" />
          
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
            currentStep === 'review' ? 'bg-primary text-primary-foreground' : 
            'bg-muted text-muted-foreground'
          }`}>
            3
          </div>
          <span className={currentStep === 'review' ? 'font-medium' : 'text-muted-foreground'}>
            Review & Deploy
          </span>
        </div>
      </div>

      {/* Step Content */}
      {currentStep === 'upload' && (
        <div className="space-y-6">
          {/* File Upload Area */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CloudArrowUp className="w-5 h-5" />
                Upload Geospatial Files
              </CardTitle>
              <CardDescription>
                Upload TIF raster files or ZIP files containing shapefiles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <CloudArrowUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Drop files here or click to browse</p>
                <p className="text-sm text-muted-foreground">
                  Supports TIF/TIFF raster files and ZIP files containing shapefiles
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".tif,.tiff,.zip"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </CardContent>
          </Card>

          {/* Selected Files */}
          {uploadedFiles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Selected Files</CardTitle>
                <CardDescription>
                  {uploadedFiles.length} file(s) ready for upload
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {uploadedFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {file.type === 'raster' ? (
                          <ImageIcon className="w-5 h-5 text-blue-500" />
                        ) : (
                          <MapPin className="w-5 h-5 text-green-500" />
                        )}
                        <div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(file.size)} • {file.type}
                          </p>
                        </div>
                      </div>
                      <Badge variant={file.type === 'raster' ? 'secondary' : 'outline'}>
                        {file.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metadata Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Country Selection</CardTitle>
                <CardDescription>
                  Select the country for this dataset
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                  <SelectTrigger>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data Category</CardTitle>
                <CardDescription>
                  Select the type of data being uploaded
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select data category" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      Climate Variables
                    </div>
                    {DATA_CATEGORIES.filter(cat => cat.type === 'climate').map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                    <Separator className="my-1" />
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      GIRI Variables
                    </div>
                    {DATA_CATEGORIES.filter(cat => cat.type === 'giri').map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                    <Separator className="my-1" />
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      Energy Infrastructure
                    </div>
                    {DATA_CATEGORIES.filter(cat => cat.type === 'energy').map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end">
            <Button 
              onClick={handleProceedToConfig} 
              disabled={!canProceedToConfig()}
              className="gap-2"
            >
              Proceed to Configuration
              <Database className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {currentStep === 'config' && (
        <div className="space-y-6">
          {isRasterData && selectedCategoryInfo && (
            <RasterClassificationConfig
              files={uploadedFiles}
              category={selectedCategoryInfo}
              country={selectedCountry}
              onComplete={handleConfigComplete}
              onBack={() => setCurrentStep('upload')}
            />
          )}
          
          {isShapefileData && selectedCategoryInfo && (
            <ShapefileConfig
              files={uploadedFiles}
              category={selectedCategoryInfo}
              country={selectedCountry}
              onComplete={handleConfigComplete}
              onBack={() => setCurrentStep('upload')}
            />
          )}
        </div>
      )}

      {currentStep === 'review' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Review & Deploy</CardTitle>
              <CardDescription>
                Review your configuration and deploy the data layer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">Review and deployment functionality coming soon...</p>
                <div className="mt-4">
                  <Button onClick={() => setCurrentStep('upload')} variant="outline">
                    Back to Upload
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}