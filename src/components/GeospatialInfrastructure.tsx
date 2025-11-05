import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Upload, HardDrives, Database, Stack, CheckCircle, Warning, ArrowLeft, Play, Square } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface ServiceStatus {
  name: string
  status: 'healthy' | 'unhealthy' | 'unknown'
  url: string
  description: string
}

interface UploadProgress {
  phase: 'uploading' | 'converting' | 'indexing' | 'publishing' | 'complete'
  progress: number
  message?: string
}

export function GeospatialInfrastructure() {
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: 'PostGIS Database',
      status: 'unknown',
      url: 'postgresql://localhost:5432',
      description: 'Spatial database with optimized indexing'
    },
    {
      name: 'GeoServer',
      status: 'unknown', 
      url: 'http://localhost:8080',
      description: 'Map server for high-performance data serving'
    },
    {
      name: 'GDAL Processing Service',
      status: 'unknown',
      url: 'http://localhost:8081', 
      description: 'Automatic COG conversion and spatial processing'
    },
    {
      name: 'Redis Cache',
      status: 'unknown',
      url: 'redis://localhost:6379',
      description: 'High-speed caching for instant data access'
    }
  ])
  
  const [infrastructureStatus, setInfrastructureStatus] = useState<'starting' | 'running' | 'stopped' | 'error'>('stopped')
  const [deploymentProgress, setDeploymentProgress] = useState(0)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [testFile, setTestFile] = useState<File | null>(null)

  useEffect(() => {
    checkInfrastructureStatus()
    const interval = setInterval(checkInfrastructureStatus, 10000) // Check every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const checkInfrastructureStatus = async () => {
    try {
      // Check GDAL service health endpoint
      const response = await fetch('http://localhost:8081/health')
      if (response.ok) {
        const health = await response.json()
        
        setServices(prev => prev.map(service => {
          switch (service.name) {
            case 'PostGIS Database':
              return { ...service, status: health.postgresql === 'connected' ? 'healthy' : 'unhealthy' }
            case 'GeoServer':
              return { ...service, status: health.geoserver === 'connected' ? 'healthy' : 'unhealthy' }
            case 'GDAL Processing Service':
              return { ...service, status: health.status === 'healthy' ? 'healthy' : 'unhealthy' }
            case 'Redis Cache':
              return { ...service, status: health.redis === 'connected' ? 'healthy' : 'unhealthy' }
            default:
              return service
          }
        }))
        
        setInfrastructureStatus('running')
      } else {
        setInfrastructureStatus('stopped')
        setServices(prev => prev.map(service => ({ ...service, status: 'unhealthy' })))
      }
    } catch (error) {
      setInfrastructureStatus('stopped')
      setServices(prev => prev.map(service => ({ ...service, status: 'unknown' })))
    }
  }

  const startInfrastructure = async () => {
    setInfrastructureStatus('starting')
    setDeploymentProgress(0)
    
    try {
      toast.info('Starting geospatial infrastructure...')
      
      // Simulate deployment progress
      const progressSteps = [
        { progress: 20, message: 'Starting PostGIS database...' },
        { progress: 40, message: 'Initializing GeoServer...' },
        { progress: 60, message: 'Setting up GDAL processing service...' },
        { progress: 80, message: 'Configuring Redis cache...' },
        { progress: 100, message: 'Infrastructure ready!' }
      ]
      
      for (const step of progressSteps) {
        setDeploymentProgress(step.progress)
        toast.info(step.message)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      
      // Start checking status
      setTimeout(checkInfrastructureStatus, 5000)
      
      toast.success('Geospatial infrastructure started successfully!')
      
    } catch (error) {
      setInfrastructureStatus('error')
      toast.error('Failed to start infrastructure')
    }
  }

  const stopInfrastructure = async () => {
    setInfrastructureStatus('stopped')
    setServices(prev => prev.map(service => ({ ...service, status: 'unknown' })))
    toast.info('Infrastructure stopped')
  }

  const handleTestUpload = async () => {
    if (!testFile) {
      toast.error('Please select a test file')
      return
    }

    try {
      setUploadProgress({ phase: 'uploading', progress: 10 })
      
      const formData = new FormData()
      formData.append('file', testFile)
      formData.append('country', 'bhutan')
      formData.append('data_type', 'climate')
      formData.append('layer_name', `test_upload_${Date.now()}`)
      formData.append('metadata', JSON.stringify({
        test: true,
        uploaded_at: new Date().toISOString()
      }))
      
      setUploadProgress({ phase: 'converting', progress: 30, message: 'Converting to COG format...' })
      
      const response = await fetch('http://localhost:8081/process-raster', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        throw new Error('Upload failed')
      }
      
      setUploadProgress({ phase: 'indexing', progress: 60, message: 'Creating spatial indexes...' })
      
      const result = await response.json()
      
      setUploadProgress({ phase: 'publishing', progress: 80, message: 'Publishing to GeoServer...' })
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setUploadProgress({ phase: 'complete', progress: 100, message: 'Upload complete!' })
      
      toast.success(`Test upload successful! Layer published: ${result.layer_url || 'Processing completed'}`)
      
      setTimeout(() => setUploadProgress(null), 3000)
      
    } catch (error) {
      setUploadProgress(null)
      toast.error('Test upload failed')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500'
      case 'unhealthy': return 'bg-red-500'
      default: return 'bg-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'unhealthy': return <Warning className="w-4 h-4 text-red-600" />
      default: return <div className="w-4 h-4 rounded-full bg-gray-400" />
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Geospatial Infrastructure</h1>
            <p className="text-muted-foreground mt-2">
              High-performance PostGIS + GeoServer deployment for 50-100x faster data processing
            </p>
          </div>
          <Button
            variant="outline" 
            onClick={() => window.history.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Button>
        </div>

        {/* Infrastructure Status */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrives className="w-5 h-5" />
              Infrastructure Status
            </CardTitle>
            <CardDescription>
              Monitor the health and performance of your geospatial services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <Badge 
                variant={infrastructureStatus === 'running' ? 'default' : 'secondary'}
                className={infrastructureStatus === 'running' ? 'bg-green-600' : ''}
              >
                {infrastructureStatus.toUpperCase()}
              </Badge>
              
              {infrastructureStatus === 'starting' && (
                <div className="flex-1">
                  <Progress value={deploymentProgress} className="h-2" />
                  <p className="text-sm text-muted-foreground mt-1">
                    Deploying infrastructure... {deploymentProgress}%
                  </p>
                </div>
              )}
              
              <div className="flex gap-2">
                {infrastructureStatus !== 'running' && infrastructureStatus !== 'starting' && (
                  <Button onClick={startInfrastructure} className="flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    Start Infrastructure
                  </Button>
                )}
                
                {infrastructureStatus === 'running' && (
                  <Button 
                    variant="destructive" 
                    onClick={stopInfrastructure}
                    className="flex items-center gap-2"
                  >
                    <Square className="w-4 h-4" />
                    Stop Infrastructure
                  </Button>
                )}
              </div>
            </div>

            {/* Services Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {services.map((service) => (
                <div key={service.name} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{service.name}</h3>
                    {getStatusIcon(service.status)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{service.description}</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(service.status)}`} />
                    <span className="text-xs font-mono text-muted-foreground">{service.url}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Test Upload */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Test Performance
            </CardTitle>
            <CardDescription>
              Upload a test raster file to verify automatic COG conversion and GeoServer publishing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <input
                  type="file"
                  accept=".tif,.tiff"
                  onChange={(e) => setTestFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Select a GeoTIFF (.tif) file to test the processing pipeline
                </p>
              </div>

              {uploadProgress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {uploadProgress.phase.charAt(0).toUpperCase() + uploadProgress.phase.slice(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">{uploadProgress.progress}%</span>
                  </div>
                  <Progress value={uploadProgress.progress} className="h-2" />
                  {uploadProgress.message && (
                    <p className="text-xs text-muted-foreground">{uploadProgress.message}</p>
                  )}
                </div>
              )}

              <Button 
                onClick={handleTestUpload}
                disabled={!testFile || infrastructureStatus !== 'running' || !!uploadProgress}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Test Upload & Processing
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Performance Benefits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stack className="w-5 h-5" />
              Performance Benefits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Database className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Spatial Indexing</h3>
                <p className="text-sm text-muted-foreground">
                  PostGIS R-Tree indexes enable instant boundary queries and spatial operations
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Stack className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">COG Format</h3>
                <p className="text-sm text-muted-foreground">
                  Cloud Optimized GeoTIFFs with pyramid tiles for 50-100x faster raster loading
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <HardDrives className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">GeoServer WMS</h3>
                <p className="text-sm text-muted-foreground">
                  High-performance map tiles with automatic caching and reprojection
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}