// Enhanced Climate Data Table
// Created: October 6, 2025  
// Purpose: Professional climate data table without variable names in rows, with better header formatting

import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Download, Table, ArrowUp, ArrowDown } from '@phosphor-icons/react'
import { ClimateRow } from '../utils/dashboardTypes'

interface EnhancedClimateDataTableProps {
  data: ClimateRow[]
  selectedCountry: string
  onExport: () => void
}

export function EnhancedClimateDataTable({ data, selectedCountry, onExport }: EnhancedClimateDataTableProps) {
  const [sortBy, setSortBy] = useState<string>('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showAll, setShowAll] = useState(false)

  // Process and format data for table display
  const tableData = useMemo(() => {
    if (data.length === 0) return { headers: [], rows: [], variable: '', scenario: '', unit: '' }
    
    // Get metadata from first row
    const firstRow = data[0]
    const variableParts = firstRow.variable.split(' - ')
    const variable = variableParts[0] || 'Climate Data'
    const scenario = variableParts[1] || ''
    const yearRange = variableParts[2] || ''
    const season = variableParts[3] || ''
    
    // Determine unit based on variable type
    const unit = variable.toLowerCase().includes('temperature') ? '°C' : 
                 variable.toLowerCase().includes('precipitation') ? 'mm' : 
                 variable.toLowerCase().includes('radiation') ? 'W/m²' : ''

    // Create professional headers
    const headers = ['Region', 'Value']
    
    // Process all data rows
    const allRegionData: Record<string, number[]> = {}
    
    data.forEach(row => {
      Object.entries(row.regions).forEach(([region, value]) => {
        if (!allRegionData[region]) {
          allRegionData[region] = []
        }
        allRegionData[region].push(value)
      })
    })

    // Create table rows with aggregated data (average if multiple values)
    let rows = Object.entries(allRegionData).map(([region, values]) => {
      const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length
      return {
        region: region.replace(/([A-Z])/g, ' $1').trim(), // Format camelCase to readable
        value: Number(avgValue.toFixed(1)),
        rawValue: avgValue,
        count: values.length
      }
    })

    // Sort rows
    if (sortBy === 'region') {
      rows.sort((a, b) => sortOrder === 'asc' ? 
        a.region.localeCompare(b.region) : 
        b.region.localeCompare(a.region))
    } else if (sortBy === 'value') {
      rows.sort((a, b) => sortOrder === 'desc' ? b.rawValue - a.rawValue : a.rawValue - b.rawValue)
    } else {
      // Default sort by value
      rows.sort((a, b) => sortOrder === 'desc' ? b.rawValue - a.rawValue : a.rawValue - b.rawValue)
    }

    // Slice for display
    const displayRows = showAll ? rows : rows.slice(0, 10)

    return {
      headers,
      rows: displayRows,
      variable,
      scenario: scenario ? `${scenario}${yearRange ? ` (${yearRange})` : ''}${season ? ` - ${season}` : ''}` : '',
      unit,
      totalRows: rows.length
    }
  }, [data, sortBy, sortOrder, showAll])

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  // Download table data as CSV
  const downloadTableData = () => {
    const headers = ['Region', `Value (${tableData.unit})`]
    const rows = tableData.rows.map(row => [
      row.region,
      row.value
    ])
    
    const csvContent = [
      [`${tableData.variable} - ${selectedCountry}`],
      [`Scenario: ${tableData.scenario}`], 
      [],
      headers,
      ...rows
    ].map(row => row.join(',')).join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedCountry}_${tableData.variable.toLowerCase().replace(/\s+/g, '_')}_detailed_table.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (data.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex gap-2 justify-end">
          <button 
            onClick={() => setShowAll(!showAll)}
            className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center"
          >
            <Table className="h-3 w-3 mr-1" />
            {showAll ? `Show Top 10` : `Show All ${tableData.totalRows || data.length}`}
          </button>
          <button 
            onClick={downloadTableData}
            className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center"
          >
            <Download className="h-3 w-3 mr-1" />
            Table
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th 
                  className="text-left p-2 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => handleSort('region')}
                >
                  <div className="flex items-center gap-1">
                    Region
                    {sortBy === 'region' && (
                      sortOrder === 'asc' ? 
                        <ArrowUp className="h-3 w-3" /> : 
                        <ArrowDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="text-right p-2 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => handleSort('value')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Value ({tableData.unit})
                    {(sortBy === 'value' || sortBy === '') && (
                      sortOrder === 'asc' ? 
                        <ArrowUp className="h-3 w-3" /> : 
                        <ArrowDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {tableData.rows.map((row, index) => (
                <tr 
                  key={row.region} 
                  className="border-b hover:bg-gray-50 transition-colors"
                >
                  <td className="p-2 font-medium">
                    {row.region}
                    {row.count > 1 && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        avg of {row.count}
                      </Badge>
                    )}
                  </td>
                  <td className="p-2 text-right font-mono">
                    {row.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {!showAll && (tableData.totalRows || 0) > 10 && (
          <div className="mt-3 text-center">
            <button 
              onClick={() => setShowAll(true)}
              className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1"
            >
              Show {(tableData.totalRows || 0) - 10} more regions...
            </button>
          </div>
        )}
        
        {/* Table Summary */}
        <div className="mt-4 pt-3 border-t">
          <div className="flex justify-between text-xs text-gray-600">
            <span>Total Regions: {tableData.totalRows}</span>
            <span>
              Range: {Math.min(...tableData.rows.map(r => r.value))} - {Math.max(...tableData.rows.map(r => r.value))} {tableData.unit}
            </span>
            <span>Sorted by: {sortBy || 'Value'} ({sortOrder})</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}