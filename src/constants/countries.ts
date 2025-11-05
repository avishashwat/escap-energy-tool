/**
 * Centralized country configuration for the Agriculture and Energy Tool
 * 
 * This file defines all supported countries in the system.
 * To add a new country: Add it to the SUPPORTED_COUNTRIES array
 * To get total count: Use TOTAL_COUNTRIES constant
 */

export interface Country {
  value: string
  label: string
  code: string
  region: string
  bounds: {
    center: [number, number]
    baseZoom: number
  }
}

/**
 * List of all supported countries in the system
 * Current count: 3 countries (Bhutan, Laos, Mongolia)
 */
export const SUPPORTED_COUNTRIES: Country[] = [
  {
    value: 'bhutan',
    label: 'Bhutan',
    code: 'BT',
    region: 'South Asia',
    bounds: {
      center: [90.433601, 27.514162],
      baseZoom: 7.5
    }
  },
  {
    value: 'laos',
    label: 'Laos',
    code: 'LA', 
    region: 'Southeast Asia',
    bounds: {
      center: [103.865, 18.220],
      baseZoom: 5.2
    }
  },
  {
    value: 'mongolia',
    label: 'Mongolia',
    code: 'MN',
    region: 'East Asia',
    bounds: {
      center: [103.835, 46.862],
      baseZoom: 4.2
    }
  }
]

/**
 * Total number of supported countries
 * Automatically calculated from SUPPORTED_COUNTRIES array
 */
export const TOTAL_COUNTRIES = SUPPORTED_COUNTRIES.length

/**
 * Get country by value
 */
export const getCountryByValue = (value: string): Country | undefined => {
  return SUPPORTED_COUNTRIES.find(country => country.value === value)
}

/**
 * Get country by label
 */
export const getCountryByLabel = (label: string): Country | undefined => {
  return SUPPORTED_COUNTRIES.find(country => country.label.toLowerCase() === label.toLowerCase())
}

/**
 * Get all country values as array
 */
export const getCountryValues = (): string[] => {
  return SUPPORTED_COUNTRIES.map(country => country.value)
}

/**
 * Get all country labels as array
 */
export const getCountryLabels = (): string[] => {
  return SUPPORTED_COUNTRIES.map(country => country.label)
}

/**
 * Get country bounds by value
 */
export const getCountryBounds = (value: string) => {
  const country = getCountryByValue(value)
  return country?.bounds
}

/**
 * Get all country bounds as object (for backward compatibility)
 */
export const getCountryBoundsMap = () => {
  const boundsMap: Record<string, { center: [number, number]; baseZoom: number }> = {}
  SUPPORTED_COUNTRIES.forEach(country => {
    boundsMap[country.value] = country.bounds
  })
  return boundsMap
}

/**
 * Check if a country is supported
 */
export const isCountrySupported = (value: string): boolean => {
  return SUPPORTED_COUNTRIES.some(country => country.value === value)
}

// Export formatted list for UI components (backward compatibility)
export const COUNTRIES_LIST = SUPPORTED_COUNTRIES.map(country => ({
  id: country.value,
  name: country.label,
  value: country.value,
  label: country.label
}))

/**
 * Usage examples:
 * 
 * import { SUPPORTED_COUNTRIES, TOTAL_COUNTRIES, getCountryByValue, getCountryBounds } from '@/constants/countries'
 * 
 * console.log(`Total countries: ${TOTAL_COUNTRIES}`) // Total countries: 3
 * console.log(getCountryByValue('bhutan')) // { value: 'bhutan', label: 'Bhutan', code: 'BT', region: 'South Asia', bounds: {...} }
 * console.log(getCountryBounds('bhutan')) // { center: [90.433601, 27.514162], baseZoom: 7.5 }
 */