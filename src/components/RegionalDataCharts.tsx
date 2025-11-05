// Regional Data Charts Component
// Created: October 6, 2025
// Purpose: Interactive charts for climate data visualization with download functionality

import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Download, ChartBar } from '@phosphor-icons/react'
import { ClimateRow } from '../utils/dashboardTypes'

interface RegionalDataChartsProps {
  data: ClimateRow[]
  selectedCountry: string
}

export function RegionalDataCharts({ data, selectedCountry }: RegionalDataChartsProps) {
  const [chartType, setChartType] = useState<'bar' | 'horizontal'>('horizontal')

  // Process data for charts
  const chartData = useMemo(() => {
    if (data.length === 0) return []
    
    // Use the first data row for visualization
    const row = data[0]
    const variable = row.variable.split(' - ')[0] // Get clean variable name
    
    return Object.entries(row.regions)
      .map(([region, value]) => ({
        region,
        value: Number(value.toFixed(1)),
        displayName: region.replace(/([A-Z])/g, ' $1').trim() // Add spaces to camelCase
      }))
      .sort((a, b) => b.value - a.value) // Sort by value descending
  }, [data])

  const variable = data.length > 0 ? data[0].variable.split(' - ')[0] : 'Climate Data'
  const unit = variable.toLowerCase().includes('temperature') ? '°C' : 
               variable.toLowerCase().includes('precipitation') ? 'mm' : ''

  // Calculate max value for bar chart scaling
  const maxValue = Math.max(...chartData.map(d => d.value))

  // Download chart data as CSV
  const downloadChartData = () => {
    const headers = ['Region', 'Value', 'Unit']
    const rows = chartData.map(item => [item.displayName, item.value, unit])
    
    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedCountry}_${variable.toLowerCase().replace(/\s+/g, '_')}_chart_data.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Download chart as image - responsive to current chart type
  const downloadChartImage = () => {
    let svg = ''
    
    if (chartType === 'horizontal') {
      // Generate horizontal bar chart SVG
      const svgWidth = 800
      const svgHeight = 600
      const margin = { top: 40, right: 40, bottom: 60, left: 120 }
      const chartWidth = svgWidth - margin.left - margin.right
      const chartHeight = svgHeight - margin.top - margin.bottom
      
      const barHeight = Math.max(chartHeight / chartData.length, 25)
      
      svg = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .chart-title { font: bold 16px Arial; text-anchor: middle; }
          .region-label { font: 12px Arial; }
          .bar { fill: #3b82f6; }
          .value-label { font: 11px Arial; fill: white; }
        </style>
        
        <!-- Title -->
        <text x="${svgWidth/2}" y="25" class="chart-title">${variable} by Region - ${selectedCountry}</text>
        
        <!-- Bars and Labels -->
      `
      
      chartData.forEach((item, index) => {
        const barWidth = (item.value / maxValue) * chartWidth
        const y = margin.top + (index * barHeight)
        
        // Bar
        svg += `<rect x="${margin.left}" y="${y + 2}" width="${barWidth}" height="${barHeight - 4}" class="bar" />`
        
        // Region label
        svg += `<text x="${margin.left - 5}" y="${y + barHeight/2 + 3}" text-anchor="end" class="region-label">${item.displayName}</text>`
        
        // Value label
        svg += `<text x="${margin.left + barWidth - 5}" y="${y + barHeight/2 + 3}" text-anchor="end" class="value-label">${item.value} ${unit}</text>`
      })
      
      svg += '</svg>'
    } else {
      // Generate vertical bar chart SVG
      const svgWidth = Math.max(chartData.length * 80, 600)
      const svgHeight = 500
      const margin = { top: 40, right: 40, bottom: 120, left: 60 }
      const chartWidth = svgWidth - margin.left - margin.right
      const chartHeight = svgHeight - margin.top - margin.bottom
      
      const barWidth = Math.max(chartWidth / chartData.length - 10, 30)
      
      svg = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .chart-title { font: bold 16px Arial; text-anchor: middle; }
          .region-label { font: 10px Arial; text-anchor: middle; }
          .bar { fill: #3b82f6; }
          .value-label { font: 10px Arial; text-anchor: middle; }
        </style>
        
        <!-- Title -->
        <text x="${svgWidth/2}" y="25" class="chart-title">${variable} by Region - ${selectedCountry}</text>
        
        <!-- Bars and Labels -->
      `
      
      chartData.forEach((item, index) => {
        const barHeight = (item.value / maxValue) * chartHeight
        const x = margin.left + (index * (barWidth + 10))
        const y = margin.top + chartHeight - barHeight
        
        // Bar
        svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" class="bar" />`
        
        // Value label (above bar)
        svg += `<text x="${x + barWidth/2}" y="${y - 5}" class="value-label">${item.value} ${unit}</text>`
        
        // Region label (below chart, rotated)
        svg += `<text x="${x + barWidth/2}" y="${margin.top + chartHeight + 20}" class="region-label" transform="rotate(-45 ${x + barWidth/2} ${margin.top + chartHeight + 20})">${item.displayName}</text>`
      })
      
      svg += '</svg>'
    }
    
    // Download SVG
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedCountry}_${variable.toLowerCase().replace(/\s+/g, '_')}_${chartType}_chart.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (chartData.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex gap-2 justify-end">
          <button 
            onClick={() => setChartType(chartType === 'bar' ? 'horizontal' : 'bar')}
            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            {chartType === 'bar' ? 'Horizontal' : 'Vertical'} View
          </button>
          <button 
            onClick={downloadChartImage}
            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center gap-1"
          >
            <Download className="h-3 w-3" />
            Chart
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {chartType === 'horizontal' ? (
            // Horizontal Bar Chart
            <div className="space-y-2">
              {chartData.map((item, index) => {
                const barWidthPercent = (item.value / maxValue) * 100;
                const isSmallBar = barWidthPercent < 25; // If bar is less than 25% width, show value outside
                
                return (
                  <div key={item.region} className="flex items-center gap-2">
                    <div className="w-24 text-xs font-medium truncate" title={item.displayName}>
                      {item.displayName}
                    </div>
                    <div className="flex-1 bg-gray-200 rounded-full h-7 relative flex items-center">
                      <div 
                        className="bg-blue-500 h-7 rounded-full transition-all duration-500 relative"
                        style={{ width: `${Math.max(barWidthPercent, 5)}%` }}
                      >
                        {!isSmallBar && (
                          <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white text-xs font-medium">
                            {item.value} {unit}
                          </span>
                        )}
                      </div>
                      {isSmallBar && (
                        <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-700 text-xs font-medium ml-2" style={{ left: `${Math.max(barWidthPercent, 5) + 2}%` }}>
                          {item.value} {unit}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Vertical Bar Chart with horizontal scroll
            <div className="bg-gray-50 p-3 rounded-lg overflow-x-auto overflow-y-hidden mt-1">
              <div className="flex items-end gap-1 h-44 min-w-max">
                {chartData.map((item, index) => (
                  <div key={item.region} className="flex flex-col items-center justify-end h-full min-w-[45px]">
                    {/* Value label at top */}
                    <div className="text-[10px] font-medium text-gray-700 mb-1 text-center">
                      {item.value}{unit}
                    </div>
                    
                    {/* Bar */}
                    <div 
                      className="bg-blue-500 w-7 rounded-t transition-all duration-500 flex-shrink-0"
                      style={{ height: `${Math.max((item.value / maxValue) * 140, 8)}px` }}
                    />
                    
                    {/* Region name - simplified formatting */}
                    <div className="mt-2 w-full flex flex-col items-center">
                      <div className="text-[10px] font-medium text-gray-800 text-center leading-tight max-w-full">
                        <div className="break-words">
                          {item.displayName}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Chart Summary */}
        <div className="mt-4 pt-3 border-t">
          <div className="flex justify-between text-xs text-gray-600">
            <span>Regions: {chartData.length}</span>
            <span>Range: {Math.min(...chartData.map(d => d.value)).toFixed(1)} - {Math.max(...chartData.map(d => d.value)).toFixed(1)} {unit}</span>
            <span>Variable: {variable}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}