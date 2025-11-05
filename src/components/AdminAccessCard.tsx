import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Gear, Upload, Database, Key } from '@phosphor-icons/react'

export function AdminAccessCard() {
  const handleAccessAdmin = () => {
    // Add admin parameter to URL
    const currentUrl = new URL(window.location.href)
    currentUrl.searchParams.set('admin', 'true')
    window.location.href = currentUrl.toString()
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 border-primary/20 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Gear size={20} className="text-primary" />
            <CardTitle className="text-sm">Admin Panel</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">Owner Access</Badge>
        </div>
        <CardDescription className="text-xs">
          Manage data layers, upload files, and configure system settings
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="flex flex-col items-center space-y-1">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Upload size={16} className="text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">Upload Files</span>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <div className="p-2 bg-secondary/10 rounded-lg">
                <Database size={16} className="text-secondary" />
              </div>
              <span className="text-xs text-muted-foreground">Manage Data</span>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Key size={16} className="text-accent" />
              </div>
              <span className="text-xs text-muted-foreground">Settings</span>
            </div>
          </div>
          
          <Button onClick={handleAccessAdmin} className="w-full" size="sm">
            <Gear size={14} className="mr-2" />
            Access Admin Panel
          </Button>
          
          <div className="text-xs text-muted-foreground">
            <p><strong>Demo Credentials:</strong></p>
            <p>Username: admin | Password: escap2024</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}