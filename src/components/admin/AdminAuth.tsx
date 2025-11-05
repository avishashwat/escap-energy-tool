import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Eye, EyeSlash, Shield } from '@phosphor-icons/react'
import { LocalAuth } from '../../utils/localAuth'

interface AdminAuthProps {
  onAuthenticated: () => void
}

export function AdminAuth({ onAuthenticated }: AdminAuthProps) {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    // FINAL VERSION - COMPLETELY FRESH BUILD - 10:45 AM
    console.log('🎯 FINAL VERSION: AdminAuth.tsx with SparkFallback ONLY - NO GitHub Spark')
    console.log('🔄 NEW VERSION: AdminAuth.tsx loaded with SparkFallback (Cache Cleared)')
    console.log('=== LOGIN DEBUG START ===')
    console.log('Form submitted!')
    console.log('Username entered:', `"${credentials.username}"`)
    console.log('Password entered:', `"${credentials.password}"`)
    console.log('Username length:', credentials.username.length)
    console.log('Password length:', credentials.password.length)

    try {
      console.log('Login attempt with:', { username: credentials.username, password: credentials.password })
      
      // For local development: Bypass Spark authentication due to rate limiting
      // Simple credential check for demo
      console.log('Checking credentials...')
      console.log('Username match?', credentials.username === 'admin')
      console.log('Password match?', credentials.password === 'escap2024')
      
      if (credentials.username === 'admin' && credentials.password === 'escap2024') {
        console.log('✅ AdminAuth: Credentials match! Proceeding with authentication...')
        // Store auth status using localStorage
        const authData = {
          userId: 'local-admin',
          timestamp: Date.now(),
          expires: Date.now() + (60 * 60 * 1000) // 1 hour
        }
        
        console.log('🔐 AdminAuth: Storing auth data:', authData)
        console.log('🔐 AdminAuth: Session expires in minutes:', Math.ceil((authData.expires - Date.now()) / 60000))
        await LocalAuth.setAuth(authData)
        
        // Verify it was stored
        const storedData = await LocalAuth.getAuth()
        console.log('✅ AdminAuth: Verified stored auth data:', storedData)
        
        // Add alert for debugging
        setMessage('Authentication successful!')
        console.log('About to call onAuthenticated() in 1 second...')
        setTimeout(() => {
          console.log('Calling onAuthenticated()...')
          onAuthenticated()
        }, 1000)
      } else {
        console.log('❌ Invalid credentials provided')
        console.log('Expected: admin / escap2024')
        console.log('Received:', credentials.username, '/', credentials.password)
        setMessage('Invalid credentials. Please use admin/escap2024')
      }
    } catch (error) {
      console.error('❌ Authentication error:', error)
      setMessage('Authentication failed: ' + error.message)
    } finally {
      setIsLoading(false)
      console.log('=== LOGIN DEBUG END ===')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Shield size={32} className="text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Admin Access</CardTitle>
          <CardDescription>
            Enter your credentials to access the UN ESCAP Data Management Panel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={credentials.username}
                onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                required
                autoComplete="username"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  required
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                </Button>
              </div>
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Authenticating...' : 'Sign In'}
            </Button>
            
            {message && (
              <div className={`text-sm text-center p-2 rounded ${
                message.includes('successful') ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
              }`}>
                {message}
              </div>
            )}
          </form>
          
          <div className="mt-6 text-xs text-muted-foreground">
            <p><strong>Demo Credentials:</strong></p>
            <p>Username: admin</p>
            <p>Password: escap2024</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}