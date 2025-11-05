// CSV Integration Test Component
// Created: October 6, 2025
// Purpose: Test CSV loading and matching functionality

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CSVLoader } from '../utils/csvLoader'
import { OverlayMatcher } from '../utils/overlayMatcher'

export function CSVTestComponent() {
  const [testResults, setTestResults] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  // Auto-run basic test on mount
  useEffect(() => {
    const autoTest = async () => {
      try {
        // Quick availability test
        const response = await fetch('/data/dashboard/Climate/Climate trend Bhutan.csv', { method: 'HEAD' })
        if (response.ok) {
          setTestResults(['✅ CSV files are accessible via HTTP'])
        } else {
          setTestResults(['❌ CSV files not accessible via HTTP'])
        }
      } catch (error) {
        setTestResults(['❌ CSV fetch test failed'])
      }
    }
    autoTest()
  }, [])

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const testCSVLoading = async () => {
    setIsLoading(true)
    setTestResults([])
    
    try {
      // Test 1: Load Bhutan climate data
      addResult('🧪 Testing Bhutan climate data loading...')
      const bhutanClimate = await CSVLoader.loadClimateData('Bhutan')
      addResult(`✅ Bhutan climate: ${bhutanClimate.length} rows loaded`)
      
      // Test 2: Load Mongolia climate data  
      addResult('🧪 Testing Mongolia climate data loading...')
      const mongoliaClimate = await CSVLoader.loadClimateData('Mongolia')
      addResult(`✅ Mongolia climate: ${mongoliaClimate.length} rows loaded`)
      
      // Test 3: Load GIRI data
      addResult('🧪 Testing Bhutan GIRI data loading...')
      const bhutanGiri = await CSVLoader.loadGIRIData('Bhutan')
      addResult(`✅ Bhutan GIRI: ${bhutanGiri.length} rows loaded`)
      
      // Test 4: Test overlay matching
      addResult('🧪 Testing overlay matching logic...')
      const testOverlay = {
        name: 'Precipitation',
        type: 'Climate',
        scenario: 'ssp1',
        year: '2021-2040',
        season: 'annual'
      }
      
      const match = OverlayMatcher.matchClimateOverlay(testOverlay, bhutanClimate)
      if (match) {
        addResult(`✅ Overlay match found: ${match.variable}`)
        addResult(`📊 Regional data: ${Object.keys(match.regions).length} regions`)
      } else {
        addResult('❌ No overlay match found')
      }
      
      // Test 5: Test validation
      addResult('🧪 Testing data validation...')
      const validation = await CSVLoader.validateCountryData('Bhutan')
      addResult(`✅ Validation: Climate=${validation.climate}, GIRI=${validation.giri}`)
      
      addResult('🎉 All tests completed!')
      
    } catch (error) {
      addResult(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
    
    setIsLoading(false)
  }

  return (
    <Card className="max-w-2xl mx-auto m-4">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          CSV Integration Test
          <Badge variant="outline">Debug Tool</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button 
            onClick={testCSVLoading} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Running Tests...' : 'Run CSV Tests'}
          </Button>
          
          {testResults.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h4 className="font-semibold mb-2">Test Results:</h4>
                <div className="text-sm space-y-1 max-h-96 overflow-y-auto">
                  {testResults.map((result, index) => (
                    <div key={index} className="font-mono text-xs">
                      {result}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </CardContent>
    </Card>
  )
}