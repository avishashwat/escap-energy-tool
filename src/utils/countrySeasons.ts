/**
 * Country-specific season definitions for climate data
 * Each country has unique seasonal patterns based on their geographical location and climate
 * 
 * TECHNICAL NOTE FOR FUTURE DEVELOPMENT:
 * When adding a new country, add the seasons configuration here following this structure:
 * {
 *   code: 'country_code',
 *   name: 'Country Name', 
 *   seasons: [
 *     { code: 'season_code', label: 'Month Range Display', months: 'start-end' },
 *     ...
 *   ]
 * }
 * 
 * The season codes will be used in the filename: {country}_{category}_{subcategory}_{scenario}_{yearRange}_{season}_classified
 * For annual data, no season code is appended.
 */

export interface Season {
  code: string        // Used in filename (e.g., 'dec_feb', 'jun_sep')
  label: string       // Display label in dropdown (e.g., 'December - February')
  months: string      // Month range for reference (e.g., 'dec-feb')
}

export interface CountrySeasons {
  code: string        // Country code (e.g., 'bhutan')
  name: string        // Country display name (e.g., 'Bhutan')
  seasons: Season[]   // Array of seasonal definitions
}

/**
 * Country-specific seasonal configurations
 * Based on geographical climate patterns and meteorological seasons
 */
export const COUNTRY_SEASONS: CountrySeasons[] = [
  {
    code: 'bhutan',
    name: 'Bhutan',
    seasons: [
      {
        code: 'dec_feb',
        label: 'December - February',
        months: 'dec-feb'
      },
      {
        code: 'mar_may',
        label: 'March - May', 
        months: 'mar-may'
      },
      {
        code: 'jun_sep',
        label: 'June - September',
        months: 'jun-sep'
      },
      {
        code: 'oct_nov',
        label: 'October - November',
        months: 'oct-nov'
      }
    ]
  },
  {
    code: 'laos',
    name: 'Laos',
    seasons: [
      {
        code: 'nov_apr',
        label: 'November - April',
        months: 'nov-apr'
      },
      {
        code: 'mar_may',
        label: 'March - May',
        months: 'mar-may'
      },
      {
        code: 'may_oct',
        label: 'May - October',
        months: 'may-oct'
      }
    ]
  },
  {
    code: 'mongolia',
    name: 'Mongolia',
    seasons: [
      {
        code: 'nov_feb',
        label: 'November - February',
        months: 'nov-feb'
      },
      {
        code: 'mar_may',
        label: 'March - May',
        months: 'mar-may'
      },
      {
        code: 'jun_aug',
        label: 'June - August',
        months: 'jun-aug'
      },
      {
        code: 'sep_oct',
        label: 'September - October',
        months: 'sep-oct'
      }
    ]
  }
]

/**
 * Get seasons for a specific country
 * @param countryCode - Country code (e.g., 'bhutan', 'laos', 'mongolia')
 * @returns Array of seasons for the country, or empty array if country not found
 */
export function getSeasonsForCountry(countryCode: string): Season[] {
  const country = COUNTRY_SEASONS.find(c => c.code.toLowerCase() === countryCode.toLowerCase())
  return country ? country.seasons : []
}

/**
 * Get season configuration by country and season code
 * @param countryCode - Country code
 * @param seasonCode - Season code
 * @returns Season configuration or null if not found
 */
export function getSeasonConfig(countryCode: string, seasonCode: string): Season | null {
  const seasons = getSeasonsForCountry(countryCode)
  return seasons.find(s => s.code === seasonCode) || null
}

/**
 * Generate the season part of the filename
 * @param seasonality - 'Annual' or 'Seasonal'  
 * @param seasonCode - Season code (required if seasonality is 'Seasonal')
 * @returns Season part for filename, or empty string for Annual
 */
export function generateSeasonFilename(seasonality: string, seasonCode?: string): string {
  if (seasonality === 'Annual') {
    return ''  // No season suffix for annual data
  }
  
  if (seasonality === 'Seasonal' && seasonCode) {
    return `_${seasonCode}`
  }
  
  return ''  // Fallback for invalid combinations
}

/**
 * Validate if a country is supported
 * @param countryCode - Country code to check
 * @returns True if country has season configurations
 */
export function isSupportedCountry(countryCode: string): boolean {
  return COUNTRY_SEASONS.some(c => c.code.toLowerCase() === countryCode.toLowerCase())
}

/**
 * Get all supported countries
 * @returns Array of all configured countries
 */
export function getSupportedCountries(): CountrySeasons[] {
  return [...COUNTRY_SEASONS]
}