import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, MapPin, Upload, Image as ImageIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { SparkFallback } from '../../utils/sparkFallback'

interface ShapefileAttribute {
  name: string
  type: string
  values: (string | number)[]
}

interface ShapefileConfigProps {
  files: any[]
  category: any
  country: string
  onComplete: (config: any) => void
  onBack: () => void
}

const DEFAULT_ICONS = [
  { id: 'circle', name: 'Circle', symbol: '●' },
  { id: 'square', name: 'Square', symbol: '■' },
  { id: 'triangle', name: 'Triangle', symbol: '▲' },
  { id: 'diamond', name: 'Diamond', symbol: '◆' },
  { id: 'star', name: 'Star', symbol: '★' }
]

export function ShapefileConfig({ 
  files, 
  category, 
  country, 
  onComplete, 
  onBack 
}: ShapefileConfigProps) {
  const [attributes, setAttributes] = useState<ShapefileAttribute[]>([])
  const [selectedCapacityAttribute, setSelectedCapacityAttribute] = useState<string>('')
  const [selectedIcon, setSelectedIcon] = useState<string>('circle')
  const [customIcon, setCustomIcon] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [templates, setTemplates] = useState<any>({})
  
  // Load templates from storage
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const data = await SparkFallback.get('shapefile-templates') as any | null
        if (data) {
          setTemplates(data)
        }
      } catch (error) {
        console.warn('Failed to load shapefile templates:', error)
      }
    }
    loadTemplates()
  }, [])
  
  // Save templates to storage when they change
  useEffect(() => {
    if (Object.keys(templates).length > 0) {
      SparkFallback.set('shapefile-templates', templates).catch(console.warn)
    }
  }, [templates])

  // Mock shapefile analysis - in production this would use OGR/GDAL
  const analyzeShapefile = async (files: File[]) => {
    setIsAnalyzing(true)
    
    // Simulate analysis delay
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // Mock attributes based on energy type
    const mockAttributes: Record<string, ShapefileAttribute[]> = {
      'hydro-plants': [
        { name: 'name', type: 'string', values: ['Plant A', 'Plant B', 'Plant C'] },
        { name: 'designCapacity', type: 'number', values: [100, 250, 500, 750, 1000] },
        { name: 'status', type: 'string', values: ['Operational', 'Under Construction', 'Planned'] },
        { name: 'owner', type: 'string', values: ['Government', 'Private', 'Joint Venture'] }
      ],
      'solar-plants': [
        { name: 'facilityName', type: 'string', values: ['Solar Farm 1', 'Solar Farm 2'] },
        { name: 'capacity_MW', type: 'number', values: [50, 100, 200, 300, 500] },
        { name: 'technology', type: 'string', values: ['Photovoltaic', 'Concentrated Solar Power'] },
        { name: 'yearBuilt', type: 'number', values: [2015, 2018, 2020, 2022] }
      ],
      'wind-plants': [
        { name: 'projectName', type: 'string', values: ['Wind Farm Alpha', 'Wind Farm Beta'] },
        { name: 'installedCapacity', type: 'number', values: [25, 50, 100, 150, 200] },
        { name: 'turbineCount', type: 'number', values: [10, 20, 30, 50] },
        { name: 'hubHeight', type: 'number', values: [80, 100, 120] }
      ]
    }
    
    const attrs = mockAttributes[category.id] || [
      { name: 'id', type: 'number', values: [1, 2, 3, 4, 5] },
      { name: 'name', type: 'string', values: ['Feature 1', 'Feature 2'] },
      { name: 'capacity', type: 'number', values: [100, 200, 300] }
    ]
    
    setAttributes(attrs)
    
    // Auto-select capacity attribute if available
    const capacityAttr = attrs.find(attr => 
      attr.name.toLowerCase().includes('capacity') && attr.type === 'number'
    )
    if (capacityAttr) {
      setSelectedCapacityAttribute(capacityAttr.name)
    }
    
    setIsAnalyzing(false)
  }

  const handleCustomIconUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file')
        return
      }
      if (file.size > 1024 * 1024) { // 1MB limit
        toast.error('Icon file must be smaller than 1MB')
        return
      }
      setCustomIcon(file)
      setSelectedIcon('custom')
      toast.success('Custom icon uploaded')
    }
  }

  const handleComplete = () => {
    if (!selectedCapacityAttribute) {
      toast.error('Please select an attribute for design capacity')
      return
    }
    
    const config = {
      type: 'shapefile',
      category: category.id,
      country,
      files: files.map(f => f.name),
      capacityAttribute: selectedCapacityAttribute,
      icon: selectedIcon,
      customIcon: customIcon ? {
        name: customIcon.name,
        size: customIcon.size,
        type: customIcon.type
      } : null,
      attributes,
      timestamp: Date.now()
    }
    
    onComplete(config)
  }

  useEffect(() => {
    if (files.length > 0) {
      analyzeShapefile(files)
    }
  }, [files])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Shapefile Configuration
              </CardTitle>
              <CardDescription>
                Configure point symbolization and attributes for {category.name}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={onBack} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isAnalyzing ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">Analyzing shapefile attributes...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Attributes Overview */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Available Attributes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {attributes.map((attr) => (
                    <Card key={attr.name}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{attr.name}</h4>
                          <Badge variant={attr.type === 'number' ? 'default' : 'secondary'}>
                            {attr.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {attr.type === 'number' 
                            ? `Range: ${Math.min(...attr.values as number[])} - ${Math.max(...attr.values as number[])}`
                            : `Values: ${attr.values.slice(0, 3).join(', ')}${attr.values.length > 3 ? '...' : ''}`
                          }
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Design Capacity Selection */}
              <div>
                <Label htmlFor="capacity-attribute">Design Capacity Attribute</Label>
                <Select value={selectedCapacityAttribute} onValueChange={setSelectedCapacityAttribute}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select attribute for sizing points" />
                  </SelectTrigger>
                  <SelectContent>
                    {attributes
                      .filter(attr => attr.type === 'number')
                      .map((attr) => (
                        <SelectItem key={attr.name} value={attr.name}>
                          {attr.name} ({attr.type})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  This attribute will be used to scale the size of points on the map
                </p>
              </div>

              <Separator />

              {/* Icon Selection */}
              <div>
                <Label>Point Symbol</Label>
                <div className="mt-3 space-y-4">
                  <div className="grid grid-cols-5 gap-3">
                    {DEFAULT_ICONS.map((icon) => (
                      <Button
                        key={icon.id}
                        variant={selectedIcon === icon.id ? 'default' : 'outline'}
                        className="h-16 flex flex-col gap-1"
                        onClick={() => setSelectedIcon(icon.id)}
                      >
                        <span className="text-2xl">{icon.symbol}</span>
                        <span className="text-xs">{icon.name}</span>
                      </Button>
                    ))}
                  </div>
                  
                  <div>
                    <Label htmlFor="custom-icon" className="text-sm">Or upload custom icon (PNG, max 1MB)</Label>
                    <div className="mt-2 flex items-center gap-3">
                      <Input
                        id="custom-icon"
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml"
                        onChange={handleCustomIconUpload}
                        className="file:mr-3 file:px-3 file:py-1 file:border-0 file:bg-muted file:text-sm"
                      />
                      {customIcon && (
                        <Badge variant="secondary" className="gap-1">
                          <ImageIcon className="w-3 h-3" />
                          {customIcon.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Size Preview */}
              {selectedCapacityAttribute && (
                <div>
                  <Label>Size Preview</Label>
                  <div className="mt-3 p-4 border rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-3">
                      Point sizes based on {selectedCapacityAttribute} values:
                    </p>
                    <div className="flex items-center gap-6">
                      {(() => {
                        const capacityAttr = attributes.find(a => a.name === selectedCapacityAttribute)
                        if (!capacityAttr) return null
                        
                        const values = capacityAttr.values as number[]
                        const min = Math.min(...values)
                        const max = Math.max(...values)
                        const mid = (min + max) / 2
                        
                        return [
                          { value: min, size: 8, label: 'Min' },
                          { value: mid, size: 12, label: 'Mid' },
                          { value: max, size: 16, label: 'Max' }
                        ].map(({ value, size, label }) => (
                          <div key={label} className="text-center">
                            <div 
                              className="bg-primary rounded-full mx-auto mb-1" 
                              style={{ width: size, height: size }}
                            />
                            <p className="text-xs text-muted-foreground">
                              {label}: {value}
                            </p>
                          </div>
                        ))
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onBack}>
                  Cancel
                </Button>
                <Button onClick={handleComplete} className="gap-2">
                  Complete Configuration
                  <MapPin className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}