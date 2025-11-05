import React, { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, FileText, MapPin, ChartBar, Lightning } from '@phosphor-icons/react'
import { validateFile, getUploadInstructions } from '@/utils/dataUpload'

interface DataUploadProps {
  onFileUpload: (file: File, dataType: string) => void
  className?: string
}

type DataType = 'boundary' | 'raster' | 'classification' | 'energy'

export function DataUpload({ onFileUpload, className = '' }: DataUploadProps) {
  const [selectedType, setSelectedType] = useState<DataType | null>(null)
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const dataTypes = [
    {
      id: 'boundary' as DataType,
      label: 'Country Boundaries',
      icon: MapPin,
      description: 'Administrative level 1 boundaries',
      accept: '.shp,.shx,.dbf,.prj'
    },
    {
      id: 'raster' as DataType,
      label: 'Climate/GIRI Raster',
      icon: ChartBar,
      description: 'Climate or GIRI risk data',
      accept: '.tif,.tiff'
    },
    {
      id: 'classification' as DataType,
      label: 'Data Classification',
      icon: FileText,
      description: 'Excel file with color schemes',
      accept: '.xlsx,.xls'
    },
    {
      id: 'energy' as DataType,
      label: 'Energy Infrastructure',
      icon: Lightning,
      description: 'Power plant locations',
      accept: '.shp,.shx,.dbf,.prj'
    }
  ]

  const handleTypeSelect = (type: DataType) => {
    setSelectedType(type)
    setUploadStatus({ type: 'info', message: getUploadInstructions(type) })
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0 || !selectedType) return

    const file = files[0]
    const validation = validateFile(file, selectedType === 'boundary' || selectedType === 'energy' ? 'shapefile' : selectedType)

    if (!validation.valid) {
      setUploadStatus({ type: 'error', message: validation.error || 'Invalid file' })
      return
    }

    // For shapefiles, check if all components are present
    if ((selectedType === 'boundary' || selectedType === 'energy') && files.length === 1) {
      setUploadStatus({ 
        type: 'error', 
        message: 'Please upload all shapefile components (.shp, .shx, .dbf, .prj) together' 
      })
      return
    }

    setUploadStatus({ type: 'success', message: `File "${file.name}" ready for upload` })
    onFileUpload(file, selectedType)
  }

  const triggerFileSelect = () => {
    if (!selectedType) {
      setUploadStatus({ type: 'error', message: 'Please select a data type first' })
      return
    }
    fileInputRef.current?.click()
  }

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Upload size={16} />
          Data Upload
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Data Type Selection */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Select Data Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {dataTypes.map((type) => {
              const Icon = type.icon
              return (
                <Button
                  key={type.id}
                  variant={selectedType === type.id ? 'default' : 'outline'}
                  size="sm"
                  className="h-auto p-2 flex flex-col items-center gap-1 text-xs"
                  onClick={() => handleTypeSelect(type.id)}
                >
                  <Icon size={16} />
                  <span className="text-center leading-tight">
                    {type.label}
                  </span>
                </Button>
              )
            })}
          </div>
        </div>

        {/* File Upload */}
        <div className="space-y-2">
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={triggerFileSelect}
            disabled={!selectedType}
          >
            <Upload size={14} className="mr-2" />
            Choose File
          </Button>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple={selectedType === 'boundary' || selectedType === 'energy'}
            accept={selectedType ? dataTypes.find(t => t.id === selectedType)?.accept : ''}
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Status Messages */}
        {uploadStatus && (
          <Alert className={`text-xs ${
            uploadStatus.type === 'error' ? 'border-destructive' :
            uploadStatus.type === 'success' ? 'border-accent' : 'border-border'
          }`}>
            <AlertDescription className="whitespace-pre-line text-xs leading-relaxed">
              {uploadStatus.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Quick Info */}
        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          <p className="font-medium mb-1">Quick Start:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Process your data using the scripts in /scripts/</li>
            <li>Upload processed files here</li>
            <li>Files will be integrated into the map layers</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}