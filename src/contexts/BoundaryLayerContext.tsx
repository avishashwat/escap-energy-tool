import React, { createContext, useContext, useState, useCallback } from 'react'
import { boundaryTileService } from '../services/boundaryTileService'

interface BoundaryLayerEvent {
  type: 'layer_added' | 'layer_removed' | 'layer_updated'
  layerId: string
  layerConfig?: any
}

interface BoundaryLayerContextType {
  layers: any[]
  refreshLayers: () => Promise<void>
  addLayer: (layerConfig: any) => void
  removeLayer: (layerId: string) => void
  addEventListener: (callback: (event: BoundaryLayerEvent) => void) => () => void
}

const BoundaryLayerContext = createContext<BoundaryLayerContextType | null>(null)

export const useBoundaryLayers = () => {
  const context = useContext(BoundaryLayerContext)
  if (!context) {
    throw new Error('useBoundaryLayers must be used within BoundaryLayerProvider')
  }
  return context
}

export const BoundaryLayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [layers, setLayers] = useState<any[]>([])
  const [eventListeners, setEventListeners] = useState<((event: BoundaryLayerEvent) => void)[]>([])

  const notifyListeners = useCallback((event: BoundaryLayerEvent) => {
    eventListeners.forEach(listener => listener(event))
  }, [eventListeners])

  const refreshLayers = useCallback(async () => {
    try {
      const allConfigs = boundaryTileService.getAllTileConfigs()
      setLayers(allConfigs)
    } catch (error) {
      console.error('Failed to refresh layers:', error)
    }
  }, [])

  const addLayer = useCallback((layerConfig: any) => {
    setLayers(prev => {
      const exists = prev.find(layer => layer.id === layerConfig.id)
      if (exists) return prev
      
      const newLayers = [...prev, layerConfig]
      notifyListeners({ type: 'layer_added', layerId: layerConfig.id, layerConfig })
      return newLayers
    })
  }, [notifyListeners])

  const removeLayer = useCallback((layerId: string) => {
    setLayers(prev => {
      const filtered = prev.filter(layer => layer.id !== layerId)
      notifyListeners({ type: 'layer_removed', layerId })
      return filtered
    })
  }, [notifyListeners])

  const addEventListener = useCallback((callback: (event: BoundaryLayerEvent) => void) => {
    setEventListeners(prev => [...prev, callback])
    
    // Return cleanup function
    return () => {
      setEventListeners(prev => prev.filter(listener => listener !== callback))
    }
  }, [])

  // Load initial layers
  React.useEffect(() => {
    refreshLayers()
  }, [refreshLayers])

  return (
    <BoundaryLayerContext.Provider 
      value={{ 
        layers, 
        refreshLayers, 
        addLayer, 
        removeLayer, 
        addEventListener 
      }}
    >
      {children}
    </BoundaryLayerContext.Provider>
  )
}