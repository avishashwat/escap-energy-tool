// Reusable Data Table Component for Dashboard
// Created: October 6, 2025
// Purpose: Display climate and GIRI data in sortable, interactive tables

import React, { useState, useMemo } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowUp, ArrowDown, Download } from '@phosphor-icons/react'
import { ClimateRow, GIRIRow } from '../utils/dashboardTypes'

interface DataTableProps {
  data: ClimateRow[] | GIRIRow[]
  type: 'climate' | 'giri'
  title: string
  onExport?: () => void
}

export function DataTable({ data, type, title, onExport }: DataTableProps) {
  const [sortColumn, setSortColumn] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [maxRows, setMaxRows] = useState(5) // Show first 5 rows by default

  // Get all unique regions from the data
  const regions = useMemo(() => {
    if (data.length === 0) return []
    
    const regionSet = new Set<string>()
    data.forEach(row => {
      Object.keys(row.regions).forEach(region => {
        regionSet.add(region)
      })
    })
    
    return Array.from(regionSet).sort()
  }, [data])

  // Sort data by selected column
  const sortedData = useMemo(() => {
    if (!sortColumn || data.length === 0) return data

    return [...data].sort((a, b) => {
      let valueA: number | string
      let valueB: number | string

      if (sortColumn === 'variable' && type === 'climate') {
        valueA = (a as ClimateRow).variable
        valueB = (b as ClimateRow).variable
      } else if (sortColumn.startsWith('region_')) {
        const regionName = sortColumn.replace('region_', '')
        valueA = a.regions[regionName] || 0
        valueB = b.regions[regionName] || 0
      } else if (type === 'giri') {
        const giriA = a as GIRIRow
        const giriB = b as GIRIRow
        switch (sortColumn) {
          case 'hazard': valueA = giriA.hazard; valueB = giriB.hazard; break
          case 'ssp': valueA = giriA.ssp; valueB = giriB.ssp; break
          case 'height': valueA = giriA.height; valueB = giriB.height; break
          default: valueA = 0; valueB = 0
        }
      } else {
        return 0
      }

      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortDirection === 'asc' 
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA)
      }

      const numA = Number(valueA)
      const numB = Number(valueB)
      return sortDirection === 'asc' ? numA - numB : numB - numA
    })
  }, [data, sortColumn, sortDirection, type])

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return null
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-1 h-4 w-4" />
      : <ArrowDown className="ml-1 h-4 w-4" />
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            {title}
            <Badge variant="outline">No Data</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No matching {type} data found for active overlays.
          </p>
        </CardContent>
      </Card>
    )
  }

  const displayData = sortedData.slice(0, maxRows)
  const hasMoreRows = sortedData.length > maxRows

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center justify-between">
          {title}
          <div className="flex items-center gap-2">
            <Badge variant="outline">{data.length} rows</Badge>
            {onExport && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onExport}
                className="h-6 px-2"
              >
                <Download className="h-3 w-3 mr-1" />
                Export
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 h-full">
        <div className="h-full overflow-x-auto overflow-y-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {type === 'climate' && (
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('variable')}
                  >
                    <div className="flex items-center">
                      Variable
                      <SortIcon column="variable" />
                    </div>
                  </TableHead>
                )}
                {type === 'giri' && (
                  <>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('hazard')}
                    >
                      <div className="flex items-center">
                        Hazard
                        <SortIcon column="hazard" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('ssp')}
                    >
                      <div className="flex items-center">
                        SSP
                        <SortIcon column="ssp" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('height')}
                    >
                      <div className="flex items-center">
                        Height
                        <SortIcon column="height" />
                      </div>
                    </TableHead>
                  </>
                )}
                {regions.map(region => (
                  <TableHead 
                    key={region}
                    className="cursor-pointer hover:bg-muted/50 text-xs whitespace-nowrap"
                    onClick={() => handleSort(`region_${region}`)}
                  >
                    <div className="flex items-center">
                      {region}
                      <SortIcon column={`region_${region}`} />
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.map((row, index) => (
                <TableRow key={index}>
                  {type === 'climate' && (
                    <TableCell className="font-medium text-xs max-w-48">
                      {(row as ClimateRow).variable}
                    </TableCell>
                  )}
                  {type === 'giri' && (
                    <>
                      <TableCell className="text-xs">{(row as GIRIRow).hazard}</TableCell>
                      <TableCell className="text-xs">{(row as GIRIRow).ssp}</TableCell>
                      <TableCell className="text-xs">{(row as GIRIRow).height}</TableCell>
                    </>
                  )}
                  {regions.map(region => (
                    <TableCell key={region} className="text-xs whitespace-nowrap">
                      {row.regions[region]?.toFixed(2) || '0.00'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {hasMoreRows && (
          <div className="p-4 border-t">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setMaxRows(prev => prev + 5)}
              className="w-full"
            >
              Show More ({sortedData.length - maxRows} remaining)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}