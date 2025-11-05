// Risk Assessment Section for Dashboard  
// Created: October 6, 2025
// Purpose: Display GIRI hydropower exposure data and risk analysis

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Warning, Shield, Lightning, TrendUp } from '@phosphor-icons/react'
import { GIRIRow } from '../utils/dashboardTypes'
import { OverlayMatcher } from '../utils/overlayMatcher'
import { DataTable } from './DataTable'

interface RiskAssessmentSectionProps {
  data: GIRIRow[]
  selectedCountry: string
  onExport: () => void
}

export function RiskAssessmentSection({ data, selectedCountry, onExport }: RiskAssessmentSectionProps) {
  // Calculate risk statistics
  const riskStats = useMemo(() => {
    const stats = OverlayMatcher.getSummaryStats(data)
    
    // Calculate risk levels based on exposure percentages
    let highRiskRegions = 0
    let mediumRiskRegions = 0
    let lowRiskRegions = 0
    
    data.forEach(row => {
      Object.values(row.regions).forEach(exposure => {
        if (exposure > 50) highRiskRegions++
        else if (exposure > 20) mediumRiskRegions++
        else if (exposure > 0) lowRiskRegions++
      })
    })
    
    return {
      ...stats,
      highRiskRegions,
      mediumRiskRegions,
      lowRiskRegions,
      totalExposures: highRiskRegions + mediumRiskRegions + lowRiskRegions
    }
  }, [data])

  // Group data by scenario
  const dataByScenario = useMemo(() => {
    const grouped: Record<string, GIRIRow[]> = {}
    
    data.forEach(row => {
      if (!grouped[row.ssp]) {
        grouped[row.ssp] = []
      }
      grouped[row.ssp].push(row)
    })
    
    return grouped
  }, [data])

  // Get most exposed regions with height information
  const mostExposedRegions = useMemo(() => {
    const regionData: Record<string, { exposures: number[], heights: string[] }> = {}
    
    data.forEach(row => {
      Object.entries(row.regions).forEach(([region, exposure]) => {
        if (exposure > 0) { // Only include regions with actual exposure
          if (!regionData[region]) {
            regionData[region] = { exposures: [], heights: [] }
          }
          regionData[region].exposures.push(exposure)
          regionData[region].heights.push(row.height)
        }
      })
    })
    
    return Object.entries(regionData)
      .map(([region, { exposures, heights }]) => {
        const maxExposure = Math.max(...exposures)
        const maxExposureIndex = exposures.findIndex(exp => exp === maxExposure)
        return {
          region,
          maxExposure,
          maxExposureHeight: heights[maxExposureIndex]
        }
      })
      .filter(item => item.maxExposure > 0)
      .sort((a, b) => b.maxExposure - a.maxExposure)
      .slice(0, 5)
  }, [data])

  const getRiskLevel = (exposure: number) => {
    if (exposure > 50) return { level: 'High', color: 'text-red-500', icon: Warning }
    if (exposure > 20) return { level: 'Medium', color: 'text-yellow-500', icon: Shield }
    if (exposure > 0) return { level: 'Low', color: 'text-green-500', icon: Shield }
    return { level: 'None', color: 'text-gray-500', icon: Shield }
  }

  if (data.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Lightning className="h-5 w-5 text-orange-500" />
          GIRI Risk Assessment - {selectedCountry.toUpperCase()}
        </h3>
        <Badge variant="outline">{data.length} exposure scenarios</Badge>
      </div>

      {/* Risk Overview - Professional 4-Card Layout */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-500">{riskStats.highRiskRegions}</div>
            <div className="text-sm text-muted-foreground mt-1">High Risk</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-500">{riskStats.mediumRiskRegions}</div>
            <div className="text-sm text-muted-foreground mt-1">Medium Risk</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-500">{riskStats.lowRiskRegions}</div>
            <div className="text-sm text-muted-foreground mt-1">Low Risk</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{riskStats.maxValue.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground mt-1">Max Exposure</div>
          </CardContent>
        </Card>
      </div>

      {/* Scenarios Overview */}
      {Object.keys(dataByScenario).length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Risk Scenarios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(dataByScenario).map(([scenario, rows]) => {
                const maxExposure = Math.max(...rows.flatMap(row => Object.values(row.regions)))
                const riskInfo = getRiskLevel(maxExposure)
                const RiskIcon = riskInfo.icon
                
                return (
                  <div key={scenario} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <RiskIcon className={`h-4 w-4 ${riskInfo.color}`} />
                      <span className="text-sm font-medium">{scenario}</span>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${riskInfo.color}`}>
                        {maxExposure.toFixed(1)}%
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {rows.length} heights
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Most Exposed Regions */}
      {mostExposedRegions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Most Exposed Regions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mostExposedRegions.map(({ region, maxExposure, maxExposureHeight }, index) => {
                const riskInfo = getRiskLevel(maxExposure)
                
                return (
                  <div key={region} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Badge variant={index === 0 ? "default" : "outline"} className="w-8 h-8 p-0 flex items-center justify-center text-sm">
                        {index + 1}
                      </Badge>
                      <div>
                        <div className="font-medium text-sm">{region}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-destructive">{maxExposure.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">
                        Max at {maxExposureHeight}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      <DataTable 
        data={data}
        type="giri"
        title="GIRI Exposure Details"
        onExport={onExport}
      />
    </div>
  )
}