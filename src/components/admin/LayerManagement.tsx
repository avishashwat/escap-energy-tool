import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Database, Pencil, Trash, Eye, Download } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { SparkFallback } from '../../utils/sparkFallback'

interface LayerData {
  id: string
  name: string
  type: 'raster' | 'shapefile'
  category: string
  country: string
  files: string[]
  createdAt: number
  updatedAt: number
  status: 'active' | 'inactive' | 'processing'
}

export function LayerManagement() {
  const [layers, setLayers] = useState<any[]>([])
  
  // Load layers from storage
  useEffect(() => {
    const loadLayers = async () => {
      try {
        const data = await SparkFallback.get('uploaded-layers') as any[] | null
        if (data) {
          setLayers(data)
        }
      } catch (error) {
        console.warn('Failed to load layers:', error)
      }
    }
    loadLayers()
  }, [])
  
  // Save layers to storage when they change
  useEffect(() => {
    if (layers.length > 0) {
      SparkFallback.set('uploaded-layers', layers).catch(console.warn)
    }
  }, [layers])
  
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterCountry, setFilterCountry] = useState<string>('all')
  const [selectedLayer, setSelectedLayer] = useState<LayerData | null>(null)

  // Mock data for demonstration
  const mockLayers: LayerData[] = [
    {
      id: '1',
      name: 'Bhutan Maximum Temperature',
      type: 'raster',
      category: 'max-temp',
      country: 'bhutan',
      files: ['bhutan_max_temp_ssp1_2021-2040_annual.tif'],
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 86400000,
      status: 'active'
    },
    {
      id: '2',
      name: 'Mongolia Hydro Power Plants',
      type: 'shapefile',
      category: 'hydro-plants',
      country: 'mongolia',
      files: ['mongolia_hydro_plants.shp', 'mongolia_hydro_plants.shx', 'mongolia_hydro_plants.dbf'],
      createdAt: Date.now() - 172800000,
      updatedAt: Date.now() - 172800000,
      status: 'active'
    },
    {
      id: '3',
      name: 'Laos Flood Risk',
      type: 'raster',
      category: 'flood',
      country: 'laos',
      files: ['laos_flood_existing.tif'],
      createdAt: Date.now() - 259200000,
      updatedAt: Date.now() - 259200000,
      status: 'processing'
    }
  ]

  const displayLayers = (layers && Array.isArray(layers) && layers.length > 0) ? layers : mockLayers

  const filteredLayers = displayLayers.filter(layer => {
    const matchesSearch = layer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         layer.category.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === 'all' || layer.type === filterType
    const matchesCountry = filterCountry === 'all' || layer.country === filterCountry
    
    return matchesSearch && matchesType && matchesCountry
  })

  const handleDelete = async (layerId: string) => {
    try {
      // For now, just use mock data without persistence
      toast.success('Layer deleted successfully (demo mode)')
    } catch (error) {
      toast.error('Failed to delete layer')
    }
  }

  const handleStatusToggle = async (layerId: string) => {
    try {
      // For now, just use mock data without persistence
      toast.success('Layer status updated (demo mode)')
    } catch (error) {
      toast.error('Failed to update layer status')
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      case 'processing': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Data Layer Management
          </CardTitle>
          <CardDescription>
            View and manage all uploaded geospatial data layers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="search">Search Layers</Label>
              <Input
                id="search"
                placeholder="Search by name or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="type-filter">Filter by Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="raster">Raster</SelectItem>
                  <SelectItem value="shapefile">Shapefile</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="country-filter">Filter by Country</Label>
              <Select value={filterCountry} onValueChange={setFilterCountry}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  <SelectItem value="bhutan">Bhutan</SelectItem>
                  <SelectItem value="mongolia">Mongolia</SelectItem>
                  <SelectItem value="laos">Laos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Layers Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Uploaded Layers</CardTitle>
              <CardDescription>
                {filteredLayers.length} of {displayLayers.length} layers
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLayers.map((layer) => (
                <TableRow key={layer.id}>
                  <TableCell className="font-medium">{layer.name}</TableCell>
                  <TableCell>
                    <Badge variant={layer.type === 'raster' ? 'secondary' : 'outline'}>
                      {layer.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{layer.country}</TableCell>
                  <TableCell>{layer.category}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(layer.status)}>
                      {layer.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(layer.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => setSelectedLayer(layer)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Layer Details</DialogTitle>
                            <DialogDescription>
                              {selectedLayer?.name}
                            </DialogDescription>
                          </DialogHeader>
                          {selectedLayer && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Type</Label>
                                  <p className="text-sm">{selectedLayer.type}</p>
                                </div>
                                <div>
                                  <Label>Category</Label>
                                  <p className="text-sm">{selectedLayer.category}</p>
                                </div>
                                <div>
                                  <Label>Country</Label>
                                  <p className="text-sm capitalize">{selectedLayer.country}</p>
                                </div>
                                <div>
                                  <Label>Status</Label>
                                  <Badge className={getStatusColor(selectedLayer.status)}>
                                    {selectedLayer.status}
                                  </Badge>
                                </div>
                              </div>
                              <div>
                                <Label>Files ({selectedLayer.files.length})</Label>
                                <div className="mt-2 space-y-1">
                                  {selectedLayer.files.map((file, index) => (
                                    <p key={index} className="text-sm font-mono bg-muted p-2 rounded">
                                      {file}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleStatusToggle(layer.id)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDelete(layer.id)}
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredLayers.length === 0 && (
            <div className="text-center py-8">
              <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No layers found matching your criteria</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}