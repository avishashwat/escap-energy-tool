// CSV Data Types for Dashboard Integration
// Created: October 6, 2025

export interface ClimateRow {
  variable: string // Format: "precipitation - ssp1 - 2021-2040 - annual"
  regions: Record<string, number> // Regional data by province/district
}

export interface GIRIRow {
  hazard: string // e.g., "Flood"
  ssp: string // e.g., "SSP1", "existing", "RCP26"
  height: string // e.g., "5-10m", "cat4", "<1m"
  energySector: string // e.g., "Hydropower"
  regions: Record<string, number> // Regional exposure percentages
}

export interface OverlayInfo {
  name: string // e.g., "Precipitation", "Mean Temperature"
  type: string // "Climate", "GIRI", "Energy"
  scenario?: string // e.g., "ssp1", "ssp2", "historical"
  year?: string // e.g., "2021-2040", "2041-2060"
  season?: string // e.g., "annual", "jun - aug", "nov - feb"
  height?: string // For GIRI data: "5-10m", "cat4"
}

export interface DashboardCSVData {
  climateData: ClimateRow[]
  giriData: GIRIRow[]
  loading: boolean
  error: string | null
}