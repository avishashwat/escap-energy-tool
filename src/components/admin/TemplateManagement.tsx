import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { FileText, Plus, Pencil, Trash, Copy } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { SparkFallback } from '../../utils/sparkFallback'

interface Template {
  id: string
  name: string
  description: string
  type: 'classification' | 'colors' | 'shapefile-config'
  data: any
  createdAt: number
  updatedAt: number
}

export function TemplateManagement() {
  const [classificationTemplates, setClassificationTemplates] = useState<any>({})
  const [colorTemplates, setColorTemplates] = useState<any>({})
  const [shapefileTemplates, setShapefileTemplates] = useState<any>({})
  
  // Load templates from storage
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const [classificationData, colorData, shapefileData] = await Promise.all([
          SparkFallback.get('classification-templates'),
          SparkFallback.get('color-templates'),
          SparkFallback.get('shapefile-templates')
        ])
        
        if (classificationData) setClassificationTemplates(classificationData)
        if (colorData) setColorTemplates(colorData)
        if (shapefileData) setShapefileTemplates(shapefileData)
      } catch (error) {
        console.warn('Failed to load templates:', error)
      }
    }
    loadTemplates()
  }, [])
  
  // Save templates to storage when they change
  useEffect(() => {
    if (Object.keys(classificationTemplates).length > 0) {
      SparkFallback.set('classification-templates', classificationTemplates).catch(console.warn)
    }
  }, [classificationTemplates])
  
  useEffect(() => {
    if (Object.keys(colorTemplates).length > 0) {
      SparkFallback.set('color-templates', colorTemplates).catch(console.warn)
    }
  }, [colorTemplates])
  
  useEffect(() => {
    if (Object.keys(shapefileTemplates).length > 0) {
      SparkFallback.set('shapefile-templates', shapefileTemplates).catch(console.warn)
    }
  }, [shapefileTemplates])
  
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateDescription, setNewTemplateDescription] = useState('')
  const [newTemplateType, setNewTemplateType] = useState<string>('')
  const [showNewTemplateDialog, setShowNewTemplateDialog] = useState(false)

  // Mock templates for demonstration
  const mockTemplates: Template[] = [
    {
      id: '1',
      name: 'Temperature Color Scheme',
      description: 'Standard temperature classification with blue to red gradient',
      type: 'classification',
      data: {
        classifications: [
          { id: '1', min: -20, max: 0, color: '#2166ac', label: 'Very Cold' },
          { id: '2', min: 0, max: 10, color: '#67a9cf', label: 'Cold' },
          { id: '3', min: 10, max: 20, color: '#d1e5f0', label: 'Moderate' },
          { id: '4', min: 20, max: 30, color: '#fdbf6f', label: 'Warm' },
          { id: '5', min: 30, max: 45, color: '#d62728', label: 'Hot' }
        ]
      },
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 86400000
    },
    {
      id: '2',
      name: 'Precipitation Colors',
      description: 'Blue gradient for precipitation data',
      type: 'colors',
      data: {
        colors: ['#f7fbff', '#c6dbef', '#6baed6', '#2171b5', '#08306b']
      },
      createdAt: Date.now() - 172800000,
      updatedAt: Date.now() - 172800000
    },
    {
      id: '3',
      name: 'Power Plant Configuration',
      description: 'Standard configuration for power plant shapefiles',
      type: 'shapefile-config',
      data: {
        capacityAttribute: 'designCapacity',
        icon: 'circle',
        sizeRanges: [
          { min: 0, max: 100, size: 8 },
          { min: 100, max: 500, size: 12 },
          { min: 500, max: 1000, size: 16 }
        ]
      },
      createdAt: Date.now() - 259200000,
      updatedAt: Date.now() - 259200000
    }
  ]

  const allTemplates = mockTemplates

  const handleCreateTemplate = () => {
    if (!newTemplateName || !newTemplateType) {
      toast.error('Please provide template name and type')
      return
    }

    const newTemplate: Template = {
      id: crypto.randomUUID(),
      name: newTemplateName,
      description: newTemplateDescription,
      type: newTemplateType as any,
      data: {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    // Save to appropriate storage based on type
    const updateFunction = newTemplateType === 'classification' ? setClassificationTemplates :
                          newTemplateType === 'colors' ? setColorTemplates : 
                          setShapefileTemplates

    updateFunction((prev: any) => ({ ...prev, [newTemplate.id]: newTemplate }))

    setNewTemplateName('')
    setNewTemplateDescription('')
    setNewTemplateType('')
    setShowNewTemplateDialog(false)
    toast.success('Template created successfully')
  }

  const handleDeleteTemplate = (templateId: string, type: string) => {
    const updateFunction = type === 'classification' ? setClassificationTemplates :
                          type === 'colors' ? setColorTemplates : 
                          setShapefileTemplates

    updateFunction((prev: any) => {
      const updated = { ...prev }
      delete updated[templateId]
      return updated
    })

    toast.success('Template deleted successfully')
  }

  const handleDuplicateTemplate = (template: Template) => {
    const newTemplate: Template = {
      ...template,
      id: crypto.randomUUID(),
      name: `${template.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    const updateFunction = template.type === 'classification' ? setClassificationTemplates :
                          template.type === 'colors' ? setColorTemplates : 
                          setShapefileTemplates

    updateFunction((prev: any) => ({ ...prev, [newTemplate.id]: newTemplate }))

    toast.success('Template duplicated successfully')
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'classification': return 'bg-blue-100 text-blue-800'
      case 'colors': return 'bg-purple-100 text-purple-800'
      case 'shapefile-config': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Template Management
              </CardTitle>
              <CardDescription>
                Create and manage reusable templates for data configurations
              </CardDescription>
            </div>
            <Dialog open={showNewTemplateDialog} onOpenChange={setShowNewTemplateDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  New Template
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Template</DialogTitle>
                  <DialogDescription>
                    Create a reusable template for future data uploads
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="template-name">Template Name</Label>
                    <Input
                      id="template-name"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="Enter template name"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="template-type">Template Type</Label>
                    <Select value={newTemplateType} onValueChange={setNewTemplateType}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select template type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="classification">Classification Scheme</SelectItem>
                        <SelectItem value="colors">Color Palette</SelectItem>
                        <SelectItem value="shapefile-config">Shapefile Configuration</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="template-description">Description (Optional)</Label>
                    <Textarea
                      id="template-description"
                      value={newTemplateDescription}
                      onChange={(e) => setNewTemplateDescription(e.target.value)}
                      placeholder="Describe when to use this template"
                      className="mt-1"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowNewTemplateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateTemplate}>
                    Create Template
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {allTemplates.map((template) => (
          <Card key={template.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Badge className={getTypeColor(template.type)}>
                  {template.type.replace('-', ' ')}
                </Badge>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDuplicateTemplate(template)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDeleteTemplate(template.id, template.type)}
                  >
                    <Trash className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <CardTitle className="text-lg">{template.name}</CardTitle>
              {template.description && (
                <CardDescription>{template.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Template Preview */}
                {template.type === 'classification' && template.data.classifications && (
                  <div>
                    <Label className="text-sm">Color Classes</Label>
                    <div className="flex gap-1 mt-1">
                      {template.data.classifications.map((cls: any) => (
                        <div
                          key={cls.id}
                          className="w-4 h-4 rounded border"
                          style={{ backgroundColor: cls.color }}
                          title={cls.label}
                        />
                      ))}
                    </div>
                  </div>
                )}
                
                {template.type === 'colors' && template.data.colors && (
                  <div>
                    <Label className="text-sm">Color Palette</Label>
                    <div className="flex gap-1 mt-1">
                      {template.data.colors.map((color: string, index: number) => (
                        <div
                          key={index}
                          className="w-4 h-4 rounded border"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                )}
                
                {template.type === 'shapefile-config' && template.data.capacityAttribute && (
                  <div>
                    <Label className="text-sm">Configuration</Label>
                    <div className="text-sm text-muted-foreground mt-1">
                      Capacity: {template.data.capacityAttribute}<br />
                      Icon: {template.data.icon}
                    </div>
                  </div>
                )}
                
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Created: {formatDate(template.createdAt)}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {allTemplates.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No templates created yet</p>
            <Button 
              onClick={() => setShowNewTemplateDialog(true)} 
              className="mt-4 gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Your First Template
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}