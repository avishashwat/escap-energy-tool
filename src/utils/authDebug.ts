import { SparkFallback } from './sparkFallback'

// Debug utilities for authentication testing
export const AuthDebug = {
  async checkAuth() {
    try {
      const authData = await SparkFallback.get('admin_authenticated') as { expires?: number } | null
      const now = Date.now()
      
      if (authData && authData.expires) {
        const timeLeft = authData.expires - now
        const minutesLeft = Math.ceil(timeLeft / 60000)
        
        console.log('🔍 Authentication Status:')
        console.log('  - Authenticated:', timeLeft > 0)
        console.log('  - Time left:', minutesLeft, 'minutes')
        console.log('  - Expires at:', new Date(authData.expires).toLocaleTimeString())
        console.log('  - Raw data:', authData)
        
        return {
          isAuthenticated: timeLeft > 0,
          timeLeft: timeLeft,
          minutesLeft: minutesLeft,
          data: authData
        }
      } else {
        console.log('❌ No authentication data found')
        return {
          isAuthenticated: false,
          timeLeft: 0,
          minutesLeft: 0,
          data: null
        }
      }
    } catch (error) {
      console.error('❌ Error checking auth:', error)
      return null
    }
  },

  async clearAuth() {
    try {
      await SparkFallback.delete('admin_authenticated')
      console.log('✅ Authentication data cleared')
    } catch (error) {
      console.error('❌ Error clearing auth:', error)
    }
  },

  async extendAuth() {
    try {
      const authData = await SparkFallback.get('admin_authenticated') as { expires?: number } | null
      if (authData && authData.expires) {
        const updatedAuthData = {
          ...authData,
          expires: Date.now() + (60 * 60 * 1000) // Extend by 1 hour
        }
        await SparkFallback.set('admin_authenticated', updatedAuthData)
        console.log('✅ Authentication extended by 1 hour')
        return this.checkAuth()
      } else {
        console.log('❌ No authentication data to extend')
        return null
      }
    } catch (error) {
      console.error('❌ Error extending auth:', error)
      return null
    }
  }
}

// Make it globally available for browser console debugging
if (typeof window !== 'undefined') {
  (window as any).AuthDebug = AuthDebug
}