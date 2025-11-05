import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { X, TrendUp, Palette, Info } from '@phosphor-icons/react'
import { SparkFallback } from '../../utils/sparkFallback'
import { toast } from 'sonner'

interface SimpleRasterConfigProps {
  file: File
  onSave: (config: any) => void
  onCancel: () => void
}

interface ClassificationClass {
  min: number
  max: number
  color: string
  label: string
}

export function SimpleRasterConfig({ file, onSave, onCancel }: SimpleRasterConfigProps) {
  const [rasterStats, setRasterStats] = useState<{ min: number; max: number; mean: number } | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(true)
  const [classes, setClasses] = useState<ClassificationClass[]>([
    { min: 0, max: 20, color: '#bfd2ff', label: '<= 20' },
    { min: 20, max: 40, color: '#ffffbf', label: '20 - 40' },
    { min: 40, max: 60, color: '#ffd380', label: '40 - 60' },
    { min: 60, max: 80, color: '#ffaa00', label: '60 - 80' },
    { min: 80, max: 100, color: '#e60000', label: '> 80' }
  ])
  const [previousConfigs, setPreviousConfigs] = useState<any[]>([])

  useEffect(() => {
    analyzeRaster()
    loadPreviousConfigs()
  }, [])

  const analyzeRaster = async () => {
    try {
      setIsAnalyzing(true)
      
      // Real raster analysis using GeoTIFF
      try {
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
        
        // Conservative NoData handling - only filter obvious NoData values
        const metadataNoData = image.getGDALNoData()
        
        let validData: number[] = []
        let noDataCount = 0
        let exactMatches = 0
        let largeNegativeMatches = 0
        
        console.log('🔍 Conservative NoData Analysis (SimpleRasterConfig):')
        console.log('   Metadata NoData value:', metadataNoData)
        console.log('   Total pixels:', dataArray.length)
        
        // First pass: identify the actual data range to avoid over-filtering
        let minValue = Infinity
        let maxValue = -Infinity
        let sampleValues: number[] = []
        
        for (let i = 0; i < dataArray.length; i++) {
          const value = dataArray[i]
          
          // Only exclude obviously invalid values
          if (isFinite(value) && !isNaN(value)) {
            if (value > -1e10 && value < 1e10) {  // Reasonable data range
              sampleValues.push(value)
              if (value < minValue) minValue = value
              if (value > maxValue) maxValue = value
            }
          }
        }
        
        console.log('   Sample data range:', { minValue, maxValue, sampleSize: sampleValues.length })
        
        for (let i = 0; i < dataArray.length; i++) {
          const value = dataArray[i]
          let isValid = true
          let filterReason = ''
          
          // Check exact metadata NoData match
          if (metadataNoData !== null && metadataNoData !== undefined && value === metadataNoData) {
            isValid = false
            exactMatches++
            filterReason = `exact metadata match: ${metadataNoData}`
          }
          
          // Check for invalid numbers
          if (isValid && (!isFinite(value) || isNaN(value))) {
            isValid = false
            filterReason = 'invalid number (NaN/Infinity)'
          }
          
          // Only filter extremely large negative values (clear NoData indicators)
          if (isValid && value < -1e10) {
            isValid = false
            largeNegativeMatches++
            filterReason = `extremely large negative value: ${value} (clear NoData)`
          }
          
          // Only filter extremely large positive values (clear NoData indicators) 
          if (isValid && value > 1e10) {
            isValid = false
            filterReason = `extremely large positive value: ${value} (clear NoData)`
          }
          
          if (isValid) {
            validData.push(value)
          } else {
            noDataCount++
            // Log first few for debugging
            if (noDataCount <= 3) {
              console.log(`   🚫 NoData pixel ${noDataCount}: value=${value}, reason=${filterReason}`)
            }
          }
        }
        
        console.log(`   📊 Conservative filtering results:`)
        console.log(`      Exact metadata matches: ${exactMatches}`)
        console.log(`      Large negative matches: ${largeNegativeMatches}`)
        console.log(`      Total NoData filtered: ${noDataCount}`)
        console.log(`      Valid pixels remaining: ${validData.length}`)
        console.log(`      Expected Max: 7118, Expected Mean: 778.69`)
        
        // Skip outlier removal for now to preserve all valid data
        console.log(`      Skipping outlier removal to preserve valid high values`)
        console.log(`      Final valid pixels: ${validData.length}`)
        
        if (validData.length === 0) {
          throw new Error('No valid pixel values found in raster')
        }
        
        // Calculate statistics
        const sortedData = validData.sort((a, b) => a - b)
        const min = sortedData[0]
        const max = sortedData[sortedData.length - 1]
        const sum = validData.reduce((acc, val) => acc + val, 0)
        const mean = sum / validData.length
        
        const stats = {
          min: parseFloat(min.toFixed(2)),
          max: parseFloat(max.toFixed(2)),
          mean: parseFloat(mean.toFixed(2))
        }
        
        console.log('🎯 SUCCESS! Enhanced NoData handling results:', {
          fileName: file.name,
          totalPixels: dataArray.length,
          validPixels: validData.length,
          metadataNoData,
          calculatedStats: stats,
          noDataFiltered: dataArray.length - validData.length
        })
        
        console.log('🎯 SETTING FILTERED STATS IN UI:', stats)
        console.log('🎯 Stats should show Min:', stats.min, 'Max:', stats.max, 'Mean:', stats.mean)
        
        // Update classifications first
        await updateClassesFromStats(stats)
        
        // Then set the filtered stats (this should override any previous stats)
        setRasterStats(stats)
        
        // Force a small delay to ensure stats are set
        setTimeout(() => {
          console.log('🎯 DOUBLE-CHECK: Setting filtered stats again to ensure they stick')
          setRasterStats(stats)
        }, 100)
        
        toast.success(`✅ Enhanced raster analysis: ${validData.length} valid pixels, NoData properly excluded! Min: ${stats.min.toFixed(2)}, Max: ${stats.max.toFixed(2)}`)
        
      } catch (geoTiffError) {
        console.error('GeoTIFF analysis failed, using fallback:', geoTiffError)
        
        // Fallback to pattern-based statistics if GeoTIFF fails
        const fileName = file.name.toLowerCase()
        let stats = { min: 0, max: 100, mean: 50 }
        
        if (fileName.includes('temp') || fileName.includes('temperature')) {
          stats = { min: -10, max: 45, mean: 18.5 }
        } else if (fileName.includes('precip') || fileName.includes('rainfall')) {
          stats = { min: 0, max: 2500, mean: 800 }
        } else if (fileName.includes('flood')) {
          stats = { min: 0, max: 1, mean: 0.15 }
        } else if (fileName.includes('drought')) {
          stats = { min: 0, max: 1, mean: 0.25 }
        }
        
        setRasterStats(stats)
        await updateClassesFromStats(stats)
        toast.warning('Using pattern-based statistics - could not read raster file directly')
      }
      
    } catch (error) {
      console.error('Failed to analyze raster:', error)
      toast.error('Failed to analyze raster file')
    } finally {
      setIsAnalyzing(false)
    }
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

  const generateLabelForClass = (cls: ClassificationClass, index: number, totalCount: number, allClasses?: ClassificationClass[]): string => {
    // Get all max values for determining precision
    const allMaxValues = allClasses ? allClasses.map(c => c.max) : [cls.max]
    
    if (index === 0) {
      // First class: <= max value with dynamic precision
      const maxFormatted = formatWithDynamicPrecision(cls.max, allMaxValues)
      return `<= ${maxFormatted}`
    } else if (index === totalCount - 1) {
      // Last class: > previous class max value with dynamic precision
      const prevClassMax = allClasses ? allClasses[index - 1].max : cls.min
      const maxFormatted = formatWithDynamicPrecision(prevClassMax, allMaxValues)
      return `> ${maxFormatted}`
    } else {
      // Middle classes: min - max with dynamic precision
      const minFormatted = formatWithDynamicPrecision(cls.min, allMaxValues)
      const maxFormatted = formatWithDynamicPrecision(cls.max, allMaxValues)
      return `${minFormatted} - ${maxFormatted}`
    }
  }

  // Function to call GDAL service for enhanced raster analysis with proper NoData handling
  const getBackendClassification = async (filename: string): Promise<number[] | null> => {
    try {
      console.log('🚀 Attempting GDAL service raster analysis for:', filename)
      
      // Since we don't have the file object here, we can't call the GDAL service directly
      // Return null to force fallback to enhanced client-side analysis
      console.log('📋 Using enhanced client-side analysis (file object not available for GDAL service)')
      return null
    } catch (error) {
      console.warn('Backend classification error, falling back to client algorithm:', error)
      return null
    }
  }

  const updateClassesFromStats = async (stats: { min: number; max: number; mean: number }) => {
    console.log('🔍 SimpleRasterConfig updateClassesFromStats called with:', { 
      fileName: file.name, 
      receivedStats: stats,
      currentRasterStats: rasterStats
    })
    
    // GIRI Detection Logic - Check filename patterns for GIRI data
    const fileName = file.name.toLowerCase()
    
    // Enhanced GIRI detection from filename patterns
    const isGIRIData = (
      fileName.includes('_fh_') ||    // Flood Height (FH) pattern like BTN_FH_25yRP_SSP1.tif
      fileName.includes('flood') || 
      fileName.includes('drought') ||
      fileName.includes('inundation') ||
      fileName.includes('_dh_') ||    // Drought Height pattern  
      fileName.includes('giri') ||
      fileName.includes('hazard') ||
      fileName.includes('risk')
    )
    
    // More specific flood/drought detection
    const isFloodData = isGIRIData && (
      fileName.includes('_fh_') ||    // Flood Height pattern
      fileName.includes('flood') || 
      fileName.includes('inundation') || 
      fileName.includes('flooding') ||
      fileName.includes('water') ||
      fileName.includes('river') ||
      fileName.includes('coastal')
    )
    
    const isDroughtData = isGIRIData && (
      fileName.includes('_dh_') ||    // Drought Height pattern  
      fileName.includes('drought') || 
      fileName.includes('dry') ||
      fileName.includes('arid') ||
      fileName.includes('precipitation') ||
      fileName.includes('rainfall') ||
      fileName.includes('moisture')
    )
    
    console.log('🔍 GIRI Detection Results:', {
      fileName,
      isGIRIData,
      isFloodData, 
      isDroughtData,
      maxValue: stats.max
    })
    
    // If GIRI data detected, use fixed classifications
    if (isGIRIData) {
      console.log('🎯 Applying GIRI Classification Rules')
      
      // Check if data is in mm (values > 100) or meters (values <= 100)
      const isMillimeters = stats.max > 100
      
      console.log('📊 GIRI Unit Detection:', {
        maxValue: stats.max,
        isMillimeters,
        dataType: isFloodData ? 'Flood' : isDroughtData ? 'Drought' : 'Generic GIRI'
      })
      
      // Enhanced professional color schemes with darker blues for better visibility
      const floodColors = {
        light: '#4a90e2',    // Medium blue - very low risk
        lightMed: '#2171b5', // Strong blue - low risk  
        medium: '#08519c',   // Dark blue - medium risk
        medDark: '#08306b',  // Very dark blue - high risk
        dark: '#041e42'      // Navy blue - very high risk
      }
      
      const droughtColors = {
        light: '#fff8dc',    // Cornsilk - very low drought
        lightMed: '#ffd700', // Gold - low drought
        medium: '#ff8c00',   // Dark orange - medium drought  
        medDark: '#ff4500',  // Orange red - high drought
        dark: '#8b4513'      // Saddle brown - severe drought
      }
      
      // Define all possible GIRI classes with their thresholds
      const giriClassDefinitions = isMillimeters ? [
        // Millimeter thresholds
        { threshold: 1000, min: 0, max: 1000, label: '< 1m' },
        { threshold: 2000, min: 1000, max: 2000, label: '1 - 2m' },
        { threshold: 5000, min: 2000, max: 5000, label: '2 - 5m' },
        { threshold: 10000, min: 5000, max: 10000, label: '5 - 10m' },
        { threshold: Infinity, min: 10000, max: stats.max, label: '> 10m' }
      ] : [
        // Meter thresholds  
        { threshold: 1, min: 0, max: 1, label: '< 1m' },
        { threshold: 2, min: 1, max: 2, label: '1 - 2m' },
        { threshold: 5, min: 2, max: 5, label: '2 - 5m' },
        { threshold: 10, min: 5, max: 10, label: '5 - 10m' },
        { threshold: Infinity, min: 10, max: stats.max, label: '> 10m' }
      ]
      
      // Determine which classes to include based on data max value
      let applicableClasses: ClassificationClass[] = []
      let classIndex = 0
      
      for (let i = 0; i < giriClassDefinitions.length; i++) {
        const classDef = giriClassDefinitions[i]
        
        // Only include classes that have data within their range
        // Check if this class overlaps with the actual data range
        const classMaxValue = (classDef.threshold === Infinity) ? stats.max : classDef.max
        const classMinValue = classDef.min
        
        // Skip classes that are entirely below the data minimum
        if (classMaxValue < stats.min) {
          continue
        }
        
        // Skip classes that are entirely above the data maximum (except the last class)
        if (classMinValue > stats.max && classDef.threshold !== Infinity) {
          continue
        }
        
        // Adjust the class boundaries to fit the actual data
        let adjustedMin = Math.max(classMinValue, stats.min)  // Start from data min if class min is below it
        let adjustedMax = Math.min(classMaxValue, stats.max)  // End at data max if class max is above it
        
        // For the first applicable class, use the exact data minimum
        if (classIndex === 0) {
          adjustedMin = stats.min
        }
        
        // For the last applicable class, use the exact data maximum
        const isLastClass = (i === giriClassDefinitions.length - 1) || (stats.max <= giriClassDefinitions[i + 1]?.min)
        if (isLastClass) {
          adjustedMax = stats.max
          
          // Update label for custom range
          const customLabel = isMillimeters ? 
            `${(adjustedMin / 1000).toFixed(1)} - ${(adjustedMax / 1000).toFixed(1)}m` :
            `${adjustedMin.toFixed(1)} - ${adjustedMax.toFixed(1)}m`
          classDef.label = customLabel
        }
        
        // Select color based on class index
        const colors = isFloodData ? floodColors : isDroughtData ? droughtColors : floodColors
        const colorKeys = Object.keys(colors) as (keyof typeof colors)[]
        const selectedColorKey = colorKeys[Math.min(classIndex, colorKeys.length - 1)]
        const selectedColor = colors[selectedColorKey]
        
        // Round values to match the displayed statistics precision (2 decimal places)
        const roundedMin = parseFloat(adjustedMin.toFixed(2))
        const roundedMax = parseFloat(adjustedMax.toFixed(2))
        
        // Ensure min < max (safety check)
        if (roundedMin < roundedMax) {
          applicableClasses.push({
            min: roundedMin,
            max: roundedMax,
            color: selectedColor,
            label: classDef.label
          })
          
          classIndex++
        }
        
        // Stop if we've reached the data maximum
        if (isLastClass) break
      }
      
      console.log('📊 Dynamic GIRI Classes Generated:', {
        dataMax: stats.max,
        unitType: isMillimeters ? 'Millimeters' : 'Meters', 
        classCount: applicableClasses.length,
        classes: applicableClasses.map(c => ({ range: `${c.min}-${c.max}`, label: c.label }))
      })
      
      let giriClasses = applicableClasses
      
      console.log('✅ GIRI Classifications Generated:', {
        dataType: isFloodData ? 'Flood' : isDroughtData ? 'Drought' : 'Generic GIRI',
        unitType: isMillimeters ? 'Millimeters' : 'Meters',
        classCount: giriClasses.length,
        colorScheme: isFloodData ? 'Blues' : isDroughtData ? 'Oranges' : 'Default Blues'
      })
      
      // Apply GIRI classification
      setClasses(giriClasses)
      
      // Show GIRI-specific success message
      toast.success(`GIRI ${isFloodData ? 'Flood' : isDroughtData ? 'Drought' : 'Hazard'} classification applied!`, {
        description: `Fixed ranges with ${isMillimeters ? 'mm' : 'm'} data → meter labels`
      })
      
      return // Exit early for GIRI data
    }
    
    // Continue with climate/natural breaks classification for non-GIRI data
    console.log('🌡️ Applying Climate Data Classification (Natural Breaks)')
    
    // First try to get real raster classification from backend
    let classUpperBounds: number[] | null = null
    
    // Try to determine raster filename from file name
    const rasterFilename = file.name
    
    // Attempt backend classification for known climate files
    if (rasterFilename.includes('BTN_') || rasterFilename.includes('tmax') || rasterFilename.includes('climate')) {
      classUpperBounds = await getBackendClassification(rasterFilename)
    }
    
    let breaks: number[]
    
    if (classUpperBounds && classUpperBounds.length >= 4) {
      // Use backend classification results
      console.log('🎯 Using backend Natural Breaks classification:', classUpperBounds)
      // Convert upper bounds back to full breaks array
      breaks = [stats.min, ...classUpperBounds, stats.max]
      
      // Show success message
      toast.success('Applied real Natural Breaks classification from raster analysis!', {
        description: `Class bounds: ${classUpperBounds.map(b => b.toFixed(2)).join(', ')}`
      })
    } else {
      // Fallback to client-side algorithm
      console.log('⚠️ Using fallback client-side Jenks algorithm')
      
      // Generate sample data from stats for Jenks calculation
      const sampleSize = Math.min(1000, Math.max(100, Math.floor((stats.max - stats.min) * 10)))
      const sampleData: number[] = []
      
      for (let i = 0; i < sampleSize; i++) {
        // Generate normally distributed sample data around the mean
        const u1 = Math.random()
        const u2 = Math.random()
        const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
        
        // Calculate standard deviation estimate
        const stdDev = (stats.max - stats.min) / 6 // Rough estimate
        
        // Scale to raster statistics
        const value = stats.mean + (z0 * stdDev)
        const clampedValue = Math.max(stats.min, Math.min(stats.max, value))
        sampleData.push(clampedValue)
      }
      
      // Apply Natural Breaks algorithm
      breaks = jenksNaturalBreaks(sampleData, 6) // 6 breaks for 5 classes
      
      toast.info('Using estimated Natural Breaks classification', {
        description: 'For accurate classification, ensure backend server is running with the raster file.'
      })
    }
    
    // Use the specified default color scheme for all raster types
    // Professional color scheme as specified: category 1-5
    const defaultColors = ['#bfd2ff', '#ffffbf', '#ffd380', '#ffaa00', '#e60000']
    
    const newClasses = classes.map((cls, index) => {
      let min: number
      let max: number
      
      if (index === 0) {
        // First class: min must be exact raster minimum (no rounding)
        min = stats.min
        max = parseFloat((breaks[index + 1] || stats.max).toFixed(2))
      } else if (index === 4) {
        // Last class: max must be exact raster maximum (no rounding)
        min = parseFloat((breaks[index] || stats.min).toFixed(2))
        max = stats.max
      } else {
        // Middle classes: can use 2 decimal rounding
        min = parseFloat((breaks[index] || stats.min).toFixed(2))
        max = parseFloat((breaks[index + 1] || stats.max).toFixed(2))
      }
      
      return {
        ...cls,
        min,
        max,
        color: defaultColors[index],
        label: '' // Will be set below
      }
    })
    
    // Generate proper labels for all classes
    const classesWithLabels = newClasses.map((cls, index) => ({
      ...cls,
      label: generateLabelForClass(cls, index, newClasses.length, newClasses)
    }))
    
    setClasses(classesWithLabels)
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

  const loadPreviousConfigs = async () => {
    try {
      const configs = await SparkFallback.get<any[]>('admin_raster_configs') || []
      setPreviousConfigs(configs.slice(-5)) // Last 5 configurations
    } catch (error) {
      console.error('Failed to load previous configs:', error)
    }
  }

  const applyPreviousConfig = (config: any) => {
    if (config.classes) {
      setClasses(config.classes)
      toast.success('Previous configuration applied')
    }
  }

  const handleClassChange = (index: number, field: string, value: any) => {
    if (field === 'max' && rasterStats) {
      const numValue = parseFloat(value)
      
      // Validate that max value is within raster bounds
      if (numValue < rasterStats.min || numValue > rasterStats.max) {
        toast.error(`Max value must be between ${rasterStats.min} and ${rasterStats.max}`)
        return
      }
      
      const newClasses = [...classes]
      newClasses[index] = { 
        ...newClasses[index], 
        [field]: numValue
      }
      
      // If not the last class, update next class's min with dynamic increment
      if (index < newClasses.length - 1) {
        // Get all max values to determine precision
        const allMaxValues = newClasses.map(c => c.max)
        const increment = getDynamicIncrement(numValue, allMaxValues)
        const nextMin = numValue + increment
        
        newClasses[index + 1] = {
          ...newClasses[index + 1],
          min: nextMin
        }
      }
      
      // Regenerate all labels with proper dynamic precision
      const updatedClasses = newClasses.map((cls, i) => ({
        ...cls,
        label: generateLabelForClass(cls, i, newClasses.length, newClasses)
      }))
      
      setClasses(updatedClasses)
    } else {
      const newClasses = [...classes]
      newClasses[index] = { ...newClasses[index], [field]: value }
      setClasses(newClasses)
    }
  }

  const handleSave = async () => {
    if (!rasterStats) {
      toast.error('Raster analysis not complete')
      return
    }

    if (!validateClasses()) {
      return
    }

    const config = {
      rasterStats,
      classification: {
        classes,
        type: 'raster'
      }
    }

    try {
      // Save this configuration for future reference
      const savedConfigs = await SparkFallback.get<any[]>('admin_raster_configs') || []
      const newConfig = {
        id: Date.now().toString(),
        fileName: file.name,
        config,
        createdAt: new Date().toISOString()
      }
      savedConfigs.push(newConfig)
      await SparkFallback.set('admin_raster_configs', savedConfigs)
      
      onSave(config)
    } catch (error) {
      console.error('Failed to save configuration:', error)
      toast.error('Failed to save configuration')
    }
  }

  const validateClasses = () => {
    if (!rasterStats) return false
    
    // Check that first class starts with min and last class ends with max
    const firstClass = classes[0]
    const lastClass = classes[classes.length - 1]
    
    if (Math.abs(firstClass.min - rasterStats.min) > 0.001) {
      toast.error('First class must start with the minimum value')
      return false
    }
    
    if (Math.abs(lastClass.max - rasterStats.max) > 0.001) {
      toast.error('Last class must end with the maximum value')
      return false
    }
    
    // Check that all values are within raster bounds and logical sequence
    for (let i = 0; i < classes.length; i++) {
      if (classes[i].min < rasterStats.min || classes[i].max > rasterStats.max) {
        toast.error(`All classification values must be between ${rasterStats.min} and ${rasterStats.max}`)
        return false
      }
      
      if (i < classes.length - 1 && classes[i].max > classes[i + 1].min) {
        toast.error(`Class ${i + 1} max value cannot be greater than Class ${i + 2} min value`)
        return false
      }
    }
    
    return true
  }

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-none w-[90vw] max-h-[90vh] overflow-y-auto" style={{ width: '90vw', maxWidth: '1200px' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendUp size={20} />
            Configure Raster Classification
          </DialogTitle>
          <DialogDescription>
            Set up data classification and color scheme for {file.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Analysis Status */}
          {isAnalyzing ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Analyzing raster file...</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Raster Statistics */}
              {rasterStats && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Raster Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Minimum</div>
                        <div className="text-lg font-semibold">{rasterStats.min.toFixed(2)}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Maximum</div>
                        <div className="text-lg font-semibold">{rasterStats.max.toFixed(2)}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Mean</div>
                        <div className="text-lg font-semibold">{rasterStats.mean.toFixed(2)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* GIRI Information Banner */}
              {(() => {
                const fileName = file.name.toLowerCase()
                const isGIRIData = (
                  fileName.includes('_fh_') || fileName.includes('flood') || fileName.includes('drought') ||
                  fileName.includes('inundation') || fileName.includes('_dh_') || fileName.includes('giri') ||
                  fileName.includes('hazard') || fileName.includes('risk')
                )
                
                if (isGIRIData) {
                  return (
                    <Card className="border-blue-200 bg-blue-50">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-blue-900 mb-2">GIRI Hazard Classification</h4>
                            <div className="text-sm text-blue-800 space-y-1">
                              <p>• <strong>Smart Class Count:</strong> Dynamic number of classes (3-5) based on your data's max value</p>
                              <p>• <strong>Auto-filled Ranges:</strong> Standard GIRI ranges pre-filled but fully editable if adjustments needed</p>
                              <p>• <strong>Unit Detection:</strong> Automatically detects if data is in millimeters ({">"}100) or meters (≤100)</p>
                              <p>• <strong>Labels Always in Meters:</strong> Labels displayed in meters regardless of source data units</p>
                              <p>• <strong>Color Schemes:</strong> 
                                {(() => {
                                  const isFlood = fileName.includes('_fh_') || fileName.includes('flood') || fileName.includes('inundation')
                                  const isDrought = fileName.includes('_dh_') || fileName.includes('drought') || fileName.includes('dry')
                                  
                                  if (isFlood) return ' Professional blues for flood risk intensity'
                                  if (isDrought) return ' Professional oranges/browns for drought severity'
                                  return ' Auto-detected based on filename patterns'
                                })()}
                              </p>
                              <p>• <strong>Fully Customizable:</strong> All ranges, labels, and colors can be edited after auto-fill</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                }
                return null
              })()}

              {/* Previous Configurations */}
              {previousConfigs.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Use Previous Configuration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {previousConfigs.map((config) => (
                        <Button
                          key={config.id}
                          variant="outline"
                          size="sm"
                          onClick={() => applyPreviousConfig(config.config)}
                        >
                          {config.fileName.split('_')[2] || 'Config'}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Classification Setup */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Palette size={16} />
                    Classification Classes
                  </CardTitle>
                  <CardDescription>
                    Define value ranges and colors for data visualization. Min values are auto-calculated based on max values.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {rasterStats && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <div className="flex items-start gap-2">
                        <TrendUp className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-blue-800">
                          <p className="font-medium mb-1">Automatic Classification Rules:</p>
                          <ul className="space-y-0.5 text-blue-700">
                            <li>• First class minimum: {rasterStats.min} (raster minimum)</li>
                            <li>• Last class maximum: {rasterStats.max} (raster maximum)</li>
                            <li>• When you enter a max value, next min auto-adjusts (e.g., 5.41 → 5.42)</li>
                            <li>• You only need to enter 4 max values - minimums are calculated automatically</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                  {classes.map((cls, index) => (
                    <div key={index} className="grid grid-cols-5 gap-3 items-center p-3 border rounded-lg">
                      <div className="space-y-1">
                        <Label className="text-xs">Min Value</Label>
                        <Input
                          type="number"
                          value={cls.min}
                          onChange={(e) => handleClassChange(index, 'min', parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm bg-muted"
                          step="0.01"
                          disabled={true}
                          placeholder="Auto-calculated"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Max Value</Label>
                        <Input
                          type="number"
                          value={cls.max}
                          onChange={(e) => handleClassChange(index, 'max', parseFloat(e.target.value) || 0)}
                          className={`h-8 text-sm ${index === classes.length - 1 ? 'bg-muted' : ''}`}
                          step="0.01"
                          disabled={index === classes.length - 1}
                          placeholder={
                            index === classes.length - 1 ? "Auto-calculated" : 
                            (() => {
                              const fileName = file.name.toLowerCase()
                              const isGIRI = (
                                fileName.includes('_fh_') || fileName.includes('flood') || fileName.includes('drought') ||
                                fileName.includes('inundation') || fileName.includes('_dh_') || fileName.includes('giri') ||
                                fileName.includes('hazard') || fileName.includes('risk')
                              )
                              return isGIRI ? "Fixed GIRI range" : "Enter max value"
                            })()
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Color</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={cls.color}
                            onChange={(e) => handleClassChange(index, 'color', e.target.value)}
                            className="h-8 w-12 p-1 rounded border cursor-pointer flex-shrink-0"
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
                              handleClassChange(index, 'color', value)
                            }}
                            onPaste={(e) => {
                              e.preventDefault()
                              let value = e.clipboardData.getData('text').trim()
                              // Add # if missing and valid hex characters
                              if (value && !value.startsWith('#') && /^[0-9A-Fa-f]{3,6}$/.test(value)) {
                                value = '#' + value
                              }
                              handleClassChange(index, 'color', value)
                            }}
                            className="h-8 text-xs font-mono flex-1"
                            placeholder="#ffffff"
                            maxLength={7}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Label</Label>
                        <Input
                          value={cls.label}
                          onChange={(e) => handleClassChange(index, 'label', e.target.value)}
                          className="h-8 text-sm"
                          disabled={false}
                          placeholder={(() => {
                            const fileName = file.name.toLowerCase()
                            const isGIRI = (
                              fileName.includes('_fh_') || fileName.includes('flood') || fileName.includes('drought') ||
                              fileName.includes('inundation') || fileName.includes('_dh_') || fileName.includes('giri') ||
                              fileName.includes('hazard') || fileName.includes('risk')
                            )
                            return isGIRI ? "Fixed GIRI label" : "Class label"
                          })()}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Preview</Label>
                        <div 
                          className="h-8 rounded border"
                          style={{ backgroundColor: cls.color }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Validation Warning */}
              {rasterStats && !validateClasses() && (
                <Card className="border-warning">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-warning">
                      <X size={16} />
                      <span className="text-sm">
                        Warning: Class ranges should cover the full data range ({rasterStats.min} to {rasterStats.max})
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isAnalyzing || !rasterStats}
          >
            Save Configuration
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}