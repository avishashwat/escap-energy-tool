import React, { useState, useEffect, useCallback } from 'react'
import { AdminAuth } from './admin/AdminAuth'
import { AdminPanel } from './admin/AdminPanel'
import { GeospatialInfrastructure } from './GeospatialInfrastructure'
import AutoOverlayDemo from './AutoOverlayDemo'
import { Button } from './ui/button'
import { HardDrives, Lightning } from '@phosphor-icons/react'
import { LocalAuth, LocalAuthDebug } from '../utils/localAuth'

// Make debug utility globally available
if (typeof window !== 'undefined') {
  (window as any).LocalAuthDebug = LocalAuthDebug
}

export function AdminApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showInfrastructure, setShowInfrastructure] = useState(false)
  const [showAutoOverlay, setShowAutoOverlay] = useState(false)

  useEffect(() => {
    checkExistingAuth()
  }, [])

  // Extend session on user activity
  const extendSession = useCallback(async () => {
    try {
      const success = await LocalAuth.extendSession(60)
      if (success) {
        console.log('✅ Session extended for 60 more minutes')
      }
    } catch (error) {
      console.error('❌ Failed to extend session:', error)
    }
  }, [])

  // Set up activity listeners to extend session
  useEffect(() => {
    if (!isAuthenticated) return

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    let activityTimer: NodeJS.Timeout

    const handleActivity = () => {
      // Debounce activity - only extend session once per minute
      clearTimeout(activityTimer)
      activityTimer = setTimeout(() => {
        extendSession()
      }, 60000) // Wait 1 minute before extending
    }

    // Add event listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, true)
    })

    // Also check session validity every 30 seconds
    const sessionChecker = setInterval(async () => {
      try {
        const isAuthenticated = await LocalAuth.isAuthenticated()
        if (!isAuthenticated) {
          console.log('❌ Session expired, redirecting to login')
          setIsAuthenticated(false)
          await LocalAuth.deleteAuth()
        }
      } catch (error) {
        console.error('❌ Session check failed:', error)
      }
    }, 30000)

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity, true)
      })
      clearTimeout(activityTimer)
      clearInterval(sessionChecker)
    }
  }, [isAuthenticated, extendSession])

  const checkExistingAuth = async () => {
    try {
      console.log('🔍 AdminApp: Checking existing authentication...')
      console.log('🔍 AdminApp: Using LocalAuth for admin authentication check')
      
      // Add a small delay to ensure storage is ready
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const authData = await LocalAuth.getAuth()
      console.log('🔍 AdminApp: Retrieved auth data:', authData)
      
      if (authData && authData.expires) {
        const timeLeft = authData.expires - Date.now()
        console.log('🔍 AdminApp: Time left in session:', Math.ceil(timeLeft / 60000), 'minutes')
        
        if (timeLeft > 0) {
          console.log('✅ AdminApp: Found valid auth data, auto-authenticating')
          setIsAuthenticated(true)
          
          // Extend session since user is accessing admin again
          await LocalAuth.extendSession(60)
          console.log('✅ AdminApp: Session extended on admin access')
        } else {
          console.log('❌ AdminApp: Auth data expired, cleaning up')
          await LocalAuth.deleteAuth()
          setIsAuthenticated(false)
        }
      } else {
        console.log('❌ AdminApp: No valid auth data found')
        setIsAuthenticated(false)
      }
    } catch (error) {
      console.error('❌ AdminApp: Auth check failed:', error)
      setIsAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }

  const handleAuthenticated = () => {
    setIsAuthenticated(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AdminAuth onAuthenticated={handleAuthenticated} />
  }

  if (showInfrastructure) {
    return (
      <div>
        <div className="fixed top-4 right-4 z-50">
          <Button
            variant="outline"
            onClick={() => setShowInfrastructure(false)}
            className="flex items-center gap-2"
          >
            <HardDrives className="w-4 h-4" />
            Back to Admin Panel
          </Button>
        </div>
        <GeospatialInfrastructure />
      </div>
    )
  }

  if (showAutoOverlay) {
    return (
      <div>
        <div className="fixed top-4 right-4 z-50">
          <Button
            variant="outline"
            onClick={() => setShowAutoOverlay(false)}
            className="flex items-center gap-2"
          >
            <Lightning className="w-4 h-4" />
            Back to Admin Panel
          </Button>
        </div>
        <AutoOverlayDemo />
      </div>
    )
  }

  return (
    <AdminPanel />
  )
}