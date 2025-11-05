import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { SignOut, Database, Upload, MapPin, Gear, ArrowLeft, Globe, Flashlight, Shield } from '@phosphor-icons/react'
import { toast } from 'sonner'
// import { DataLayerManager } from './DataLayerManager' // Hidden for now
import { FileUploadManager } from './FileUploadManager'
import { HybridBoundaryManager } from './HybridBoundaryManager'
// import { SystemSettings } from './SystemSettings' // Hidden for now
import { LocalAuth } from '../../utils/localAuth'
import { API_ENDPOINTS } from '@/config/api'

export function AdminPanel() {
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState({
    totalRasters: 0,
    totalShapefiles: 0,
    totalBoundaries: 0,
    totalCountries: 3
  })
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number>(0)

  useEffect(() => {
    loadUserInfo()
    // Add a small delay to ensure storage operations are complete
    setTimeout(() => {
      loadStats()
    }, 100)

    // Reload stats when the window gains focus (user comes back from map)
    const handleFocus = () => {
      console.log('🔍 DEBUG - Window gained focus, reloading stats...')
      setTimeout(() => {
        loadStats()
      }, 100)
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  // Track session time remaining
  useEffect(() => {
    const updateSessionTime = async () => {
      try {
        const timeLeft = await LocalAuth.getTimeRemaining()
        setSessionTimeLeft(timeLeft)
      } catch (error) {
        setSessionTimeLeft(0)
      }
    }

    // Update immediately
    updateSessionTime()
    
    // Update every 30 seconds
    const interval = setInterval(updateSessionTime, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const loadUserInfo = async () => {
    try {
      // Since we're not using Spark, just set fallback user data
      setUser({
        name: 'Admin User',
        login: 'admin',
        avatar_url: null,
        avatarUrl: null
      })
    } catch (error) {
      console.warn('Failed to load user info, using fallback:', error)
      // Provide fallback user data
      setUser({
        name: 'Admin User',
        login: 'admin',
        avatar_url: null,
        avatarUrl: null
      })
    }
  }

  const loadStats = async () => {
    try {
      console.log('🔍 DEBUG - AdminPanel loadStats called')
      
      // Load rasters from backend API instead of localStorage
      let rasters: any[] = []
      try {
        console.log('🔍 DEBUG - Fetching rasters from backend API...')
        const rasterResponse = await fetch(API_ENDPOINTS.rasters)
        if (rasterResponse.ok) {
          const rasterData = await rasterResponse.json()
          if (rasterData.success) {
            rasters = rasterData.rasters || []
            console.log(`✅ AdminPanel: Loaded ${rasters.length} rasters from backend`)
          }
        } else {
          console.warn('⚠️ AdminPanel: Raster API unavailable, using fallback')
        }
      } catch (rasterError) {
        console.warn('⚠️ AdminPanel: Failed to fetch rasters from backend:', rasterError)
      }
      
      // Load energy infrastructure shapefiles from GeoServer API (direct communication)
      let energyShapefiles: any[] = []
      try {
        console.log('🔍 DEBUG - Fetching energy infrastructure from GeoServer API...')
        const energyResponse = await fetch(`${API_ENDPOINTS.geoserver}/energy-infrastructure`)
        if (energyResponse.ok) {
          const energyData = await energyResponse.json()
          console.log('🔍 DEBUG - Energy infrastructure API response:', energyData)
          
          if (energyData.success && Array.isArray(energyData.data)) {
            energyShapefiles = energyData.data
            console.log('✅ DEBUG - Loaded energy shapefiles from GeoServer:', energyShapefiles.length)
          } else {
            console.warn('⚠️ Energy infrastructure API returned unexpected format:', energyData)
            energyShapefiles = []
          }
        } else {
          console.warn('⚠️ Energy infrastructure API unavailable:', energyResponse.status, energyResponse.statusText)
          energyShapefiles = []
        }
      } catch (energyError) {
        console.warn('⚠️ AdminPanel: Failed to fetch energy infrastructure from backend:', energyError)
        energyShapefiles = []
      }
      
      console.log('🔍 DEBUG - Loaded files summary:', {
        total: rasters.length + energyShapefiles.length,
        rasters: rasters.length,
        energyShapefiles: energyShapefiles.length
      })
      
      // SERVER-DRIVEN: Load boundaries ONLY from GeoServer API (source of truth)
      let boundaries: any[] = []
      try {
        console.log('🔍 DEBUG - Fetching boundaries from GeoServer API...')
        const response = await fetch(API_ENDPOINTS.boundaries)
        if (response.ok) {
          const geoserverData = await response.json()
          console.log('🔍 DEBUG - GeoServer API response:', geoserverData)
          
          if (geoserverData.success && Array.isArray(geoserverData.boundaries)) {
            boundaries = geoserverData.boundaries
            console.log('🔍 DEBUG - Loaded boundaries from server:', boundaries.length)
          } else {
            console.warn('⚠️ GeoServer API returned unexpected format:', geoserverData)
            boundaries = []
          }
        } else {
          console.error('❌ GeoServer API unavailable:', response.status, response.statusText)
          boundaries = []
        }
      } catch (error) {
        console.error('❌ GeoServer API error:', error)
        boundaries = []
      }
      
      console.log('🔍 DEBUG - AdminPanel stats loaded:', { 
        rasters: rasters.length, 
        energyShapefiles: energyShapefiles.length, 
        boundaries: boundaries.length 
      })
      
      setStats({
        totalRasters: rasters.length,
        totalShapefiles: energyShapefiles.length,
        totalBoundaries: boundaries.length,
        totalCountries: 3
      })
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const handleBackToApp = async () => {
    try {
      // Extend session when navigating back to main app
      const success = await LocalAuth.extendSession(60)
      if (success) {
        console.log('✅ Extending session before returning to main app')
      }
    } catch (error) {
      console.error('❌ Error extending session:', error)
    }
    
    // Remove admin parameter and redirect to main app
    const url = new URL(window.location.href)
    url.searchParams.delete('admin')
    url.pathname = url.pathname.replace('/admin', '')
    window.location.href = url.toString()
  }

  const handleSignOut = async () => {
    try {
      await LocalAuth.deleteAuth()
      toast.success('Signed out successfully')
      window.location.reload()
    } catch (error) {
      console.error('Sign out error:', error)
      toast.error('Failed to sign out')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Database size={24} className="text-primary" />
              <h1 className="text-xl font-semibold">UN ESCAP Data Management</h1>
            </div>
            <Badge variant="secondary">Admin Panel</Badge>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={handleBackToApp} className="flex items-center gap-2">
              <Globe size={16} />
              Back to Map
            </Button>
            <Button variant="ghost" size="sm" onClick={loadStats} className="flex items-center gap-2">
              🔄 Refresh Stats
            </Button>
            {user && (
              <div className="flex items-center space-x-3 text-sm">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield size={16} className="text-primary" />
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Welcome, {user.login}</span>
                  {sessionTimeLeft > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Session: {Math.ceil(sessionTimeLeft / 60000)}min left
                    </span>
                  )}
                </div>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <SignOut size={16} className="mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        {/* Stats Overview */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Rasters</p>
                  <p className="text-2xl font-bold">{stats.totalRasters}</p>
                </div>
                <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <MapPin size={16} className="text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Energy Infrastructure</p>
                  <p className="text-2xl font-bold">{stats.totalShapefiles}</p>
                </div>
                <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Flashlight size={16} className="text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Boundaries</p>
                  <p className="text-2xl font-bold">{stats.totalBoundaries}</p>
                </div>
                <div className="h-8 w-8 bg-accent/10 rounded-full flex items-center justify-center">
                  <Database size={16} className="text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Countries</p>
                  <p className="text-2xl font-bold">{stats.totalCountries}</p>
                </div>
                <div className="h-8 w-8 bg-warning/10 rounded-full flex items-center justify-center">
                  <Gear size={16} className="text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="upload" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">File Upload</TabsTrigger>
            <TabsTrigger value="boundaries">Boundaries</TabsTrigger>
          </TabsList>
          
          {/* Hidden sections - will be implemented later */}
          {/* 
          <TabsContent value="layers" className="space-y-4">
            <DataLayerManager onStatsUpdate={loadStats} />
          </TabsContent>
          */}
          
          <TabsContent value="upload" className="space-y-4">
            <FileUploadManager onStatsUpdate={loadStats} />
          </TabsContent>
          
          <TabsContent value="boundaries" className="space-y-4">
            <HybridBoundaryManager onStatsUpdate={loadStats} />
          </TabsContent>
          
          {/* 
          <TabsContent value="settings" className="space-y-4">
            <SystemSettings />
          </TabsContent>
          */}
        </Tabs>
      </div>
    </div>
  )
}