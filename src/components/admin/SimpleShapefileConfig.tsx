import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MapPin, Upload, Circle } from '@phosphor-icons/react'

import { toast } from 'sonner'
import { API_ENDPOINTS } from '../../config/api'

interface SimpleShapefileConfigProps {
  file: File
  onSave: (config: any) => void
  onCancel: () => void
}

interface ShapefileAttribute {
  name: string
  type: string
}

const DEFAULT_ICONS = [
  { id: 'circle', name: 'Circle', symbol: '●', description: 'Simple circle marker' },
  { id: 'square', name: 'Square', symbol: '■', description: 'Square marker' },
  { id: 'triangle', name: 'Triangle', symbol: '▲', description: 'Triangle marker' },
  { id: 'diamond', name: 'Diamond', symbol: '◆', description: 'Diamond marker' },
  { id: 'star', name: 'Star', symbol: '★', description: 'Star marker' }
]

export function SimpleShapefileConfig({ file, onSave, onCancel }: SimpleShapefileConfigProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(true)
  const [attributes, setAttributes] = useState<ShapefileAttribute[]>([])
  const [selectedCapacityAttribute, setSelectedCapacityAttribute] = useState('')
  const [selectedIcon, setSelectedIcon] = useState('circle')
  const [customIconFile, setCustomIconFile] = useState<File | null>(null)
  const [useCustomIcon, setUseCustomIcon] = useState(false)
  const [previousConfigs, setPreviousConfigs] = useState<any[]>([])

  useEffect(() => {
    analyzeShapefile()
    loadPreviousConfigs()
  }, [])

  const analyzeShapefile = async () => {
    try {
      setIsAnalyzing(true)
      
      // Analyze the actual shapefile to get real attributes
      console.log('🔍 Analyzing shapefile attributes:', file.name)
      
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch(API_ENDPOINTS.ANALYZE_SHAPEFILE, {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (result.success && result.attributes) {
        console.log('✅ Shapefile analysis completed:', result.attributes)
        
        // Convert backend attributes to our format
        const shapefileAttributes: ShapefileAttribute[] = result.attributes.map((attr: any) => ({
          name: attr.name,
          type: attr.type === 'integer' || attr.type === 'real' || attr.type === 'double' ? 'number' : 'string'
        }))
        
        setAttributes(shapefileAttributes)
        
        // Auto-select a likely capacity attribute
        const capacityAttr = shapefileAttributes.find(attr => 
          (attr.name.toLowerCase().includes('capacity') || 
           attr.name.toLowerCase().includes('mw') || 
           attr.name.toLowerCase().includes('power') ||
           attr.name.toLowerCase().includes('output')) && 
          attr.type === 'number'
        )
        
        if (capacityAttr) {
          setSelectedCapacityAttribute(capacityAttr.name)
          console.log(`🎯 Auto-selected capacity attribute: ${capacityAttr.name}`)
        }
        
        toast.success(`✅ Found ${shapefileAttributes.length} attributes in shapefile`)
      } else {
        throw new Error('No attributes found in shapefile analysis')
      }
      
    } catch (error) {
      console.error('Failed to analyze shapefile:', error)
      toast.error('Failed to analyze shapefile: ' + error.message)
      
      // Fallback to basic attributes if analysis fails
      const fallbackAttributes: ShapefileAttribute[] = [
        { name: 'name', type: 'string' },
        { name: 'type', type: 'string' },
        { name: 'capacity', type: 'number' }
      ]
      
      setAttributes(fallbackAttributes)
      setSelectedCapacityAttribute('capacity')
      
    } finally {
      setIsAnalyzing(false)
    }
  }

  const loadPreviousConfigs = async () => {
    // Previous configurations will be retrieved from backend database in future versions
    setPreviousConfigs([])
  }

  const applyPreviousConfig = (config: any) => {
    if (config.capacityAttribute) {
      setSelectedCapacityAttribute(config.capacityAttribute)
    }
    if (config.icon) {
      setSelectedIcon(config.icon)
    }
    if (config.useCustomIcon !== undefined) {
      setUseCustomIcon(config.useCustomIcon)
    }
    toast.success('Previous configuration applied')
  }

  const handleCustomIconUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setCustomIconFile(file)
      setUseCustomIcon(true)
      toast.success('Custom icon uploaded')
    } else {
      toast.error('Please select a valid image file')
    }
  }

  const handleSave = async () => {
    if (!selectedCapacityAttribute) {
      toast.error('Please select a capacity attribute')
      return
    }

    const config = {
      capacityAttribute: selectedCapacityAttribute,
      icon: useCustomIcon ? 'custom' : selectedIcon,
      useCustomIcon,
      customIconFile: customIconFile, // Pass the actual File object
      customIconFileName: customIconFile?.name, // Also keep filename for reference
      attributes,
      type: 'shapefile'
    }

    try {
      // Configuration will be stored in backend database during upload
      console.log('🔧 Sending configuration to backend for processing:', config)
      onSave(config)
    } catch (error) {
      console.error('Failed to save configuration:', error)
      toast.error('Failed to save configuration')
    }
  }

  const getNumericAttributes = () => {
    return attributes.filter(attr => attr.type === 'number')
  }

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin size={20} />
            Configure Shapefile Display
          </DialogTitle>
          <DialogDescription>
            Set up point sizing and icon display for {file.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Analysis Status */}
          {isAnalyzing ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Analyzing shapefile attributes...</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Attributes Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Shapefile Attributes</CardTitle>
                  <CardDescription>
                    Found {attributes.length} attributes ({getNumericAttributes().length} numeric)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {attributes.slice(0, 8).map((attr) => (
                      <div key={attr.name} className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="font-medium">{attr.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {attr.type}
                        </Badge>
                      </div>
                    ))}
                    {attributes.length > 8 && (
                      <div className="text-muted-foreground">
                        +{attributes.length - 8} more attributes...
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Previous Configurations */}
              {previousConfigs.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Use Previous Configuration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {previousConfigs.map((config) => (
                        <Button
                          key={config.id}
                          variant="outline"
                          size="sm"
                          onClick={() => applyPreviousConfig(config.config)}
                        >
                          {config.fileName.split('_')[2] || 'Config'}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Capacity Attribute Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Design Capacity Attribute</CardTitle>
                  <CardDescription>
                    Select the attribute to use for point sizing based on capacity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label>Capacity Attribute</Label>
                    <Select value={selectedCapacityAttribute} onValueChange={setSelectedCapacityAttribute}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select capacity attribute" />
                      </SelectTrigger>
                      <SelectContent>
                        {getNumericAttributes().map((attr) => (
                          <SelectItem key={attr.name} value={attr.name}>
                            {attr.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedCapacityAttribute && (
                      <p className="text-xs text-muted-foreground">
                        Point sizes will be scaled based on {selectedCapacityAttribute} values
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Icon Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Point Icon</CardTitle>
                  <CardDescription>
                    Choose how points should be displayed on the map
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Icon Type Toggle */}
                  <div className="flex items-center space-x-4">
                    <Button
                      variant={!useCustomIcon ? "default" : "outline"}
                      size="sm"
                      onClick={() => setUseCustomIcon(false)}
                    >
                      <Circle size={16} className="mr-2" />
                      Default Icons
                    </Button>
                    <Button
                      variant={useCustomIcon ? "default" : "outline"}
                      size="sm"
                      onClick={() => setUseCustomIcon(true)}
                    >
                      <Upload size={16} className="mr-2" />
                      Custom Icon
                    </Button>
                  </div>

                  {/* Default Icons */}
                  {!useCustomIcon && (
                    <div className="space-y-2">
                      <Label>Select Icon Style</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {DEFAULT_ICONS.map((icon) => (
                          <button
                            key={icon.id}
                            className={`p-3 border rounded-md text-center hover:bg-muted transition-colors ${
                              selectedIcon === icon.id ? 'border-primary bg-primary/10' : 'border-border'
                            }`}
                            onClick={() => setSelectedIcon(icon.id)}
                          >
                            <div className="text-lg mb-1">{icon.symbol}</div>
                            <div className="text-xs font-medium">{icon.name}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Icon Upload */}
                  {useCustomIcon && (
                    <div className="space-y-2">
                      <Label>Upload Custom Icon</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleCustomIconUpload}
                        className="cursor-pointer"
                      />
                      {customIconFile && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>Selected: {customIconFile.name}</span>
                          <Badge variant="secondary">
                            {(customIconFile.size / 1024).toFixed(1)} KB
                          </Badge>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Upload a PNG image that will be used as the point icon (recommended size: 32x32px)
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isAnalyzing || !selectedCapacityAttribute}
          >
            Save Configuration
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}