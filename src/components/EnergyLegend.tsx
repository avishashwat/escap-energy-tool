import React from 'react'

interface EnergyLegendProps {
  energyType: string
  mapLayout?: number
}

const getEnergyLegendInfo = (energyType: string) => {
  const baseInfo = {
    'Hydro Power Plants': {
      color: '#1e40af', // Blue
      symbol: '▲',
      description: 'Hydro Power Plants'
    },
    'Solar Power Plants': {
      color: '#f59e0b', // Yellow/Orange
      symbol: '●',
      description: 'Solar Power Plants'
    },
    'Wind Power Plants': {
      color: '#10b981', // Green
      symbol: '✦',
      description: 'Wind Power Plants'
    }
  }

  return baseInfo[energyType as keyof typeof baseInfo] || baseInfo['Hydro Power Plants']
}

export function EnergyLegend({ energyType, mapLayout = 1 }: EnergyLegendProps) {
  const legendInfo = getEnergyLegendInfo(energyType)
  
  // Define size categories for designCapacity with scaling
  const getSizeCategories = () => {
    const baseSizes = [4, 6, 8, 10]
    const scale = mapLayout === 1 ? 1 : mapLayout === 2 ? 0.8 : 0.6
    
    return [
      { range: '< 10 MW', size: baseSizes[0] * scale, description: 'Small' },
      { range: '10-50 MW', size: baseSizes[1] * scale, description: 'Medium' },
      { range: '50-200 MW', size: baseSizes[2] * scale, description: 'Large' },
      { range: '> 200 MW', size: baseSizes[3] * scale, description: 'Very Large' }
    ]
  }
  
  // Scale text and spacing based on map layout
  const getScaledClasses = () => {
    if (mapLayout === 1) {
      return {
        container: 'space-y-2',
        innerContainer: 'space-y-1',
        titleText: 'text-xs',
        itemText: 'text-xs',
        gap: 'gap-2'
      }
    } else if (mapLayout === 2) {
      return {
        container: 'space-y-1.5',
        innerContainer: 'space-y-0.5',
        titleText: 'text-[10px]',
        itemText: 'text-[10px]',
        gap: 'gap-1.5'
      }
    } else {
      return {
        container: 'space-y-1',
        innerContainer: 'space-y-0.5',
        titleText: 'text-[9px]',
        itemText: 'text-[9px]',
        gap: 'gap-1'
      }
    }
  }
  
  const sizeCategories = getSizeCategories()
  const classes = getScaledClasses()

  return (
    <div className={classes.container}>
      <div className={classes.innerContainer}>
        <div className={`${classes.titleText} font-medium text-gray-600`}>
          Size by Design Capacity:
        </div>
        {sizeCategories.map((category, index) => (
          <div key={index} className={`flex items-center ${classes.gap} ${classes.itemText}`}>
            <div 
              className="rounded-full flex-shrink-0"
              style={{ 
                width: `${category.size}px`, 
                height: `${category.size}px`,
                backgroundColor: legendInfo.color,
                opacity: 0.8
              }}
            />
            <span className={`text-gray-700 ${classes.itemText}`}>
              {category.range}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}