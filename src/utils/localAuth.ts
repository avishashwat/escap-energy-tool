// Pure localStorage authentication utility (no Spark dependency)
export const LocalAuth = {
  // Storage key for authentication data
  AUTH_KEY: 'escap_admin_auth',

  // Set authentication data
  async setAuth(data: any): Promise<void> {
    try {
      const authString = JSON.stringify(data)
      localStorage.setItem(this.AUTH_KEY, authString)
      console.log('✅ LocalAuth: Authentication data stored in localStorage')
    } catch (error) {
      console.error('❌ LocalAuth: Failed to store auth data:', error)
      throw error
    }
  },

  // Get authentication data
  async getAuth(): Promise<any | null> {
    try {
      const authString = localStorage.getItem(this.AUTH_KEY)
      if (authString) {
        const authData = JSON.parse(authString)
        console.log('🔍 LocalAuth: Retrieved auth data from localStorage')
        return authData
      } else {
        console.log('🔍 LocalAuth: No auth data found in localStorage')
        return null
      }
    } catch (error) {
      console.error('❌ LocalAuth: Failed to retrieve auth data:', error)
      return null
    }
  },

  // Delete authentication data
  async deleteAuth(): Promise<void> {
    try {
      localStorage.removeItem(this.AUTH_KEY)
      console.log('✅ LocalAuth: Authentication data removed from localStorage')
    } catch (error) {
      console.error('❌ LocalAuth: Failed to remove auth data:', error)
      throw error
    }
  },

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    try {
      const authData = await this.getAuth()
      if (authData && authData.expires) {
        const isValid = authData.expires > Date.now()
        console.log(`🔍 LocalAuth: Authentication check - ${isValid ? 'VALID' : 'EXPIRED'}`)
        return isValid
      }
      return false
    } catch (error) {
      console.error('❌ LocalAuth: Error checking authentication:', error)
      return false
    }
  },

  // Extend session
  async extendSession(minutes: number = 60): Promise<boolean> {
    try {
      const authData = await this.getAuth()
      if (authData && authData.expires && authData.expires > Date.now()) {
        authData.expires = Date.now() + (minutes * 60 * 1000)
        await this.setAuth(authData)
        console.log(`✅ LocalAuth: Session extended by ${minutes} minutes`)
        return true
      }
      return false
    } catch (error) {
      console.error('❌ LocalAuth: Failed to extend session:', error)
      return false
    }
  },

  // Get time remaining in session (in milliseconds)
  async getTimeRemaining(): Promise<number> {
    try {
      const authData = await this.getAuth()
      if (authData && authData.expires) {
        return Math.max(0, authData.expires - Date.now())
      }
      return 0
    } catch (error) {
      console.error('❌ LocalAuth: Error getting time remaining:', error)
      return 0
    }
  }
}

// Debug utilities using LocalAuth
export const LocalAuthDebug = {
  async checkAuth() {
    try {
      const authData = await LocalAuth.getAuth()
      const now = Date.now()
      
      if (authData && authData.expires) {
        const timeLeft = authData.expires - now
        const minutesLeft = Math.ceil(timeLeft / 60000)
        
        console.log('🔍 LocalAuth Status:')
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
    await LocalAuth.deleteAuth()
    console.log('✅ Authentication data cleared')
  },

  async extendAuth() {
    const success = await LocalAuth.extendSession(60)
    if (success) {
      console.log('✅ Authentication extended by 60 minutes')
      return this.checkAuth()
    } else {
      console.log('❌ No authentication data to extend')
      return null
    }
  }
}

// Make it globally available for browser console debugging
if (typeof window !== 'undefined') {
  (window as any).LocalAuthDebug = LocalAuthDebug
}