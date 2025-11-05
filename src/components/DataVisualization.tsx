import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

interface DataVisualizationProps {
  overlayInfo?: {
    type: string
    name: string
    scenario?: string
    year?: string
    season?: string
  }
  country: string
}

// Mock data based on overlay type
const generateMockData = (overlayInfo: any, country: string) => {
  if (!overlayInfo) return []
  
  const { type, name } = overlayInfo
  
  // Climate data
  if (type === 'Climate') {
    if (name.includes('Temperature')) {
      return [
        { month: 'Jan', value: 15, historical: 12 },
        { month: 'Feb', value: 18, historical: 14 },
        { month: 'Mar', value: 22, historical: 18 },
        { month: 'Apr', value: 26, historical: 22 },
        { month: 'May', value: 29, historical: 25 },
        { month: 'Jun', value: 32, historical: 28 },
        { month: 'Jul', value: 31, historical: 29 },
        { month: 'Aug', value: 30, historical: 28 },
        { month: 'Sep', value: 27, historical: 25 },
        { month: 'Oct', value: 23, historical: 21 },
        { month: 'Nov', value: 19, historical: 17 },
        { month: 'Dec', value: 16, historical: 13 }
      ]
    } else if (name.includes('Precipitation')) {
      return [
        { month: 'Jan', value: 45, historical: 52 },
        { month: 'Feb', value: 38, historical: 41 },
        { month: 'Mar', value: 62, historical: 58 },
        { month: 'Apr', value: 89, historical: 85 },
        { month: 'May', value: 125, historical: 115 },
        { month: 'Jun', value: 168, historical: 155 },
        { month: 'Jul', value: 195, historical: 180 },
        { month: 'Aug', value: 162, historical: 148 },
        { month: 'Sep', value: 98, historical: 92 },
        { month: 'Oct', value: 65, historical: 68 },
        { month: 'Nov', value: 42, historical: 45 },
        { month: 'Dec', value: 38, historical: 42 }
      ]
    }
  }
  
  // GIRI data
  if (type === 'GIRI') {
    return [
      { region: 'North', riskLevel: 3.2, affected: 45000 },
      { region: 'Central', riskLevel: 4.1, affected: 62000 },
      { region: 'South', riskLevel: 2.8, affected: 38000 },
      { region: 'East', riskLevel: 3.7, affected: 51000 },
      { region: 'West', riskLevel: 2.5, affected: 34000 }
    ]
  }
  
  // Energy data
  if (type === 'Energy') {
    return [
      { type: 'Hydro', capacity: 850, plants: 12 },
      { type: 'Solar', capacity: 120, plants: 8 },
      { type: 'Wind', capacity: 45, plants: 3 }
    ]
  }
  
  return []
}

const generateTableData = (overlayInfo: any, country: string) => {
  if (!overlayInfo) return []
  
  const { type, name } = overlayInfo
  
  if (type === 'Climate') {
    return [
      { parameter: 'Annual Mean', current: '24.5°C', projected: '26.8°C', change: '+2.3°C' },
      { parameter: 'Summer Max', current: '32.1°C', projected: '35.4°C', change: '+3.3°C' },
      { parameter: 'Winter Min', current: '12.3°C', projected: '14.1°C', change: '+1.8°C' },
      { parameter: 'Annual Range', current: '19.8°C', projected: '21.3°C', change: '+1.5°C' }
    ]
  }
  
  if (type === 'GIRI') {
    return [
      { indicator: 'Population at Risk', value: '230,000 people', severity: 'High' },
      { indicator: 'Economic Impact', value: '$45M annually', severity: 'Medium' },
      { indicator: 'Infrastructure Risk', value: '65 facilities', severity: 'High' },
      { indicator: 'Agricultural Impact', value: '12,000 hectares', severity: 'Medium' }
    ]
  }
  
  if (type === 'Energy') {
    return [
      { facility: 'Tala Hydroelectric', capacity: '1020 MW', status: 'Operational', risk: 'Low' },
      { facility: 'Chukha Hydroelectric', capacity: '336 MW', status: 'Operational', risk: 'Medium' },
      { facility: 'Kurichhu Hydroelectric', capacity: '60 MW', status: 'Operational', risk: 'Low' },
      { facility: 'Basochhu Hydroelectric', capacity: '64 MW', status: 'Operational', risk: 'Medium' }
    ]
  }
  
  return []
}

export function ChartView({ overlayInfo, country }: DataVisualizationProps) {
  const data = generateMockData(overlayInfo, country)
  
  if (!overlayInfo || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-sm">No data available</p>
          <p className="text-xs mt-1">Select an overlay to view charts</p>
        </div>
      </div>
    )
  }
  
  const isTemperature = overlayInfo.name.includes('Temperature')
  const isPrecipitation = overlayInfo.name.includes('Precipitation')
  const isGIRI = overlayInfo.type === 'GIRI'
  const isEnergy = overlayInfo.type === 'Energy'
  
  return (
    <div className="p-4 h-full">
      <div className="mb-4">
        <h4 className="font-medium text-sm text-foreground">{overlayInfo.name}</h4>
        <p className="text-xs text-muted-foreground">
          {overlayInfo.scenario && `${overlayInfo.scenario} scenario`}
          {overlayInfo.year && ` • ${overlayInfo.year}`}
          {overlayInfo.season && ` • ${overlayInfo.season}`}
        </p>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {(isTemperature || isPrecipitation) ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis 
                dataKey="month" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="var(--primary)" 
                strokeWidth={2}
                dot={{ fill: 'var(--primary)', r: 3 }}
                name="Projected"
              />
              <Line 
                type="monotone" 
                dataKey="historical" 
                stroke="var(--muted-foreground)" 
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={{ fill: 'var(--muted-foreground)', r: 2 }}
                name="Historical"
              />
            </LineChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis 
                dataKey={isGIRI ? "region" : isEnergy ? "type" : "month"}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
              />
              <Bar 
                dataKey={isGIRI ? "riskLevel" : isEnergy ? "capacity" : "value"}
                fill="var(--primary)"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function TableView({ overlayInfo, country }: DataVisualizationProps) {
  const data = generateTableData(overlayInfo, country)
  
  if (!overlayInfo || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-sm">No data available</p>
          <p className="text-xs mt-1">Select an overlay to view table data</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="p-4 h-full">
      <div className="mb-4">
        <h4 className="font-medium text-sm text-foreground">{overlayInfo.name}</h4>
        <p className="text-xs text-muted-foreground">
          {overlayInfo.scenario && `${overlayInfo.scenario} scenario`}
          {overlayInfo.year && ` • ${overlayInfo.year}`}
          {overlayInfo.season && ` • ${overlayInfo.season}`}
        </p>
      </div>
      
      <div className="overflow-auto h-64">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              {Object.keys(data[0] || {}).map((key) => (
                <th key={key} className="text-left py-2 px-2 font-medium text-foreground capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index} className="border-b border-border/50 hover:bg-muted/50">
                {Object.values(row).map((value, colIndex) => (
                  <td key={colIndex} className="py-2 px-2 text-muted-foreground">
                    {String(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}