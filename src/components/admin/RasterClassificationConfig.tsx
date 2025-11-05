import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Palette, TrendUp, Info } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { SparkFallback } from '../../utils/sparkFallback'

interface RasterStats {
  min: number
  max: number
  mean: number
  stdDev: number
}

interface ClassificationRange {
  id: string
  min: number
  max: number
  color: string
  label: string
}

interface RasterClassificationConfigProps {
  files: any[]
  category: any
  country: string
  onComplete: (config: any) => void
  onBack: () => void
}

export function RasterClassificationConfig({ 
  files, 
  category, 
  country, 
  onComplete, 
  onBack 
}: RasterClassificationConfigProps) {
  // Debug logging to understand category structure
  console.log('🔍 RasterClassificationConfig Props:', {
    files: files.map(f => ({ name: f.name, file: f.file })),
    category,
    country
  })
  
  const [rasterStats, setRasterStats] = useState<RasterStats | null>(null)
  const [classifications, setClassifications] = useState<ClassificationRange[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [templates, setTemplates] = useState<any>({})
  
  // Load templates from storage
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const data = await SparkFallback.get('classification-templates') as any | null
        if (data) {
          setTemplates(data)
        }
      } catch (error) {
        console.warn('Failed to load classification templates:', error)
      }
    }
    loadTemplates()
  }, [])
  
  // Save templates to storage when they change
  useEffect(() => {
    if (Object.keys(templates).length > 0) {
      SparkFallback.set('classification-templates', templates).catch(console.warn)
    }
  }, [templates])

  // Real raster analysis - temporarily using only enhanced client-side analysis to debug NoData issue
  const analyzeRaster = async (file: File) => {
    setIsAnalyzing(true)
    
    try {
      console.log('🔍 TEMPORARY: Using enhanced client-side analysis to debug NoData issue')
      console.log('File details:', { name: file.name, size: file.size, type: file.type })
      
      // Skip GDAL service temporarily and use enhanced client-side analysis directly
      toast.info('Using enhanced client-side analysis (debugging mode)...')
      await analyzeRasterClientSide(file)
      
    } catch (error) {
      console.error('❌ Enhanced client-side analysis failed:', error)
      toast.error(`Failed to analyze raster: ${error instanceof Error ? error.message : 'Unknown error'}`)
      
      // Fallback to basic stats if analysis fails
      const fallbackStats = { min: 0, max: 100, mean: 50, stdDev: 25 }
      setRasterStats(fallbackStats)
      generateDefaultClassification(fallbackStats)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Fallback client-side raster analysis with improved NoData handling
  const analyzeRasterClientSide = async (file: File) => {
    console.log('🔄 Using enhanced client-side analysis with improved NoData handling')
    toast.info('Using enhanced client-side raster analysis...')
    
    // Import GeoTIFF dynamically to handle ES modules
    const { fromBlob } = await import('geotiff')
    
    // Read the raster file
    const tiff = await fromBlob(file)
    const image = await tiff.getImage()
    const rasters = await image.readRasters()
    
    // Get the first band data - ensure it's an array
    const rasterData = rasters[0]
    if (typeof rasterData === 'number') {
      throw new Error('Invalid raster data format')
    }
    
    // Convert to regular array for easier processing
    const dataArray = Array.from(rasterData)
    
    // Enhanced NoData detection - try multiple methods
    const metadataNoData = image.getGDALNoData()
    let commonNoDataValues = [-9999, -32768, -3.4028235e+38, 3.4028235e+38, -999, -99999]
    
    // Add the exact metadata NoData value to our common values list if it exists
    if (metadataNoData !== null && metadataNoData !== undefined) {
      commonNoDataValues.push(metadataNoData)
    }
    
    let validData: number[] = []
    
    console.log('🔍 Metadata NoData value:', metadataNoData)
    console.log('📊 Total pixels:', dataArray.length)
    
    let noDataCount = 0
    let exactNoDataMatches = 0
    let commonNoDataMatches = 0
    
    for (let i = 0; i < dataArray.length; i++) {
      const value = dataArray[i]
      let isValid = true
      let reasonFiltered = ''
      
      // Check metadata NoData value (exact match)
      if (metadataNoData !== null && metadataNoData !== undefined && value === metadataNoData) {
        isValid = false
        exactNoDataMatches++
        reasonFiltered = 'exact metadata match'
      }
      
      // Check common NoData values with different tolerances
      if (isValid) {
        for (const noDataVal of commonNoDataValues) {
          // Try exact match first
          if (value === noDataVal) {
            isValid = false
            commonNoDataMatches++
            reasonFiltered = `exact common NoData match: ${noDataVal}`
            break
          }
          // Then try tolerance match
          if (Math.abs(value - noDataVal) < 1e-6) {
            isValid = false
            commonNoDataMatches++
            reasonFiltered = `tolerance common NoData match: ${noDataVal}`
            break
          }
        }
      }
      
      // Check for invalid numbers
      if (isValid && (!isFinite(value) || isNaN(value))) {
        isValid = false
        reasonFiltered = 'invalid number'
      }
      
      if (isValid) {
        validData.push(value)
      } else {
        noDataCount++
        // Log first few NoData values found for debugging
        if (noDataCount <= 5) {
          console.log(`   NoData pixel ${noDataCount}: value=${value}, reason=${reasonFiltered}`)
        }
      }
    }
    
    console.log(`   NoData filtering summary:`)
    console.log(`     Exact metadata matches: ${exactNoDataMatches}`)
    console.log(`     Common NoData matches: ${commonNoDataMatches}`)  
    console.log(`     Total filtered: ${noDataCount}`)
    console.log(`     Remaining valid: ${validData.length}`)
    
    console.log('📊 Valid pixels after NoData filtering:', validData.length)
    
    if (validData.length === 0) {
      throw new Error('No valid pixel values found in raster after NoData filtering')
    }
    
    // Remove statistical outliers (values beyond 3 standard deviations)
    if (validData.length > 10) {
      const tempMean = validData.reduce((sum, val) => sum + val, 0) / validData.length
      const tempStd = Math.sqrt(validData.reduce((sum, val) => sum + Math.pow(val - tempMean, 2), 0) / validData.length)
      
      validData = validData.filter(val => Math.abs(val - tempMean) <= 3 * tempStd)
      console.log('📊 Valid pixels after outlier removal:', validData.length)
    }
    
    // Calculate statistics
    const sortedData = validData.sort((a, b) => a - b)
    const min = sortedData[0]
    const max = sortedData[sortedData.length - 1]
    const sum = validData.reduce((acc, val) => acc + val, 0)
    const mean = sum / validData.length
    
    // Calculate standard deviation
    const squaredDiffs = validData.map(value => Math.pow(value - mean, 2))
    const avgSquaredDiff = squaredDiffs.reduce((acc, val) => acc + val, 0) / validData.length
    const stdDev = Math.sqrt(avgSquaredDiff)
    
    const stats: RasterStats = {
      min: parseFloat(min.toFixed(6)),
      max: parseFloat(max.toFixed(6)),
      mean: parseFloat(mean.toFixed(6)),
      stdDev: parseFloat(stdDev.toFixed(6))
    }
    
    console.log('📊 Fallback raster analysis results:', {
      fileName: file.name,
      totalPixels: dataArray.length,
      validPixels: validData.length,
      metadataNoData,
      stats
    })
    
    setRasterStats(stats)
    generateDefaultClassification(stats)
    toast.success(`✅ Enhanced client-side analysis: ${validData.length} valid pixels found (NoData excluded)`)
  }

  // Natural Breaks (Jenks) classification algorithm implementation
  const jenksNaturalBreaks = (data: number[], numClasses: number): number[] => {
    if (data.length === 0 || numClasses <= 0) return []
    
    const sortedData = [...data].sort((a, b) => a - b)
    const uniqueData = [...new Set(sortedData)]
    
    if (uniqueData.length <= numClasses) {
      return uniqueData
    }
    
    const n = uniqueData.length
    const k = numClasses
    
    // Initialize matrices
    const mat1 = Array(n + 1).fill(null).map(() => Array(k + 1).fill(0))
    const mat2 = Array(n + 1).fill(null).map(() => Array(k + 1).fill(0))
    
    // Initialize first row and column
    for (let i = 1; i <= k; i++) {
      mat1[1][i] = 1
      mat2[1][i] = 0
      for (let j = 2; j <= n; j++) {
        mat2[j][i] = Infinity
      }
    }
    
    // Calculate variance for each range
    for (let l = 2; l <= n; l++) {
      let s1 = 0, s2 = 0, w = 0
      
      for (let m = 1; m <= l; m++) {
        const i3 = l - m + 1
        const val = uniqueData[i3 - 1]
        
        s2 += val * val
        s1 += val
        w++
        
        const v = s2 - (s1 * s1) / w
        const i4 = i3 - 1
        
        if (i4 !== 0) {
          for (let j = 2; j <= k; j++) {
            if (mat2[l][j] >= (v + mat2[i4][j - 1])) {
              mat1[l][j] = i3
              mat2[l][j] = v + mat2[i4][j - 1]
            }
          }
        }
      }
      
      mat1[l][1] = 1
      mat2[l][1] = s2 - (s1 * s1) / w
    }
    
    // Extract break points
    const breaks: number[] = []
    let k2 = n
    
    for (let j = k; j >= 2; j--) {
      const id = mat1[k2][j] - 2
      breaks.push(uniqueData[id])
      k2 = mat1[k2][j] - 1
    }
    
    breaks.push(uniqueData[0]) // Add minimum
    breaks.reverse()
    breaks.push(uniqueData[uniqueData.length - 1]) // Add maximum
    
    return breaks
  }

  const generateDefaultClassification = (stats: RasterStats) => {
    console.log('🔍 generateDefaultClassification called with:', { stats, category, files })
    
    // Check if this is GIRI data (multiple ways to detect)
    const isGIRIData = category?.id === 'giri' || 
                      category?.type === 'giri' || 
                      category?.id === 'flood' || 
                      category?.id === 'drought'
    
    // Enhanced flood/drought detection logic
    const fileName = files[0]?.name?.toLowerCase() || ''
    const categoryName = category?.name?.toLowerCase() || ''
    
    console.log('🔍 GIRI Detection Debug:', {
      'category?.id': category?.id,
      'category?.type': category?.type,
      'category?.name': category?.name,
      fileName,
      categoryName,
      isGIRIData
    })
    
    // More comprehensive flood detection
    const isFloodData = isGIRIData && (
      fileName.includes('flood') || 
      fileName.includes('inundation') || 
      fileName.includes('flooding') ||
      categoryName.includes('flood') ||
      fileName.includes('water') ||
      fileName.includes('river') ||
      fileName.includes('coastal')
    )
    
    // More comprehensive drought detection  
    const isDroughtData = isGIRIData && (
      fileName.includes('drought') || 
      fileName.includes('dry') ||
      fileName.includes('arid') ||
      categoryName.includes('drought') ||
      fileName.includes('precipitation') ||
      fileName.includes('rainfall') ||
      fileName.includes('moisture')
    )
    
    console.log('🔍 GIRI Detection Results:', {
      isGIRIData,
      fileName,
      categoryName,
      isFloodData,
      isDroughtData,
      stats
    })
    
    let newClassifications: ClassificationRange[] = []
    
    if (isGIRIData) {
      // Special handling for GIRI data with fixed ranges
      // Check if data is in mm (values > 100) or meters (values < 100)
      const isMillimeters = stats.max > 100
      
      console.log('📊 GIRI Unit Detection:', {
        maxValue: stats.max,
        isMillimeters,
        dataType: isFloodData ? 'Flood' : isDroughtData ? 'Drought' : 'Unknown'
      })
      
      // Enhanced color schemes
      const floodColors = {
        // Professional blue gradient from light to dark (flood risk intensity)
        light: '#f0f8ff',    // Alice blue - very low risk
        lightMed: '#87ceeb', // Sky blue - low risk  
        medium: '#4682b4',   // Steel blue - medium risk
        medDark: '#1e90ff',  // Dodger blue - high risk
        dark: '#0047ab'      // Cobalt blue - very high risk
      }
      
      const droughtColors = {
        // Professional orange/brown gradient from light to dark (drought severity)
        light: '#fff8dc',    // Cornsilk - very low drought
        lightMed: '#ffd700', // Gold - low drought
        medium: '#ff8c00',   // Dark orange - medium drought  
        medDark: '#ff4500',  // Orange red - high drought
        dark: '#8b4513'      // Saddle brown - severe drought
      }
      
      if (isMillimeters) {
        // Data in mm, use mm ranges but show labels in meters
        newClassifications = [
          {
            id: crypto.randomUUID(),
            min: 0,
            max: 1000,
            color: isFloodData ? floodColors.light : isDroughtData ? droughtColors.light : '#f0f8ff',
            label: '< 1m'
          },
          {
            id: crypto.randomUUID(),
            min: 1000,
            max: 2000,
            color: isFloodData ? floodColors.lightMed : isDroughtData ? droughtColors.lightMed : '#87ceeb',
            label: '1 - 2m'
          },
          {
            id: crypto.randomUUID(),
            min: 2000,
            max: 5000,
            color: isFloodData ? floodColors.medium : isDroughtData ? droughtColors.medium : '#4682b4',
            label: '2 - 5m'
          },
          {
            id: crypto.randomUUID(),
            min: 5000,
            max: 10000,
            color: isFloodData ? floodColors.medDark : isDroughtData ? droughtColors.medDark : '#1e90ff',
            label: '5 - 10m'
          },
          {
            id: crypto.randomUUID(),
            min: 10000,
            max: Math.max(stats.max, 10001), // Ensure max is above 10000
            color: isFloodData ? floodColors.dark : isDroughtData ? droughtColors.dark : '#0047ab',
            label: '> 10m'
          }
        ]
      } else {
        // Data in meters, use meter ranges directly
        newClassifications = [
          {
            id: crypto.randomUUID(),
            min: 0,
            max: 1,
            color: isFloodData ? floodColors.light : isDroughtData ? droughtColors.light : '#f0f8ff',
            label: '< 1m'
          },
          {
            id: crypto.randomUUID(),
            min: 1,
            max: 2,
            color: isFloodData ? floodColors.lightMed : isDroughtData ? droughtColors.lightMed : '#87ceeb',
            label: '1 - 2m'
          },
          {
            id: crypto.randomUUID(),
            min: 2,
            max: 5,
            color: isFloodData ? floodColors.medium : isDroughtData ? droughtColors.medium : '#4682b4',
            label: '2 - 5m'
          },
          {
            id: crypto.randomUUID(),
            min: 5,
            max: 10,
            color: isFloodData ? floodColors.medDark : isDroughtData ? droughtColors.medDark : '#1e90ff',
            label: '5 - 10m'
          },
          {
            id: crypto.randomUUID(),
            min: 10,
            max: Math.max(stats.max, 10.1), // Ensure max is above 10
            color: isFloodData ? floodColors.dark : isDroughtData ? droughtColors.dark : '#0047ab',
            label: '> 10m'
          }
        ]
      }
      
      console.log('✅ GIRI Classifications Generated:', {
        dataType: isFloodData ? 'Flood' : isDroughtData ? 'Drought' : 'Generic GIRI',
        unitType: isMillimeters ? 'Millimeters' : 'Meters',
        classCount: newClassifications.length,
        colorScheme: isFloodData ? 'Blues' : isDroughtData ? 'Oranges' : 'Default Blues'
      })
      
      // Add toast notification for GIRI classification
      toast.success(`GIRI ${isFloodData ? 'Flood' : isDroughtData ? 'Drought' : 'Hazard'} classification applied with ${isMillimeters ? 'mm' : 'm'} ranges`)
      
    } else {
      // Use Natural Breaks (Jenks) for non-GIRI data
      const rasterCanvas = document.createElement('canvas')
      const ctx = rasterCanvas.getContext('2d')
      
      // For now, generate sample data from stats for Jenks calculation
      // In a real implementation, you'd use the actual raster pixel values
      const sampleSize = Math.min(1000, Math.max(100, Math.floor((stats.max - stats.min) * 10)))
      const sampleData: number[] = []
      
      for (let i = 0; i < sampleSize; i++) {
        // Generate normally distributed sample data around the mean
        const u1 = Math.random()
        const u2 = Math.random()
        const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
        
        // Scale to raster statistics
        const value = stats.mean + (z0 * stats.stdDev)
        const clampedValue = Math.max(stats.min, Math.min(stats.max, value))
        sampleData.push(clampedValue)
      }
      
      // Apply Natural Breaks algorithm
      const breaks = jenksNaturalBreaks(sampleData, 6) // 6 breaks for 5 classes
      
      // Default colors for non-GIRI data
      const defaultColors = ['#bfd2ff', '#ffffbf', '#ffd380', '#ffaa00', '#e60000']
      
      for (let i = 0; i < 5; i++) {
        let min: number
        let max: number
        
        if (i === 0) {
          // First class: min must be exact raster minimum (no rounding)
          min = stats.min
          max = parseFloat((breaks[i + 1] || stats.max).toFixed(2))
        } else if (i === 4) {
          // Last class: max must be exact raster maximum (no rounding)
          min = parseFloat((breaks[i] || stats.min).toFixed(2))
          max = stats.max
        } else {
          // Middle classes: can use 2 decimal rounding
          min = parseFloat((breaks[i] || stats.min).toFixed(2))
          max = parseFloat((breaks[i + 1] || stats.max).toFixed(2))
        }
        
        // Temporary classification for label generation
        const tempClass = {
          id: crypto.randomUUID(),
          min,
          max,
          color: defaultColors[i],
          label: '' // Will be set below
        }
        
        newClassifications.push(tempClass)
      }
    }
    
    // Generate proper labels for all classifications
    const classificationsWithLabels = newClassifications.map((cls, index) => ({
      ...cls,
      label: generateLabelForClass(cls, index, newClassifications.length, newClassifications)
    }))
    
    setClassifications(classificationsWithLabels)
  }

  const getSmallestIncrement = (value: number): number => {
    // Find the number of decimal places
    const str = value.toString()
    if (str.includes('.')) {
      const decimals = str.split('.')[1].length
      return Math.pow(10, -decimals)
    }
    return 1
  }

  // Helper function to count decimal places in a number
  const getDecimalPlaces = (num: number): number => {
    const str = num.toString()
    if (str.indexOf('.') !== -1 && str.indexOf('e-') === -1) {
      return str.split('.')[1].length
    } else if (str.indexOf('e-') !== -1) {
      const parts = str.split('e-')
      return parseInt(parts[1], 10)
    }
    return 0
  }

  // Helper function to format number with appropriate decimal places based on input precision
  const formatWithDynamicPrecision = (num: number, referenceValues: number[]): string => {
    // Find the maximum decimal places from all reference values
    const maxDecimals = Math.min(3, Math.max(...referenceValues.map(getDecimalPlaces)))
    const formatted = num.toFixed(maxDecimals)
    // Remove trailing zeros but keep at least the precision of input
    return parseFloat(formatted).toString()
  }

  // Helper function to get the increment for next min value based on decimal precision
  const getDynamicIncrement = (value: number, allMaxValues: number[]): number => {
    const maxDecimals = Math.min(3, Math.max(...allMaxValues.map(getDecimalPlaces)))
    return Math.pow(10, -maxDecimals)
  }

  const generateLabelForClass = (cls: ClassificationRange, index: number, totalCount: number, allClassifications?: ClassificationRange[]): string => {
    // Check if this is GIRI data - don't update GIRI labels
    const isGIRIData = category?.id === 'giri' || 
                      category?.type === 'giri' || 
                      category?.id === 'flood' || 
                      category?.id === 'drought'
    
    if (isGIRIData) {
      return cls.label // Keep original GIRI labels unchanged
    }

    // Get all max values for determining precision
    const allMaxValues = allClassifications ? allClassifications.map(c => c.max) : [cls.max]
    
    if (index === 0) {
      // First class: <= max value with dynamic precision
      const maxFormatted = formatWithDynamicPrecision(cls.max, allMaxValues)
      return `<= ${maxFormatted}`
    } else if (index === totalCount - 1) {
      // Last class: > previous class max value with dynamic precision
      const prevClassMax = allClassifications ? allClassifications[index - 1].max : cls.min
      const maxFormatted = formatWithDynamicPrecision(prevClassMax, allMaxValues)
      return `> ${maxFormatted}`
    } else {
      // Middle classes: min - max with dynamic precision
      const minFormatted = formatWithDynamicPrecision(cls.min, allMaxValues)
      const maxFormatted = formatWithDynamicPrecision(cls.max, allMaxValues)
      return `${minFormatted} - ${maxFormatted}`
    }
  }

  const updateClassification = (id: string, field: keyof ClassificationRange, value: any) => {
    if (field === 'max') {
      const numValue = parseFloat(value)
      
      // Validate that max value is within raster bounds
      if (!rasterStats) return
      
      if (numValue < rasterStats.min || numValue > rasterStats.max) {
        toast.error(`Max value must be between ${rasterStats.min} and ${rasterStats.max}`)
        return
      }
      
      // When updating max value, automatically update next class's min and update labels
      setClassifications(prev => {
        // First, update the current class
        const updated = prev.map((cls, index) => 
          cls.id === id ? { 
            ...cls, 
            [field]: numValue
          } : cls
        )
        
        // Find current class index
        const currentIndex = updated.findIndex(cls => cls.id === id)
        
        // If not the last class, update next class's min with dynamic increment
        if (currentIndex >= 0 && currentIndex < updated.length - 1) {
          // Get all max values to determine precision
          const allMaxValues = updated.map(c => c.max)
          const increment = getDynamicIncrement(numValue, allMaxValues)
          const nextMin = numValue + increment
          
          updated[currentIndex + 1] = {
            ...updated[currentIndex + 1],
            min: nextMin
          }
        }
        
        // Now update all labels with the new classification data
        return updated.map((cls, index) => ({
          ...cls,
          label: generateLabelForClass(cls, index, updated.length, updated)
        }))
      })
    } else {
      setClassifications(prev => 
        prev.map(cls => 
          cls.id === id ? { ...cls, [field]: value } : cls
        )
      )
    }
  }

  const validateClassifications = () => {
    if (!rasterStats) return false
    
    // Check that first class starts with min and last ends with max
    const sortedClasses = [...classifications].sort((a, b) => a.min - b.min)
    
    if (Math.abs(sortedClasses[0].min - rasterStats.min) > 0.001) {
      toast.error('First class must start with the minimum value')
      return false
    }
    
    if (Math.abs(sortedClasses[sortedClasses.length - 1].max - rasterStats.max) > 0.001) {
      toast.error('Last class must end with the maximum value')
      return false
    }
    
    // Check for logical sequence (each max should be less than or equal to next min)
    for (let i = 0; i < sortedClasses.length - 1; i++) {
      if (sortedClasses[i].max > sortedClasses[i + 1].min) {
        toast.error(`Class ${i + 1} max value (${sortedClasses[i].max}) cannot be greater than Class ${i + 2} min value (${sortedClasses[i + 1].min})`)
        return false
      }
    }
    
    // Check that all values are within raster bounds
    for (let i = 0; i < sortedClasses.length; i++) {
      if (sortedClasses[i].min < rasterStats.min || sortedClasses[i].max > rasterStats.max) {
        toast.error(`All classification values must be between ${rasterStats.min} and ${rasterStats.max}`)
        return false
      }
    }
    
    return true
  }

  const handleComplete = () => {
    if (!validateClassifications()) return
    
    const config = {
      type: 'raster',
      category: category.id,
      country,
      files: files.map(f => f.name),
      statistics: rasterStats,
      classifications,
      timestamp: Date.now()
    }
    
    onComplete(config)
  }

  const applyTemplate = (templateId: string) => {
    if (!templates || !templates[templateId]) return
    
    const template = templates[templateId]
    if (template && template.classifications) {
      // Apply template and regenerate labels with dynamic precision
      const classificationsWithUpdatedLabels = template.classifications.map((cls: ClassificationRange, index: number) => ({
        ...cls,
        label: generateLabelForClass(cls, index, template.classifications.length, template.classifications)
      }))
      setClassifications(classificationsWithUpdatedLabels)
      toast.success('Template applied successfully')
    }
  }

  useEffect(() => {
    if (files.length > 0) {
      analyzeRaster(files[0].file)
    }
  }, [files])

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Raster Classification Configuration
              </CardTitle>
              <CardDescription>
                Configure classification ranges and colors for {category.name}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={onBack} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isAnalyzing ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">Analyzing raster data...</p>
            </div>
          ) : rasterStats ? (
            <div className="space-y-6">
              {/* Raster Statistics */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-blue-600">{rasterStats.min.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">Minimum</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-red-600">{rasterStats.max.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">Maximum</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-green-600">{rasterStats.mean.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">Mean</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-purple-600">{rasterStats.stdDev.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">Std Dev</p>
                  </CardContent>
                </Card>
              </div>

              {/* GIRI Information Banner */}
              {(category?.id === 'giri' || category?.type === 'giri' || 
                category?.id === 'flood' || category?.id === 'drought') && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-blue-900 mb-2">GIRI Hazard Classification</h4>
                        <div className="text-sm text-blue-800 space-y-1">
                          <p>• <strong>Fixed Ranges:</strong> GIRI data uses standardized classification ranges that cannot be modified</p>
                          <p>• <strong>Unit Detection:</strong> Automatically detects if data is in millimeters ({'>'}100) or meters (≤100)</p>
                          <p>• <strong>Standard Categories:</strong> {'<'}1m, 1-2m, 2-5m, 5-10m, {'>'}10m (labels always shown in meters)</p>
                          <p>• <strong>Color Schemes:</strong> 
                            {(() => {
                              const fileName = files[0]?.name?.toLowerCase() || '';
                              const categoryName = category?.name?.toLowerCase() || '';
                              const isFlood = fileName.includes('flood') || fileName.includes('inundation') || categoryName.includes('flood');
                              const isDrought = fileName.includes('drought') || fileName.includes('dry') || categoryName.includes('drought');
                              
                              if (isFlood) return ' Blues for flood risk intensity';
                              if (isDrought) return ' Oranges/browns for drought severity';
                              return ' Auto-detected based on filename/category';
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Template Selection */}
              <div>
                <Label htmlFor="template-select">Apply Existing Template (Optional)</Label>
                <Select value={selectedTemplate} onValueChange={(value) => {
                  setSelectedTemplate(value)
                  if (value) applyTemplate(value)
                }}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select a classification template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates && Object.entries(templates).map(([id, template]: [string, any]) => (
                      <SelectItem key={id} value={id}>
                        {template.name} ({template.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Classification Configuration */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <TrendUp className="w-5 h-5" />
                  <h3 className="text-lg font-semibold">Classification Ranges</h3>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">Automatic Classification Rules:</p>
                      <ul className="space-y-1 text-blue-700">
                        <li>• First class minimum is automatically set to raster minimum ({rasterStats?.min})</li>
                        <li>• Last class maximum is automatically set to raster maximum ({rasterStats?.max})</li>
                        <li>• When you enter a max value, the next class minimum auto-adjusts (e.g., 5.41 → 5.42)</li>
                        <li>• You only need to enter 4 max values - minimums are calculated automatically</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {classifications.map((cls, index) => (
                    <div key={cls.id} className="grid grid-cols-12 gap-3 items-center p-3 border rounded-lg">
                      <div className="col-span-2">
                        <Label className="text-sm">Class {index + 1}</Label>
                      </div>
                      
                      <div className="col-span-2">
                        <Input
                          type="number"
                          value={cls.min}
                          onChange={(e) => updateClassification(cls.id, 'min', parseFloat(e.target.value))}
                          step="0.01"
                          disabled={true} // All mins are auto-calculated
                          className="bg-muted"
                          placeholder="Auto-calculated"
                        />
                      </div>
                      
                      <div className="col-span-1 text-center text-muted-foreground">to</div>
                      
                      <div className="col-span-2">
                        <Input
                          type="number"
                          value={cls.max}
                          onChange={(e) => updateClassification(cls.id, 'max', parseFloat(e.target.value))}
                          step="0.01"
                          disabled={
                            index === classifications.length - 1 || // Last max is fixed to raster max
                            category?.id === 'giri' || category?.type === 'giri' || // GIRI ranges are fixed
                            category?.id === 'flood' || category?.id === 'drought'
                          }
                          className={
                            index === classifications.length - 1 || 
                            category?.id === 'giri' || category?.type === 'giri' ||
                            category?.id === 'flood' || category?.id === 'drought'
                            ? "bg-muted" : ""
                          }
                          placeholder={
                            index === classifications.length - 1 ? "Auto-calculated" : 
                            (category?.id === 'giri' || category?.type === 'giri' || 
                             category?.id === 'flood' || category?.id === 'drought') ? "Fixed GIRI range" : "Enter max value"
                          }
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={cls.color}
                            onChange={(e) => updateClassification(cls.id, 'color', e.target.value)}
                            className="w-8 h-8 rounded border cursor-pointer flex-shrink-0"
                          />
                          <Input
                            type="text"
                            value={cls.color}
                            onChange={(e) => {
                              let value = e.target.value.trim()
                              // Add # if missing and valid hex characters
                              if (value && !value.startsWith('#') && /^[0-9A-Fa-f]{3,6}$/.test(value)) {
                                value = '#' + value
                              }
                              updateClassification(cls.id, 'color', value)
                            }}
                            onPaste={(e) => {
                              e.preventDefault()
                              let value = e.clipboardData.getData('text').trim()
                              // Add # if missing and valid hex characters
                              if (value && !value.startsWith('#') && /^[0-9A-Fa-f]{3,6}$/.test(value)) {
                                value = '#' + value
                              }
                              updateClassification(cls.id, 'color', value)
                            }}
                            placeholder="#000000"
                            className="font-mono text-sm"
                            maxLength={7}
                          />
                        </div>
                      </div>
                      
                      <div className="col-span-3">
                        <Input
                          type="text"
                          value={cls.label}
                          onChange={(e) => updateClassification(cls.id, 'label', e.target.value)}
                          disabled={
                            category?.id === 'giri' || category?.type === 'giri' || // GIRI labels are fixed
                            category?.id === 'flood' || category?.id === 'drought'
                          }
                          className={
                            category?.id === 'giri' || category?.type === 'giri' ||
                            category?.id === 'flood' || category?.id === 'drought'
                            ? "bg-muted" : ""
                          }
                          placeholder={
                            category?.id === 'giri' || category?.type === 'giri' ||
                            category?.id === 'flood' || category?.id === 'drought'
                            ? "Fixed GIRI label" : "Class label"
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onBack}>
                  Cancel
                </Button>
                <Button onClick={handleComplete} className="gap-2">
                  Complete Configuration
                  <TrendUp className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No raster data to analyze</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}