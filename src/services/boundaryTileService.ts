/**
 * High-Performance Boundary Service using GeoServer Vector Tiles
 * Leverages MBTiles for snappy performance
 */
import { SparkFallback } from '../utils/sparkFallback'

export interface BoundaryTileConfig {
  id: string
  name: string
  country: string
  adminLevel: number
  geoserverLayer: string
  mbtilesPath: string
  tileUrl: string
  minZoom: number
  maxZoom: number
  attribution: string
  hoverAttribute: string
  boundingBox: [number, number, number, number] // [minLon, minLat, maxLon, maxLat]
}

export interface TileServiceConfig {
  geoserverUrl: string
  workspace: string
  username?: string
  password?: string
}

class BoundaryTileService {
  private config: TileServiceConfig | null = null
  private tileConfigs: Map<string, BoundaryTileConfig> = new Map()

  constructor() {
    this.initializeService()
  }

  private async initializeService() {
    try {
      // Load GeoServer configuration
      const config = await SparkFallback.get<TileServiceConfig>('boundary_tile_config')
      if (config) {
        this.config = config
      }
    } catch (error) {
      console.warn('Failed to load boundary tile config:', error)
    }
  }

  /**
   * Configure the tile service
   */
  async setConfig(config: TileServiceConfig): Promise<void> {
    this.config = config
    try {
      await SparkFallback.set('boundary_tile_config', config)
    } catch (error) {
      console.warn('Failed to save boundary tile config:', error)
      localStorage.setItem('boundary_tile_config', JSON.stringify(config))
    }
  }

  /**
   * Process uploaded shapefile to create vector tiles
   */
  async processShapefileToTiles(
    file: File,
    country: string,
    adminLevel: number,
    hoverAttribute: string
  ): Promise<BoundaryTileConfig> {
    if (!this.config) {
      throw new Error('Tile service not configured')
    }

    const layerName = `${country}_admin_${adminLevel}_${Date.now()}`
    const formData = new FormData()
    formData.append('shapefile', file)
    formData.append('layerName', layerName)
    formData.append('workspace', this.config.workspace)
    formData.append('country', country)
    formData.append('adminLevel', adminLevel.toString())

    try {
      // Upload and process shapefile via backend API
      const response = await fetch('/api/geoserver/upload-shapefile', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const result = await response.json()
      
      const tileConfig: BoundaryTileConfig = {
        id: `boundary_${country}_${adminLevel}_${Date.now()}`,
        name: `${country} Admin Level ${adminLevel}`,
        country,
        adminLevel,
        geoserverLayer: `${this.config.workspace}:${layerName}`,
        mbtilesPath: result.mbtilesPath,
        tileUrl: `${this.config.geoserverUrl}/gwc/service/wmts?` +
                `SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&` +
                `LAYER=${this.config.workspace}:${layerName}&` +
                `STYLE=&TILEMATRIXSET=EPSG:3857&` +
                `TILEMATRIX=EPSG:3857:{z}&TILEROW={y}&TILECOL={x}&` +
                `FORMAT=application/vnd.mapbox-vector-tile`,
        minZoom: 0,
        maxZoom: 14,
        attribution: 'UN ESCAP',
        hoverAttribute,
        boundingBox: result.boundingBox
      }

      // Store tile configuration
      this.tileConfigs.set(tileConfig.id, tileConfig)
      await this.saveTileConfigs()

      return tileConfig
    } catch (error) {
      console.error('Failed to process shapefile to tiles:', error)
      throw error
    }
  }

  /**
   * Get tile configuration for a country
   */
  getTileConfigByCountry(country: string, adminLevel?: number): BoundaryTileConfig | null {
    for (const config of this.tileConfigs.values()) {
      if (config.country === country && (!adminLevel || config.adminLevel === adminLevel)) {
        return config
      }
    }
    return null
  }

  /**
   * Get all tile configurations
   */
  getAllTileConfigs(): BoundaryTileConfig[] {
    return Array.from(this.tileConfigs.values())
  }

  /**
   * Create OpenLayers vector tile layer
   */
  createVectorTileLayer(config: BoundaryTileConfig): any {
    // This would return an OpenLayers VectorTile layer
    // Implementation depends on your OpenLayers setup
    return {
      type: 'vector-tile',
      source: {
        type: 'vector-tile',
        url: config.tileUrl,
        format: 'mvt', // Mapbox Vector Tiles
        minZoom: config.minZoom,
        maxZoom: config.maxZoom
      },
      style: {
        // Default styling - can be customized
        'fill-color': 'rgba(255, 255, 255, 0.1)',
        'stroke-color': '#3b82f6',
        'stroke-width': 2
      },
      metadata: {
        id: config.id,
        country: config.country,
        adminLevel: config.adminLevel,
        hoverAttribute: config.hoverAttribute
      }
    }
  }

  /**
   * Get feature info at point (for hover/click)
   */
  async getFeatureInfo(
    config: BoundaryTileConfig,
    coordinate: [number, number],
    resolution: number
  ): Promise<any> {
    if (!this.config) return null

    const url = `${this.config.geoserverUrl}/wms?` +
      `SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&` +
      `LAYERS=${config.geoserverLayer}&` +
      `QUERY_LAYERS=${config.geoserverLayer}&` +
      `STYLES=&BBOX=${coordinate[0] - resolution},${coordinate[1] - resolution},${coordinate[0] + resolution},${coordinate[1] + resolution}&` +
      `FEATURE_COUNT=1&HEIGHT=1&WIDTH=1&FORMAT=image/png&` +
      `INFO_FORMAT=application/json&` +
      `CRS=EPSG:3857&X=0&Y=0`

    try {
      const response = await fetch(url)
      const data = await response.json()
      return data.features?.[0]?.properties || null
    } catch (error) {
      console.error('Failed to get feature info:', error)
      return null
    }
  }

  /**
   * Delete tile configuration and clean up GeoServer layer
   */
  async deleteTileConfig(configId: string): Promise<void> {
    const config = this.tileConfigs.get(configId)
    if (!config) return

    try {
      // Delete layer from GeoServer
      if (this.config) {
        await fetch(`/api/geoserver/layers/${config.geoserverLayer}`, {
          method: 'DELETE'
        })
      }

      // Remove from local storage
      this.tileConfigs.delete(configId)
      await this.saveTileConfigs()
    } catch (error) {
      console.error('Failed to delete tile config:', error)
      throw error
    }
  }

  private async saveTileConfigs(): Promise<void> {
    const configs = Array.from(this.tileConfigs.values())
    try {
      await SparkFallback.set('boundary_tile_configs', configs)
    } catch (error) {
      console.warn('Failed to save to Spark KV:', error)
      localStorage.setItem('boundary_tile_configs', JSON.stringify(configs))
    }
  }

  private async loadTileConfigs(): Promise<void> {
    try {
      let configs: BoundaryTileConfig[] = []
      
      try {
        configs = await SparkFallback.get<BoundaryTileConfig[]>('boundary_tile_configs') || []
      } catch (error) {
        const stored = localStorage.getItem('boundary_tile_configs')
        configs = stored ? JSON.parse(stored) : []
      }

      this.tileConfigs.clear()
      configs.forEach(config => {
        this.tileConfigs.set(config.id, config)
      })
    } catch (error) {
      console.error('Failed to load tile configs:', error)
    }
  }
}

// Singleton instance
export const boundaryTileService = new BoundaryTileService()
export default boundaryTileService