import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { FloppyDisk, Trash, Download, Upload, Gear, Database } from '@phosphor-icons/react'
import { SparkFallback } from '../../utils/sparkFallback'
import { toast } from 'sonner'

interface SystemSettings {
  appName: string
  organization: string
  defaultCountry: string
  defaultBasemap: string
  enableAuthentication: boolean
  maxFileSize: number
  allowedFileTypes: string[]
  dataRetentionDays: number
  autoBackup: boolean
  backupFrequency: string
  analyticsEnabled: boolean
  debugMode: boolean
  cacheEnabled: boolean
  cacheDuration: number
}

export function SystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>({
    appName: 'UN ESCAP Climate & Energy Risk Visualization',
    organization: 'United Nations ESCAP',
    defaultCountry: 'bhutan',
    defaultBasemap: 'osm',
    enableAuthentication: true,
    maxFileSize: 2000, // MB (2GB)
    allowedFileTypes: ['.tif', '.cog', '.zip', '.png', '.jpg', '.svg'],
    dataRetentionDays: 365,
    autoBackup: true,
    backupFrequency: 'weekly',
    analyticsEnabled: false,
    debugMode: false,
    cacheEnabled: true,
    cacheDuration: 24 // hours
  })
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<number | null>(null)
  const [stats, setStats] = useState({
    totalDataSize: 0,
    totalFiles: 0,
    lastBackup: null as number | null,
    cacheSize: 0
  })

  useEffect(() => {
    loadSettings()
    loadStats()
  }, [])

  const loadSettings = async () => {
    try {
      const stored = await SparkFallback.get<SystemSettings>('admin_system_settings')
      if (stored) {
        setSettings(stored)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const loadStats = async () => {
    try {
      // Calculate storage statistics
      const uploadedFiles = await SparkFallback.get<any[]>('admin_uploaded_files') || []
      const boundaryFiles = await SparkFallback.get<any[]>('admin_boundary_files') || []
      
      const totalSize = [...uploadedFiles, ...boundaryFiles].reduce((sum, file) => sum + (file.size || 0), 0)
      const totalFiles = uploadedFiles.length + boundaryFiles.length
      
      const systemStats = await SparkFallback.get<any>('admin_system_stats') || {}
      
      setStats({
        totalDataSize: totalSize,
        totalFiles: totalFiles,
        lastBackup: systemStats.lastBackup || null,
        cacheSize: systemStats.cacheSize || 0
      })
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const handleSaveSettings = async () => {
    setIsSaving(true)
    try {
      await SparkFallback.set('admin_system_settings', settings)
      setLastSaved(Date.now())
      toast.success('Settings saved successfully')
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetSettings = async () => {
    try {
      await SparkFallback.delete('admin_system_settings')
      setSettings({
        appName: 'UN ESCAP Climate & Energy Risk Visualization',
        organization: 'United Nations ESCAP',
        defaultCountry: 'bhutan',
        defaultBasemap: 'osm',
        enableAuthentication: true,
        maxFileSize: 100,
        allowedFileTypes: ['.tif', '.cog', '.zip', '.png', '.jpg', '.svg'],
        dataRetentionDays: 365,
        autoBackup: true,
        backupFrequency: 'weekly',
        analyticsEnabled: false,
        debugMode: false,
        cacheEnabled: true,
        cacheDuration: 24
      })
      setLastSaved(null)
      toast.success('Settings reset to defaults')
    } catch (error) {
      console.error('Failed to reset settings:', error)
      toast.error('Failed to reset settings')
    }
  }

  const handleBackupData = async () => {
    try {
      // Simulate backup process
      const backupData = {
        settings: settings,
        uploadedFiles: await SparkFallback.get('admin_uploaded_files') || [],
        boundaryFiles: await SparkFallback.get('admin_boundary_files') || [],
        dataLayers: await SparkFallback.get('admin_data_layers') || [],
        classifications: await SparkFallback.get('admin_classifications') || [],
        timestamp: Date.now()
      }

      // In a real implementation, this would create a downloadable backup file
      const backupJson = JSON.stringify(backupData, null, 2)
      const blob = new Blob([backupJson], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `escap-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Update backup timestamp
      await SparkFallback.set('admin_system_stats', {
        ...stats,
        lastBackup: Date.now()
      })
      
      loadStats()
      toast.success('Backup created successfully')
    } catch (error) {
      console.error('Backup failed:', error)
      toast.error('Failed to create backup')
    }
  }

  const handleClearCache = async () => {
    try {
      // In a real implementation, this would clear various caches
      await SparkFallback.set('admin_system_stats', {
        ...stats,
        cacheSize: 0
      })
      
      loadStats()
      toast.success('Cache cleared successfully')
    } catch (error) {
      console.error('Failed to clear cache:', error)
      toast.error('Failed to clear cache')
    }
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">System Settings</h2>
        <p className="text-muted-foreground">Configure application settings and system preferences</p>
      </div>

      {/* System Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>System Statistics</CardTitle>
          <CardDescription>Overview of system usage and storage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-primary">{stats.totalFiles}</div>
              <div className="text-sm text-muted-foreground">Total Files</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-secondary">{formatFileSize(stats.totalDataSize)}</div>
              <div className="text-sm text-muted-foreground">Data Storage</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-accent">
                {stats.lastBackup ? new Date(stats.lastBackup).toLocaleDateString() : 'Never'}
              </div>
              <div className="text-sm text-muted-foreground">Last Backup</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-warning">{formatFileSize(stats.cacheSize)}</div>
              <div className="text-sm text-muted-foreground">Cache Size</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Application Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Application Settings</CardTitle>
          <CardDescription>Basic application configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="app-name">Application Name</Label>
              <Input
                id="app-name"
                value={settings.appName}
                onChange={(e) => setSettings(prev => ({ ...prev, appName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organization">Organization</Label>
              <Input
                id="organization"
                value={settings.organization}
                onChange={(e) => setSettings(prev => ({ ...prev, organization: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default-country">Default Country</Label>
              <Select value={settings.defaultCountry} onValueChange={(value) => setSettings(prev => ({ ...prev, defaultCountry: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bhutan">Bhutan</SelectItem>
                  <SelectItem value="mongolia">Mongolia</SelectItem>
                  <SelectItem value="laos">Laos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="default-basemap">Default Basemap</Label>
              <Select value={settings.defaultBasemap} onValueChange={(value) => setSettings(prev => ({ ...prev, defaultBasemap: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="osm">OpenStreetMap</SelectItem>
                  <SelectItem value="satellite">Satellite</SelectItem>
                  <SelectItem value="terrain">Terrain</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Security & Access</CardTitle>
          <CardDescription>Authentication and security configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Authentication</Label>
              <div className="text-sm text-muted-foreground">Require login to access admin panel</div>
            </div>
            <Switch
              checked={settings.enableAuthentication}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enableAuthentication: checked }))}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Debug Mode</Label>
              <div className="text-sm text-muted-foreground">Enable detailed logging and error reporting</div>
            </div>
            <Switch
              checked={settings.debugMode}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, debugMode: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* File Management Settings */}
      <Card>
        <CardHeader>
          <CardTitle>File Management</CardTitle>
          <CardDescription>Configure file upload and storage settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max-file-size">Max File Size (MB)</Label>
              <Input
                id="max-file-size"
                type="number"
                value={settings.maxFileSize}
                onChange={(e) => setSettings(prev => ({ ...prev, maxFileSize: parseInt(e.target.value) || 100 }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="retention-days">Data Retention (Days)</Label>
              <Input
                id="retention-days"
                type="number"
                value={settings.dataRetentionDays}
                onChange={(e) => setSettings(prev => ({ ...prev, dataRetentionDays: parseInt(e.target.value) || 365 }))}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Allowed File Types</Label>
            <div className="flex flex-wrap gap-2">
              {settings.allowedFileTypes.map(type => (
                <Badge key={type} variant="outline">{type}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Backup & Cache Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Backup & Cache</CardTitle>
          <CardDescription>Manage data backup and caching settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto Backup</Label>
              <div className="text-sm text-muted-foreground">Automatically backup data</div>
            </div>
            <Switch
              checked={settings.autoBackup}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, autoBackup: checked }))}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="backup-frequency">Backup Frequency</Label>
              <Select value={settings.backupFrequency} onValueChange={(value) => setSettings(prev => ({ ...prev, backupFrequency: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cache-duration">Cache Duration (Hours)</Label>
              <Input
                id="cache-duration"
                type="number"
                value={settings.cacheDuration}
                onChange={(e) => setSettings(prev => ({ ...prev, cacheDuration: parseInt(e.target.value) || 24 }))}
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Caching</Label>
              <div className="text-sm text-muted-foreground">Cache map tiles and data for better performance</div>
            </div>
            <Switch
              checked={settings.cacheEnabled}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, cacheEnabled: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>System Actions</CardTitle>
          <CardDescription>Perform system maintenance and data operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSaveSettings} disabled={isSaving}>
              <FloppyDisk size={16} className="mr-2" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
            
            <Button variant="outline" onClick={handleBackupData}>
              <Download size={16} className="mr-2" />
              Create Backup
            </Button>
            
            <Button variant="outline" onClick={handleClearCache}>
              <Database size={16} className="mr-2" />
              Clear Cache
            </Button>
            
            <Button variant="destructive" onClick={handleResetSettings}>
              <Trash size={16} className="mr-2" />
              Reset to Defaults
            </Button>
          </div>
          
          {lastSaved && (
            <p className="text-sm text-muted-foreground mt-3">
              Last saved: {new Date(lastSaved).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}