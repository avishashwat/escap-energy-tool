import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { HardDrives, Database, Archive, Trash, File } from '@phosphor-icons/react'
import { SparkFallback } from '../../utils/sparkFallback'
import { toast } from 'sonner'
import { getBoundaryStorageStats } from '@/utils/boundaryStorage'

interface StorageStats {
  boundaries: {
    totalFiles: number
    totalOriginalSize: number
    totalCompressedSize: number
    totalCompressionSaved: number
    chunkedFiles: number
    directFiles: number
  }
  rasters: {
    totalFiles: number
    totalSize: number
  }
  shapefiles: {
    totalFiles: number
    totalSize: number
  }
  totalStorage: number
  estimatedQuotaUsage: number
}

export function StorageManager() {
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStorageStats()
  }, [])

  const loadStorageStats = async () => {
    setLoading(true)
    try {
      // Get boundary storage stats
      const boundaryStats = await getBoundaryStorageStats()
      
      // Get raster stats from backend API instead of localStorage
      let rasterStats = { totalFiles: 0, totalSize: 0 }
      try {
        console.log('🔍 StorageManager: Fetching raster stats from backend API...')
        const rasterResponse = await fetch('/api/geoserver/rasters')
        if (rasterResponse.ok) {
          const rasterData = await rasterResponse.json()
          if (rasterData.success) {
            rasterStats = {
              totalFiles: rasterData.count || 0,
              totalSize: 0 // GeoServer doesn't provide file sizes easily, will be 0 for now
            }
            console.log(`✅ StorageManager: Loaded ${rasterStats.totalFiles} rasters from backend`)
          }
        } else {
          console.warn('⚠️ StorageManager: Backend raster API unavailable, using fallback')
        }
      } catch (rasterError) {
        console.warn('⚠️ StorageManager: Failed to fetch rasters from backend, using fallback:', rasterError)
      }
      
      // Get shapefile stats from localStorage (shapefiles still use old system)
      const uploadedFiles = await SparkFallback.get<any[]>('admin_uploaded_files') || []
      const shapefiles = uploadedFiles.filter(file => file.type === 'shapefile')
      const shapefileStats = {
        totalFiles: shapefiles.length,
        totalSize: shapefiles.reduce((sum, s) => sum + (s.size || 0), 0)
      }
      
      // Calculate total storage
      const totalStorage = boundaryStats.totalCompressedSize + rasterStats.totalSize + shapefileStats.totalSize
      
      // Estimate quota usage (assuming ~100MB typical quota)
      const estimatedQuotaUsage = Math.min((totalStorage / (100 * 1024 * 1024)) * 100, 100)
      
      setStats({
        boundaries: boundaryStats,
        rasters: rasterStats,
        shapefiles: shapefileStats,
        totalStorage,
        estimatedQuotaUsage
      })
    } catch (error) {
      console.error('Error loading storage stats:', error)
      toast.error('Failed to load storage statistics')
    } finally {
      setLoading(false)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStorageColor = (usage: number): string => {
    if (usage < 50) return 'bg-green-500'
    if (usage < 75) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const cleanupOrphanedData = async () => {
    try {
      // Get all keys to identify orphaned data
      const allKeys = await SparkFallback.keys()
      
      // Get valid boundary IDs
      const boundaryFiles = await SparkFallback.get<any[]>('admin_boundary_files') || []
      const validBoundaryIds = new Set(boundaryFiles.map(f => f.id))
      
      // Find orphaned boundary data
      const orphanedKeys = allKeys.filter(key => {
        if (key.startsWith('boundary_geojson_')) {
          const idPart = key.replace('boundary_geojson_', '').replace('_meta', '').replace(/_chunk_\d+$/, '')
          return !validBoundaryIds.has(idPart)
        }
        return false
      })
      
      // Delete orphaned data
      for (const key of orphanedKeys) {
        await SparkFallback.delete(key)
      }
      
      if (orphanedKeys.length > 0) {
        toast.success(`Cleaned up ${orphanedKeys.length} orphaned storage entries`)
        loadStorageStats() // Refresh stats
      } else {
        toast.success('No orphaned data found')
      }
    } catch (error) {
      console.error('Error cleaning up orphaned data:', error)
      toast.error('Failed to cleanup orphaned data')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Storage Manager</h2>
          <p className="text-muted-foreground">Monitor and manage storage usage</p>
        </div>
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Storage Manager</h2>
          <p className="text-muted-foreground">Monitor and manage storage usage</p>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Failed to load storage statistics</p>
            <Button onClick={loadStorageStats} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Storage Manager</h2>
        <p className="text-muted-foreground">Monitor and manage storage usage</p>
      </div>

      {/* Overall Storage Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <HardDrives size={20} />
            <span>Overall Storage Usage</span>
          </CardTitle>
          <CardDescription>
            Total storage used across all data types
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Total Usage</span>
            <span className="text-sm text-muted-foreground">
              {formatBytes(stats.totalStorage)} / ~100 MB
            </span>
          </div>
          <Progress 
            value={stats.estimatedQuotaUsage} 
            className="h-3"
          />
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">
              {stats.estimatedQuotaUsage.toFixed(1)}% of estimated quota used
            </span>
            <Badge variant={stats.estimatedQuotaUsage > 75 ? 'destructive' : stats.estimatedQuotaUsage > 50 ? 'secondary' : 'default'}>
              {stats.estimatedQuotaUsage > 75 ? 'High Usage' : stats.estimatedQuotaUsage > 50 ? 'Medium Usage' : 'Low Usage'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Storage Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Boundary Data */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center space-x-2">
              <Database size={16} />
              <span>Boundary Data</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Files:</span>
              <span>{stats.boundaries.totalFiles}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Storage:</span>
              <span>{formatBytes(stats.boundaries.totalCompressedSize)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Compression:</span>
              <span className="text-green-600">
                {stats.boundaries.totalCompressionSaved > 0 
                  ? `${formatBytes(stats.boundaries.totalCompressionSaved)} saved`
                  : 'N/A'
                }
              </span>
            </div>
            <div className="pt-2 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Direct Storage:</span>
                <span>{stats.boundaries.directFiles}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Chunked Storage:</span>
                <span>{stats.boundaries.chunkedFiles}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Raster Data */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center space-x-2">
              <Archive size={16} />
              <span>Raster Data</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Files:</span>
              <span>{stats.rasters.totalFiles}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Storage:</span>
              <span>{formatBytes(stats.rasters.totalSize)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Avg Size:</span>
              <span>
                {stats.rasters.totalFiles > 0 
                  ? formatBytes(stats.rasters.totalSize / stats.rasters.totalFiles)
                  : 'N/A'
                }
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Shapefile Data */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center space-x-2">
              <File size={16} />
              <span>Shapefile Data</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Files:</span>
              <span>{stats.shapefiles.totalFiles}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Storage:</span>
              <span>{formatBytes(stats.shapefiles.totalSize)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Avg Size:</span>
              <span>
                {stats.shapefiles.totalFiles > 0 
                  ? formatBytes(stats.shapefiles.totalSize / stats.shapefiles.totalFiles)
                  : 'N/A'
                }
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Storage Management Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trash size={20} />
            <span>Storage Management</span>
          </CardTitle>
          <CardDescription>
            Optimize and clean up storage usage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button onClick={loadStorageStats} variant="outline">
              <Database size={16} className="mr-2" />
              Refresh Stats
            </Button>
            <Button onClick={cleanupOrphanedData} variant="outline">
              <Trash size={16} className="mr-2" />
              Cleanup Orphaned Data
            </Button>
          </div>
          
          {stats.estimatedQuotaUsage > 75 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>High Storage Usage:</strong> Consider removing unused files or optimizing existing data to avoid storage limits.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}