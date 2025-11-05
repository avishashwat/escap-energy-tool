import { useEffect, useState } from 'react'
import { SparkFallback } from '../utils/sparkFallback'

interface CountryData {
  temperature: {
    current: number
    trend: string
    extremeRisk: string
  }
  precipitation: {
    current: number
    trend: string
    droughtRisk: string
  }
  energyInfrastructure: {
    hydroPlants: number
    solarPlants: number
    windPlants: number
    vulnerabilityScore: number
  }
}

export function useMockData() {
  const [countryRiskData, setCountryRiskData] = useState<Record<string, CountryData>>({})
  
  // Load data from storage on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await SparkFallback.get('country-risk-data') as Record<string, CountryData> | null
        if (data && Object.keys(data).length > 0) {
          setCountryRiskData(data)
          return
        }
      } catch (error) {
        console.warn('Failed to load country risk data:', error)
      }
      
      // Initialize with mock data if no existing data
      initializeMockData()
    }
    
    loadData()
  }, [])
  
  // Save data to storage when it changes
  useEffect(() => {
    if (Object.keys(countryRiskData).length > 0) {
      SparkFallback.set('country-risk-data', countryRiskData).catch(error => {
        console.warn('Failed to save country risk data:', error)
      })
    }
  }, [countryRiskData])
  
  const initializeMockData = () => {
      const mockData: Record<string, CountryData> = {
        bhutan: {
          temperature: {
            current: 15.2,
            trend: '+2.8°C by 2050',
            extremeRisk: 'medium'
          },
          precipitation: {
            current: 1245,
            trend: '+15% by 2050',
            droughtRisk: 'low'
          },
          energyInfrastructure: {
            hydroPlants: 23,
            solarPlants: 8,
            windPlants: 2,
            vulnerabilityScore: 6.2
          }
        },
        mongolia: {
          temperature: {
            current: 1.8,
            trend: '+3.2°C by 2050',
            extremeRisk: 'high'
          },
          precipitation: {
            current: 295,
            trend: '-8% by 2050',
            droughtRisk: 'very-high'
          },
          energyInfrastructure: {
            hydroPlants: 5,
            solarPlants: 12,
            windPlants: 15,
            vulnerabilityScore: 7.8
          }
        },
        laos: {
          temperature: {
            current: 25.6,
            trend: '+2.5°C by 2050',
            extremeRisk: 'medium'
          },
          precipitation: {
            current: 1785,
            trend: '+12% by 2050',
            droughtRisk: 'low'
          },
          energyInfrastructure: {
            hydroPlants: 45,
            solarPlants: 6,
            windPlants: 3,
            vulnerabilityScore: 5.4
          }
        }
      }
      
      setCountryRiskData(mockData)
    }
  
  return { countryRiskData }
}