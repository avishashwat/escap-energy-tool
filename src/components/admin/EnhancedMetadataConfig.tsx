import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Warning, CheckCircle, FileText, Lightning, Thermometer, Drop, Flashlight } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface LayerStructure {
  id: string
  label: string
  icon: any
  color: string
  subcategories: string[]
  hasScenarios: boolean
  scenarios?: string[]
  hasYearRanges: boolean
  yearRanges?: string[]
  hasSeasonality: boolean
  seasonality?: string[]
  seasons?: string[]
}

interface DetectedMetadata {
  country?: string
  dataType?: string
  variable?: string
  scenario?: string
  timeframe?: string
  seasonality?: string
  season?: {
    fromMonth: number
    toMonth: number
    label: string
  }
  confidence: 'high' | 'medium' | 'low'
  warnings: string[]
}

interface EnhancedMetadataConfigProps {
  file: File
  onSave: (metadata: any) => void
  onCancel: () => void
}

export function EnhancedMetadataConfig({ file, onSave, onCancel }: EnhancedMetadataConfigProps) {
  const [detectedMetadata, setDetectedMetadata] = useState<DetectedMetadata | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(true)
  const [userOverrides, setUserOverrides] = useState<Partial<DetectedMetadata>>({})

  // Layer structure matching the current system
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
      yearRanges: ['2010-2020', '2021-2040', '2041-2060', '2061-2080', '2081-2100'],
      hasSeasonality: true,
      seasonality: ['Annual', 'Seasonal'],
      seasons: ['jan_mar', 'apr_jun', 'jul_sep', 'oct_dec']
    },
    {
      id: 'giri',
      label: 'GIRI Hazards',
      icon: Drop,
      color: 'text-blue-600',
      subcategories: [
        'Flood Risk',
        'Drought Risk',
        'Coastal Flood Risk',
        'River Flood Risk'
      ],
      hasScenarios: true,
      scenarios: ['Historical', 'RCP2.6', 'RCP4.5', 'RCP6.0', 'RCP8.5'],
      hasYearRanges: true,
      yearRanges: ['2010-2020', '2021-2040', '2041-2060', '2061-2080', '2081-2100'],
      hasSeasonality: true,
      seasonality: ['Annual', 'Seasonal'],
      seasons: ['jan_mar', 'apr_jun', 'jul_sep', 'oct_dec']
    },
    {
      id: 'energy',
      label: 'Energy Systems',
      icon: Flashlight,
      color: 'text-yellow-600',
      subcategories: [
        'Solar Potential',
        'Wind Potential',
        'Hydroelectric Potential',
        'Energy Demand'
      ],
      hasScenarios: true,
      scenarios: ['Current', 'Low Growth', 'Medium Growth', 'High Growth'],
      hasYearRanges: true,
      yearRanges: ['2020-2030', '2031-2040', '2041-2050'],
      hasSeasonality: true,
      seasonality: ['Annual', 'Seasonal'],
      seasons: ['jan_mar', 'apr_jun', 'jul_sep', 'oct_dec']
    }
  ]

  const countries = [
    { id: 'bhutan', name: 'Bhutan' },
    { id: 'mongolia', name: 'Mongolia' },
    { id: 'laos', name: 'Laos' }
  ]

  useEffect(() => {
    analyzeFilename()
  }, [])

  const analyzeFilename = async () => {
    try {
      setIsAnalyzing(true)
      const metadata = await detectMetadataFromFilename(file.name)
      setDetectedMetadata(metadata)
      
      if (metadata.warnings.length > 0) {
        toast.warning(`${metadata.warnings.length} warnings detected in filename analysis`)
      } else {
        toast.success(`Metadata detected with ${metadata.confidence} confidence`)
      }
    } catch (error) {
      console.error('Failed to analyze filename:', error)
      toast.error('Failed to analyze filename for metadata')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const detectMetadataFromFilename = async (filename: string): Promise<DetectedMetadata> => {
    const warnings: string[] = []
    let confidence: 'high' | 'medium' | 'low' = 'high'
    
    // Remove file extension and convert to lowercase for analysis
    const baseName = filename.replace(/\.(tif|tiff|geotiff|asc|nc|grib|hdf)$/i, '').toLowerCase()
    
    // Split by common delimiters
    const parts = baseName.split(/[_\-\s\.]+/).filter(part => part.length > 0)
    
    const metadata: DetectedMetadata = {
      confidence,
      warnings
    }

    // Detect country
    for (const country of countries) {
      if (parts.some(part => part.includes(country.id) || part.includes(country.name.toLowerCase()))) {
        metadata.country = country.id
        break
      }
    }
    if (!metadata.country) {
      warnings.push('Country not detected from filename')
      confidence = 'medium'
    }

    // Detect data type and variable
    for (const layer of layerStructure) {
      const layerKeywords = layer.label.toLowerCase().split(' ')
      const categoryMatch = layerKeywords.some(keyword => 
        parts.some(part => part.includes(keyword))
      )
      
      if (categoryMatch) {
        metadata.dataType = layer.id
        
        // Try to match specific variables
        for (const subcategory of layer.subcategories) {
          const varKeywords = subcategory.toLowerCase().split(' ')
          const variableMatch = varKeywords.some(keyword => 
            parts.some(part => part.includes(keyword) || part.includes(keyword.replace(' ', '')))
          )
          
          if (variableMatch) {
            metadata.variable = subcategory
            break
          }
        }
        break
      }
    }

    // Enhanced variable detection
    if (!metadata.variable && metadata.dataType === 'climate') {
      if (parts.some(p => p.includes('temp') || p.includes('temperature'))) {
        if (parts.some(p => p.includes('max') || p.includes('maximum'))) {
          metadata.variable = 'Maximum Temperature'
        } else if (parts.some(p => p.includes('min') || p.includes('minimum'))) {
          metadata.variable = 'Minimum Temperature'
        } else {
          metadata.variable = 'Mean Temperature'
        }
      } else if (parts.some(p => p.includes('precip') || p.includes('rainfall'))) {
        metadata.variable = 'Precipitation'
      }
    }

    if (!metadata.dataType) {
      warnings.push('Data type not detected from filename')
      confidence = 'low'
    }
    if (!metadata.variable) {
      warnings.push('Variable not detected from filename')
      confidence = 'medium'
    }

    // Detect scenario
    const currentLayer = layerStructure.find(l => l.id === metadata.dataType)
    if (currentLayer?.scenarios) {
      for (const scenario of currentLayer.scenarios) {
        if (parts.some(part => part.includes(scenario.toLowerCase()))) {
          metadata.scenario = scenario
          break
        }
      }
    }

    // Detect seasonality
    if (parts.some(p => p.includes('annual') || p.includes('yearly'))) {
      metadata.seasonality = 'Annual'
    } else {
      metadata.seasonality = 'Annual' // Default
      warnings.push('Seasonality not detected - assuming Annual')
    }

    metadata.confidence = confidence
    metadata.warnings = warnings

    return metadata
  }

  const handleOverride = (field: keyof DetectedMetadata, value: any) => {
    setUserOverrides(prev => ({
      ...prev,
      [field]: value
    }))
    
    if (detectedMetadata && detectedMetadata[field] && detectedMetadata[field] !== value) {
      toast.warning(`Overriding detected ${field}`)
    }
  }

  const handleSave = () => {
    if (!detectedMetadata) {
      toast.error('Metadata analysis not complete')
      return
    }

    const finalMetadata = {
      ...detectedMetadata,
      ...userOverrides
    }

    if (!finalMetadata.country || !finalMetadata.dataType || !finalMetadata.variable) {
      toast.error('Country, data type, and variable are required')
      return
    }

    onSave({
      metadata: finalMetadata,
      detectionMethod: 'enhanced-auto-detection',
      userOverrides: Object.keys(userOverrides).length > 0,
      originalFilename: file.name
    })
  }

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-600'
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getConfidenceIcon = (confidence: string) => {
    switch (confidence) {
      case 'high': return <CheckCircle className="w-4 h-4" />
      case 'medium': return <Warning className="w-4 h-4" />
      case 'low': return <Warning className="w-4 h-4" />
      default: return <FileText className="w-4 h-4" />
    }
  }

  const getFinalValue = (field: keyof DetectedMetadata) => {
    return userOverrides[field] !== undefined ? userOverrides[field] : detectedMetadata?.[field]
  }

  const getFinalValueAsString = (field: keyof DetectedMetadata): string => {
    const value = getFinalValue(field)
    if (typeof value === 'string') return value || ''
    if (Array.isArray(value)) return value.join(', ')
    if (typeof value === 'object' && value !== null) {
      if ('label' in value) return value.label
      return JSON.stringify(value)
    }
    return ''
  }

  const getCurrentLayer = () => {
    const dataType = getFinalValue('dataType')
    return layerStructure.find(layer => layer.id === dataType)
  }

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightning size={20} />
            Enhanced Metadata Detection
          </DialogTitle>
          <DialogDescription>
            Auto-detected metadata from filename: {file.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {isAnalyzing ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Analyzing filename for metadata...</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {detectedMetadata && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      {getConfidenceIcon(detectedMetadata.confidence)}
                      Detection Summary
                      <Badge 
                        variant="outline" 
                        className={getConfidenceColor(detectedMetadata.confidence)}
                      >
                        {detectedMetadata.confidence} confidence
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {detectedMetadata.warnings.length > 0 && (
                      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <Warning className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <div className="text-sm">
                            <p className="font-medium text-yellow-800 mb-1">Warnings:</p>
                            <ul className="text-yellow-700 space-y-0.5">
                              {detectedMetadata.warnings.map((warning, index) => (
                                <li key={index}>• {warning}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Metadata Configuration</CardTitle>
                  <CardDescription>
                    Review and modify detected metadata. Changes will override auto-detection.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Country</Label>
                      <Select 
                        value={getFinalValueAsString('country')} 
                        onValueChange={(value) => handleOverride('country', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          {countries.map(country => (
                            <SelectItem key={country.id} value={country.id}>
                              {country.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {detectedMetadata?.country && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Detected: {countries.find(c => c.id === detectedMetadata.country)?.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label>Data Type</Label>
                      <Select 
                        value={getFinalValueAsString('dataType')} 
                        onValueChange={(value) => handleOverride('dataType', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select data type" />
                        </SelectTrigger>
                        <SelectContent>
                          {layerStructure.map(layer => (
                            <SelectItem key={layer.id} value={layer.id}>
                              {layer.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {detectedMetadata?.dataType && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Detected: {layerStructure.find(l => l.id === detectedMetadata.dataType)?.label}
                        </p>
                      )}
                    </div>
                  </div>

                  {getCurrentLayer() && (
                    <div>
                      <Label>Variable</Label>
                      <Select 
                        value={getFinalValueAsString('variable')} 
                        onValueChange={(value) => handleOverride('variable', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select variable" />
                        </SelectTrigger>
                        <SelectContent>
                          {getCurrentLayer()!.subcategories.map(variable => (
                            <SelectItem key={variable} value={variable}>
                              {variable}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {detectedMetadata?.variable && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Detected: {detectedMetadata.variable}
                        </p>
                      )}
                    </div>
                  )}

                  {getCurrentLayer()?.hasScenarios && (
                    <div>
                      <Label>Scenario</Label>
                      <Select 
                        value={getFinalValueAsString('scenario')} 
                        onValueChange={(value) => handleOverride('scenario', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select scenario" />
                        </SelectTrigger>
                        <SelectContent>
                          {getCurrentLayer()!.scenarios!.map(scenario => (
                            <SelectItem key={scenario} value={scenario}>
                              {scenario}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {detectedMetadata?.scenario && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Detected: {detectedMetadata.scenario}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isAnalyzing || !detectedMetadata}
          >
            Continue with Classification
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}