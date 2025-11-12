import { useEffect, useState, useCallback } from 'react'

interface GeospatialService {
  isConnected: boolean
  isProcessing: boolean
  processingProgress: number
  error: string | null
}

interface UploadJob {
  id: string
  fileName: string
  fileType: 'raster' | 'shapefile' | 'boundary'
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  result?: any
  error?: string
}

export function useGeospatialService() {
  const [service, setService] = useState<GeospatialService>({
    isConnected: false,
    isProcessing: false,
    processingProgress: 0,
    error: null
  })
  
  const [uploadJobs, setUploadJobs] = useState<UploadJob[]>([])
  
  // Check service health
  const checkServiceHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/geospatial/health')
      const health = await response.json()
      
      setService(prev => ({
        ...prev,
        isConnected: health.status === 'healthy',
        error: null
      }))
      
      return health.status === 'healthy'
    } catch (error) {
      setService(prev => ({
        ...prev,
        isConnected: false,
        error: 'Failed to connect to geospatial service'
      }))
      return false
    }
  }, [])
  
  // Upload and process raster file
  const uploadRaster = useCallback(async (
    file: File, 
    metadata: {
      country: string
      variable: string
      scenario?: string
      timePeriod?: string
      season?: string
      classification?: any
      styleInfo?: any
    }
  ): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('file_type', 'raster')
    formData.append('metadata', JSON.stringify(metadata))
    
    const response = await fetch('/api/geospatial/upload', {
      method: 'POST',
      body: formData
    })
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
    }
    
    const result = await response.json()
    return result.job_id
  }, [])
  
  // Upload and process shapefile
  const uploadShapefile = useCallback(async (
    file: File,
    metadata: {
      country: string
      infrastructureType?: string
      capacityField?: string
      nameField?: string
      iconType?: string
    }
  ): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('file_type', 'shapefile')
    formData.append('metadata', JSON.stringify(metadata))
    
    const response = await fetch('/api/geospatial/upload', {
      method: 'POST',
      body: formData
    })
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
    }
    
    const result = await response.json()
    return result.job_id
  }, [])
  
  // Upload boundary shapefile
  const uploadBoundary = useCallback(async (
    file: File,
    metadata: {
      country: string
      adminLevel: number
      nameField: string
    }
  ): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('file_type', 'boundary')
    formData.append('metadata', JSON.stringify(metadata))
    
    const response = await fetch('/api/geospatial/upload', {
      method: 'POST',
      body: formData
    })
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
    }
    
    const result = await response.json()
    return result.job_id
  }, [])
  
  // Get job status
  const getJobStatus = useCallback(async (jobId: string): Promise<UploadJob | null> => {
    try {
      const response = await fetch(`/api/geospatial/jobs/${jobId}`)
      if (!response.ok) return null
      
      const job = await response.json()
      return job
    } catch (error) {
      console.error('Failed to get job status:', error)
      return null
    }
  }, [])
  
  // Get available datasets
  const getAvailableDatasets = useCallback(async (country: string) => {
    try {
      const response = await fetch(`/api/geospatial/datasets/${country}`)
      if (!response.ok) throw new Error('Failed to fetch datasets')
      
      const datasets = await response.json()
      return datasets
    } catch (error) {
      console.error('Failed to get available datasets:', error)
      return { climate: [], giri: [], energy: [], boundaries: [] }
    }
  }, [])
  
  // Get WMS URL for raster layer
  const getWMSUrl = useCallback((layerName: string) => {
    const baseUrl = import.meta.env.MODE === 'production' 
      ? `${window.location.protocol}//${window.location.host}/geoserver`
      : (import.meta.env.VITE_GEOSERVER_URL || 'http://localhost:8081/geoserver')
    
    return `${baseUrl}/wms`
  }, [])
  
  // Get WFS URL for vector layer
  const getWFSUrl = useCallback((layerName: string) => {
    const baseUrl = import.meta.env.MODE === 'production' 
      ? `${window.location.protocol}//${window.location.host}/geoserver`
      : (import.meta.env.VITE_GEOSERVER_URL || 'http://localhost:8081/geoserver')
    
    return `${baseUrl}/wfs`
  }, [])
  
  // Monitor job progress via WebSocket or polling
  const monitorJob = useCallback((jobId: string, onUpdate?: (job: UploadJob) => void) => {
    let intervalId: NodeJS.Timeout
    
    const pollStatus = async () => {
      const job = await getJobStatus(jobId)
      if (job) {
        setUploadJobs(prev => {
          const existingIndex = prev.findIndex(j => j.id === jobId)
          if (existingIndex >= 0) {
            const updated = [...prev]
            updated[existingIndex] = job
            return updated
          } else {
            return [...prev, job]
          }
        })
        
        onUpdate?.(job)
        
        // Stop polling when job is complete
        if (job.status === 'completed' || job.status === 'failed') {
          clearInterval(intervalId)
        }
      }
    }
    
    // Start polling
    intervalId = setInterval(pollStatus, 1000)
    
    // Initial poll
    pollStatus()
    
    // Return cleanup function
    return () => clearInterval(intervalId)
  }, [getJobStatus])
  
  // Initialize service connection
  useEffect(() => {
    checkServiceHealth()
    
    // Check health periodically
    const healthInterval = setInterval(checkServiceHealth, 30000)
    
    return () => clearInterval(healthInterval)
  }, [checkServiceHealth])
  
  return {
    service,
    uploadJobs,
    uploadRaster,
    uploadShapefile,
    uploadBoundary,
    getJobStatus,
    getAvailableDatasets,
    getWMSUrl,
    getWFSUrl,
    monitorJob,
    checkServiceHealth
  }
}