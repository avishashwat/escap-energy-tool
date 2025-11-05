import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Trash, PencilSimple, Plus, FloppyDisk, X } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { SparkFallback } from '../../utils/sparkFallback'

interface DataLayer {
  id: string
  name: string
  type: 'climate' | 'giri' | 'energy'
  category: string
  description: string
  scenarios?: string[]
  yearRanges?: string[]
  seasonality?: 'annual' | 'seasonal'
  seasons?: string[]
  createdAt: number
  updatedAt: number
}

interface DataLayerManagerProps {
  onStatsUpdate: () => void
}

export function DataLayerManager({ onStatsUpdate }: DataLayerManagerProps) {
  const [layers, setLayers] = useState<DataLayer[]>([])
  const [editingLayer, setEditingLayer] = useState<DataLayer | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLayer, setNewLayer] = useState<Partial<DataLayer>>({
    type: 'climate',
    seasonality: 'annual'
  })

  useEffect(() => {
    loadLayers()
  }, [])

  const loadLayers = async () => {
    try {
      const storedLayers = await SparkFallback.get<DataLayer[]>('admin_data_layers') || []
      
      // Initialize with default layers if none exist
      if (storedLayers.length === 0) {
        const defaultLayers: DataLayer[] = [
          {
            id: 'climate_temp_max',
            name: 'Maximum Temperature',
            type: 'climate',
            category: 'Temperature',
            description: 'Daily maximum temperature data',
            scenarios: ['Historical', 'SSP1', 'SSP2', 'SSP3', 'SSP5'],
            yearRanges: ['2021-2040', '2041-2060', '2061-2080', '2081-2100'],
            seasonality: 'seasonal',
            seasons: ['Annual', 'DJF', 'MAM', 'JJA', 'SON'],
            createdAt: Date.now(),
            updatedAt: Date.now()
          },
          {
            id: 'climate_temp_min',
            name: 'Minimum Temperature',
            type: 'climate',
            category: 'Temperature',
            description: 'Daily minimum temperature data',
            scenarios: ['Historical', 'SSP1', 'SSP2', 'SSP3', 'SSP5'],
            yearRanges: ['2021-2040', '2041-2060', '2061-2080', '2081-2100'],
            seasonality: 'seasonal',
            seasons: ['Annual', 'DJF', 'MAM', 'JJA', 'SON'],
            createdAt: Date.now(),
            updatedAt: Date.now()
          },
          {
            id: 'climate_precipitation',
            name: 'Precipitation',
            type: 'climate',
            category: 'Precipitation',
            description: 'Total precipitation data',
            scenarios: ['Historical', 'SSP1', 'SSP2', 'SSP3', 'SSP5'],
            yearRanges: ['2021-2040', '2041-2060', '2061-2080', '2081-2100'],
            seasonality: 'seasonal',
            seasons: ['Annual', 'DJF', 'MAM', 'JJA', 'SON'],
            createdAt: Date.now(),
            updatedAt: Date.now()
          },
          {
            id: 'giri_flood',
            name: 'Flood Risk',
            type: 'giri',
            category: 'Hazards',
            description: 'Flood hazard risk assessment',
            scenarios: ['Existing', 'SSP1', 'SSP5'],
            createdAt: Date.now(),
            updatedAt: Date.now()
          },
          {
            id: 'giri_drought',
            name: 'Drought Risk',
            type: 'giri',
            category: 'Hazards',
            description: 'Drought hazard risk assessment',
            scenarios: ['Existing', 'SSP1', 'SSP5'],
            createdAt: Date.now(),
            updatedAt: Date.now()
          },
          {
            id: 'energy_hydro',
            name: 'Hydro Power Plants',
            type: 'energy',
            category: 'Infrastructure',
            description: 'Hydroelectric power generation facilities',
            createdAt: Date.now(),
            updatedAt: Date.now()
          },
          {
            id: 'energy_solar',
            name: 'Solar Power Plants',
            type: 'energy',
            category: 'Infrastructure',
            description: 'Solar photovoltaic power generation facilities',
            createdAt: Date.now(),
            updatedAt: Date.now()
          },
          {
            id: 'energy_wind',
            name: 'Wind Power Plants',
            type: 'energy',
            category: 'Infrastructure',
            description: 'Wind power generation facilities',
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ]
        
        await SparkFallback.set('admin_data_layers', defaultLayers)
        setLayers(defaultLayers)
      } else {
        setLayers(storedLayers)
      }
    } catch (error) {
      console.error('Failed to load layers:', error)
      toast.error('Failed to load data layers')
    }
  }

  const handleSaveLayer = async () => {
    if (!newLayer.name || !newLayer.type || !newLayer.category) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      const layer: DataLayer = {
        id: newLayer.id || `${newLayer.type}_${Date.now()}`,
        name: newLayer.name,
        type: newLayer.type as 'climate' | 'giri' | 'energy',
        category: newLayer.category,
        description: newLayer.description || '',
        scenarios: newLayer.scenarios || [],
        yearRanges: newLayer.yearRanges || [],
        seasonality: newLayer.seasonality || 'annual',
        seasons: newLayer.seasons || [],
        createdAt: newLayer.createdAt || Date.now(),
        updatedAt: Date.now()
      }

      const updatedLayers = editingLayer 
        ? layers.map(l => l.id === editingLayer.id ? layer : l)
        : [...layers, layer]

      await SparkFallback.set('admin_data_layers', updatedLayers)
      setLayers(updatedLayers)
      setNewLayer({ type: 'climate', seasonality: 'annual' })
      setEditingLayer(null)
      setShowAddForm(false)
      onStatsUpdate()
      
      toast.success(editingLayer ? 'Layer updated successfully' : 'Layer added successfully')
    } catch (error) {
      console.error('Failed to save layer:', error)
      toast.error('Failed to save layer')
    }
  }

  const handleEditLayer = (layer: DataLayer) => {
    setEditingLayer(layer)
    setNewLayer(layer)
    setShowAddForm(true)
  }

  const handleDeleteLayer = async (layerId: string) => {
    try {
      const updatedLayers = layers.filter(l => l.id !== layerId)
      await SparkFallback.set('admin_data_layers', updatedLayers)
      setLayers(updatedLayers)
      onStatsUpdate()
      toast.success('Layer deleted successfully')
    } catch (error) {
      console.error('Failed to delete layer:', error)
      toast.error('Failed to delete layer')
    }
  }

  const handleCancel = () => {
    setNewLayer({ type: 'climate', seasonality: 'annual' })
    setEditingLayer(null)
    setShowAddForm(false)
  }

  const renderLayerCard = (layer: DataLayer) => (
    <Card key={layer.id} className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{layer.name}</CardTitle>
            <CardDescription>{layer.description}</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={layer.type === 'climate' ? 'default' : layer.type === 'giri' ? 'secondary' : 'outline'}>
              {layer.type.toUpperCase()}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => handleEditLayer(layer)}>
              <PencilSimple size={16} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleDeleteLayer(layer.id)}>
              <Trash size={16} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 text-sm">
          <div><strong>Category:</strong> {layer.category}</div>
          {layer.scenarios && layer.scenarios.length > 0 && (
            <div><strong>Scenarios:</strong> {layer.scenarios.join(', ')}</div>
          )}
          {layer.seasonality && (
            <div><strong>Seasonality:</strong> {layer.seasonality}</div>
          )}
          {layer.seasons && layer.seasons.length > 0 && (
            <div><strong>Seasons:</strong> {layer.seasons.join(', ')}</div>
          )}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Data Layer Management</h2>
          <p className="text-muted-foreground">Manage climate, GIRI, and energy data layer configurations</p>
        </div>
        <Button onClick={() => setShowAddForm(true)} disabled={showAddForm}>
          <Plus size={16} className="mr-2" />
          Add Layer
        </Button>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>{editingLayer ? 'Edit Layer' : 'Add New Layer'}</CardTitle>
            <CardDescription>
              Configure the data layer settings and options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Layer Name *</Label>
                <Input
                  id="name"
                  value={newLayer.name || ''}
                  onChange={(e) => setNewLayer(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Maximum Temperature"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select 
                  value={newLayer.type} 
                  onValueChange={(value) => setNewLayer(prev => ({ ...prev, type: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="climate">Climate Variable</SelectItem>
                    <SelectItem value="giri">GIRI Variable</SelectItem>
                    <SelectItem value="energy">Energy Infrastructure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  value={newLayer.category || ''}
                  onChange={(e) => setNewLayer(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g., Temperature, Hazards, Infrastructure"
                />
              </div>
              
              {(newLayer.type === 'climate' || newLayer.type === 'giri') && (
                <div className="space-y-2">
                  <Label htmlFor="seasonality">Seasonality</Label>
                  <Select 
                    value={newLayer.seasonality} 
                    onValueChange={(value) => setNewLayer(prev => ({ ...prev, seasonality: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="annual">Annual</SelectItem>
                      <SelectItem value="seasonal">Seasonal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newLayer.description || ''}
                onChange={(e) => setNewLayer(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the data layer"
                rows={3}
              />
            </div>
            
            {(newLayer.type === 'climate' || newLayer.type === 'giri') && (
              <div className="space-y-2">
                <Label htmlFor="scenarios">Scenarios (comma-separated)</Label>
                <Input
                  id="scenarios"
                  value={newLayer.scenarios?.join(', ') || ''}
                  onChange={(e) => setNewLayer(prev => ({ 
                    ...prev, 
                    scenarios: e.target.value.split(',').map(s => s.trim()).filter(s => s) 
                  }))}
                  placeholder="e.g., Historical, SSP1, SSP2, SSP3, SSP5"
                />
              </div>
            )}
            
            {newLayer.seasonality === 'seasonal' && (
              <div className="space-y-2">
                <Label htmlFor="seasons">Seasons (comma-separated)</Label>
                <Input
                  id="seasons"
                  value={newLayer.seasons?.join(', ') || ''}
                  onChange={(e) => setNewLayer(prev => ({ 
                    ...prev, 
                    seasons: e.target.value.split(',').map(s => s.trim()).filter(s => s) 
                  }))}
                  placeholder="e.g., Annual, DJF, MAM, JJA, SON"
                />
              </div>
            )}
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={handleCancel}>
                <X size={16} className="mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSaveLayer}>
                <FloppyDisk size={16} className="mr-2" />
                {editingLayer ? 'Update' : 'Save'} Layer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Layer List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Existing Layers ({layers.length})</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {layers.map(renderLayerCard)}
        </div>
      </div>
    </div>
  )
}