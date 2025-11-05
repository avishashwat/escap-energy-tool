import React from 'react'

interface RasterLegendProps {
  overlayInfo: {
    type: string
    name: string
    scenario?: string
    year?: string
    season?: string
    classifications?: Array<{
      id: string
      min: number
      max: number
      color: string
      label: string
    }>
    statistics?: {
      min: number
      max: number
      mean: number
      stdDev: number
    }
  }
  mapLayout?: number
}

// Define color schemes for different data types
const getColorScheme = (dataType: string) => {
  // Climate variables - blue to red gradient
  if (dataType.toLowerCase().includes('temp') || dataType.toLowerCase().includes('temperature')) {
    return [
      { color: '#0066cc', label: 'Low' },
      { color: '#3399ff', label: 'Below Average' },
      { color: '#ffcc00', label: 'Average' },
      { color: '#ff6600', label: 'Above Average' },
      { color: '#cc0000', label: 'High' }
    ]
  }
  
  // Precipitation - green to blue gradient
  if (dataType.toLowerCase().includes('precip') || dataType.toLowerCase().includes('rainfall')) {
    return [
      { color: '#8B4513', label: 'Very Low' },
      { color: '#DAA520', label: 'Low' },
      { color: '#FFD700', label: 'Moderate' },
      { color: '#32CD32', label: 'High' },
      { color: '#0000CD', label: 'Very High' }
    ]
  }
  
  // Solar radiation - yellow to orange gradient
  if (dataType.toLowerCase().includes('solar') || dataType.toLowerCase().includes('radiation')) {
    return [
      { color: '#FFFFE0', label: 'Very Low' },
      { color: '#FFD700', label: 'Low' },
      { color: '#FFA500', label: 'Moderate' },
      { color: '#FF6347', label: 'High' },
      { color: '#DC143C', label: 'Very High' }
    ]
  }
  
  // Flooding/Water hazards - blue gradient
  if (dataType.toLowerCase().includes('flood')) {
    return [
      { color: '#E6F3FF', label: 'Very Low Risk' },
      { color: '#99CCFF', label: 'Low Risk' },
      { color: '#3399FF', label: 'Moderate Risk' },
      { color: '#0066CC', label: 'High Risk' },
      { color: '#003399', label: 'Very High Risk' }
    ]
  }
  
  // Drought - brown to red gradient
  if (dataType.toLowerCase().includes('drought')) {
    return [
      { color: '#90EE90', label: 'No Risk' },
      { color: '#FFFF99', label: 'Low Risk' },
      { color: '#FFB347', label: 'Moderate Risk' },
      { color: '#FF6B6B', label: 'High Risk' },
      { color: '#8B0000', label: 'Extreme Risk' }
    ]
  }
  
  // Default color scheme
  return [
    { color: '#2563eb', label: '0-100' },
    { color: '#3b82f6', label: '101-250' },
    { color: '#60a5fa', label: '251-500' },
    { color: '#93c5fd', label: '501-750' },
    { color: '#dbeafe', label: '751-1000' }
  ]
}

// Get appropriate data ranges based on the data type
const getDataRanges = (dataType: string) => {
  // For temperature data (likely in Celsius or Fahrenheit)
  if (dataType.toLowerCase().includes('temp') || dataType.toLowerCase().includes('temperature')) {
    return ['< 0°C', '0-10°C', '10-25°C', '25-35°C', '> 35°C']
  }
  
  // For precipitation data (mm)
  if (dataType.toLowerCase().includes('precip') || dataType.toLowerCase().includes('rainfall')) {
    return ['0-50mm', '50-100mm', '100-200mm', '200-400mm', '> 400mm']
  }
  
  // For solar radiation (MJ/m²/day or similar)
  if (dataType.toLowerCase().includes('solar') || dataType.toLowerCase().includes('radiation')) {
    return ['< 10', '10-15', '15-20', '20-25', '> 25']
  }
  
  // For risk data (probability or index)
  if (dataType.toLowerCase().includes('flood') || dataType.toLowerCase().includes('drought')) {
    return ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%']
  }
  
  // Default ranges
  return ['0-100', '101-250', '251-500', '501-750', '751-1000']
}

export function RasterLegend({ overlayInfo, mapLayout = 1 }: RasterLegendProps) {
  // Use real classification data if available, otherwise fall back to default color schemes
  const useRealData = overlayInfo.classifications && overlayInfo.classifications.length > 0
  
  let colorScheme: Array<{ color: string; label: string }>
  
  if (useRealData) {
    // Use the actual uploaded classification data
    colorScheme = overlayInfo.classifications!.map(cls => ({
      color: cls.color,
      label: cls.label
    }))
  } else {
    // Fall back to default color schemes
    colorScheme = getColorScheme(overlayInfo.name)
    const dataRanges = getDataRanges(overlayInfo.name)
    colorScheme = colorScheme.map((item, index) => ({
      color: item.color,
      label: dataRanges[index] || item.label
    }))
  }
  
  // Scale sizing based on map layout
  const getScaledClasses = () => {
    if (mapLayout === 1) {
      return {
        container: 'space-y-1',
        colorBox: 'w-3 h-3',
        text: 'text-xs'
      }
    } else if (mapLayout === 2) {
      return {
        container: 'space-y-0.5',
        colorBox: 'w-2.5 h-2.5',
        text: 'text-[10px]'
      }
    } else {
      return {
        container: 'space-y-0.5',
        colorBox: 'w-2 h-2',
        text: 'text-[9px]'
      }
    }
  }
  
  const classes = getScaledClasses()
  
  return (
    <div className={classes.container}>
      {colorScheme.map((item, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <div 
            className={`${classes.colorBox} rounded-sm border border-gray-300`}
            style={{ backgroundColor: item.color }}
          />
          <span className={`${classes.text} text-foreground`}>
            {item.label}
          </span>
        </div>
      ))}
      
      {/* Show data source indicator */}
      {useRealData && overlayInfo.statistics && mapLayout === 1 && (
        <div className="mt-2 pt-1 border-t border-gray-200">
          <div className={`${classes.text} text-muted-foreground`}>
            Range: {overlayInfo.statistics.min.toFixed(2)} - {overlayInfo.statistics.max.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  )
}