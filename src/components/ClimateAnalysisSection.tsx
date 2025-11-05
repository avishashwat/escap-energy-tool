// Climate Analysis Section for Dashboard
// Created: October 6, 2025
// Purpose: Display climate data analysis and regional comparisons

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendUp, TrendDown, Thermometer, CloudRain } from '@phosphor-icons/react'
import { ClimateRow } from '../utils/dashboardTypes'
import { OverlayMatcher } from '../utils/overlayMatcher'
import { DataTable } from './DataTable'
import { RegionalDataCharts } from './RegionalDataCharts'
import { EnhancedClimateDataTable } from './EnhancedClimateDataTable'

interface ClimateAnalysisSectionProps {
  data: ClimateRow[]
  selectedCountry: string
  onExport: () => void
}

export function ClimateAnalysisSection({ data, selectedCountry, onExport }: ClimateAnalysisSectionProps) {
  // Calculate summary statistics
  const stats = useMemo(() => {
    return OverlayMatcher.getSummaryStats(data)
  }, [data])

  // Group data by variable type
  const dataByType = useMemo(() => {
    const grouped: Record<string, ClimateRow[]> = {}
    
    data.forEach(row => {
      const variable = row.variable.split(' - ')[0] // Get base variable name
      if (!grouped[variable]) {
        grouped[variable] = []
      }
      grouped[variable].push(row)
    })
    
    return grouped
  }, [data])

  // Get top regions by average value
  const topRegions = useMemo(() => {
    const regionTotals: Record<string, { total: number, count: number }> = {}
    
    data.forEach(row => {
      Object.entries(row.regions).forEach(([region, value]) => {
        if (!regionTotals[region]) {
          regionTotals[region] = { total: 0, count: 0 }
        }
        regionTotals[region].total += value
        regionTotals[region].count += 1
      })
    })
    
    return Object.entries(regionTotals)
      .map(([region, { total, count }]) => ({
        region,
        average: total / count
      }))
      .sort((a, b) => b.average - a.average)
      .slice(0, 5)
  }, [data])

  if (data.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <CloudRain className="h-5 w-5 text-blue-500" />
          Climate Analysis - {selectedCountry.toUpperCase()}
        </h3>
        <Badge variant="outline">{data.length} datasets</Badge>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-3">
            <div className="text-lg font-bold">{stats.totalRows}</div>
            <p className="text-xs text-muted-foreground">Climate Variables</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-lg font-bold">{stats.totalRegions}</div>
            <p className="text-xs text-muted-foreground">Regions Covered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-lg font-bold">{stats.maxValue.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Maximum Value</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-lg font-bold">{stats.minValue.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Minimum Value</p>
          </CardContent>
        </Card>
      </div>

      {/* Variable Types Overview */}
      {Object.keys(dataByType).length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Variable Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(dataByType).map(([variable, rows]) => {
                const icon = variable.includes('temperature') 
                  ? <Thermometer className="h-4 w-4 text-red-500" />
                  : <CloudRain className="h-4 w-4 text-blue-500" />
                
                return (
                  <div key={variable} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      {icon}
                      <span className="text-sm font-medium capitalize">{variable}</span>
                    </div>
                    <Badge variant="outline">{rows.length} scenarios</Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Regional Data Charts */}
      <RegionalDataCharts 
        data={data} 
        selectedCountry={selectedCountry}
      />

      {/* Data Table */}
      <EnhancedClimateDataTable 
        data={data}
        selectedCountry={selectedCountry}
        onExport={onExport}
      />
    </div>
  )
}