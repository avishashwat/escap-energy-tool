import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Globe, MapPin, ChartBar, Sidebar as SidebarIcon, GearSix } from '@phosphor-icons/react'
import { COUNTRIES_LIST } from '@/constants/countries'
import { LocalAuth } from '@/utils/localAuth'

interface HeaderProps {
  selectedCountry: string
  onCountryChange: (country: string) => void
  mapLayout: number
  onLayoutChange: (layout: number) => void
  showDashboard: boolean
  onToggleDashboard: () => void
  basemap: string
  onBasemapChange: (basemap: string) => void
  showSidebar: boolean
  onToggleSidebar: () => void
  highlightBasemap?: boolean
}

// Use centralized country constants
const countries = COUNTRIES_LIST

const basemaps = [
  { id: 'none', name: 'No Basemap' },
  { id: 'osm', name: 'OpenStreetMap' },
  { id: 'satellite', name: 'Satellite' },
  { id: 'terrain', name: 'Terrain' },
  { id: 'street', name: 'Street Map' }
]

const layouts = [
  { value: 1, label: '1 Map' },
  { value: 2, label: '2 Maps' },
  { value: 4, label: '4 Maps' }
]

export function Header({ 
  selectedCountry, 
  onCountryChange, 
  mapLayout, 
  onLayoutChange,
  showDashboard,
  onToggleDashboard,
  basemap,
  onBasemapChange,
  showSidebar,
  onToggleSidebar,
  highlightBasemap = false
}: HeaderProps) {
  return (
    <Card className="rounded-none border-x-0 border-t-0 relative overflow-hidden">
      {/* Header Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: 'url(/data/background/header.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />
      <div className="relative flex items-center px-4 sm:px-6 py-1 h-12 gap-2 sm:gap-4">
        {/* Header Text - Top Left */}
        <div className="flex-shrink-0 max-w-[200px] sm:max-w-[300px] lg:max-w-none">
          <h1 className="text-lg sm:text-xl font-bold text-white drop-shadow-lg leading-tight truncate" style={{textShadow: '3px 3px 6px rgba(0,0,0,0.9)'}}>Climate & Energy Risk Explorer</h1>
        </div>

        {/* Central Controls */}
        <div className="flex-1 flex items-center justify-center gap-1 sm:gap-2 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-white drop-shadow-md" />
            <Select value={selectedCountry} onValueChange={onCountryChange}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SelectTrigger className="w-24 sm:w-28 lg:w-32 h-7 flex-shrink-0">
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs bg-slate-800 text-white border border-slate-600">
                  <div className="space-y-1">
                    <div className="font-semibold text-blue-200">🌍 Select Country</div>
                    <div className="text-sm">Choose your area of interest to view climate data, energy infrastructure, and disaster risks. Start here to focus analysis on a specific nation's vulnerability patterns.</div>
                  </div>
                </TooltipContent>
              </Tooltip>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country.value} value={country.value}>
                    {country.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showSidebar ? "default" : "outline"}
                size="sm"
                onClick={onToggleSidebar}
                className="flex items-center gap-1 sm:gap-2 h-7 w-16 sm:w-20 lg:w-24 px-1 sm:px-2 text-xs border-2 border-black flex-shrink-0"
              >
                <SidebarIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Layers</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs bg-slate-800 text-white border border-slate-600">
              <div className="space-y-1">
                <div className="font-semibold text-green-200">📊 Layer Panel</div>
                <div className="text-sm">Access data controls to add climate variables, disaster hazard maps, and energy infrastructure. Essential for building your analysis by overlaying relevant datasets.</div>
              </div>
            </TooltipContent>
          </Tooltip>
          
          <div className="hidden lg:flex items-center gap-1 xl:gap-2 flex-shrink-0">
            <MapPin className="w-4 h-4 text-white drop-shadow-md" />
            <span className="text-xs xl:text-sm text-white drop-shadow-md" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>Maps:</span>
            <div className="flex gap-1">
              {layouts.map((layout) => (
                <Tooltip key={layout.value}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={mapLayout === layout.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => onLayoutChange(layout.value)}
                      className="h-6 xl:h-7 w-8 xl:w-12 px-1 text-xs border-2 border-black"
                    >
                      {layout.value}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs bg-slate-800 text-white border border-slate-600">
                    <div className="space-y-1">
                      <div className="font-semibold text-purple-200">
                        {layout.value === 1 && "🗺️ Single Map View"}
                        {layout.value === 2 && "🔄 Dual Map View"}
                        {layout.value === 4 && "📊 Multi Map View"}
                      </div>
                      <div className="text-sm">
                        {layout.value === 1 && "Single map focus for detailed analysis of one dataset"}
                        {layout.value === 2 && "Side-by-side comparison of two different datasets or time periods"}
                        {layout.value === 4 && "Four-panel view for comprehensive multi-variable analysis and correlation studies"}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
          
          <div className={`flex items-center gap-1 sm:gap-2 ${highlightBasemap ? 'animate-pulse bg-yellow-200/20 px-2 py-1 rounded-lg border-2 border-yellow-300' : ''}`}>
            <span className="hidden sm:inline text-sm text-white drop-shadow-md" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>Basemap:</span>
            <Select value={basemap} onValueChange={onBasemapChange}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SelectTrigger className="w-32 sm:w-40 h-7">
                    <SelectValue placeholder="Basemap" />
                  </SelectTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs bg-slate-800 text-white border border-slate-600">
                  <div className="space-y-1">
                    <div className="font-semibold text-amber-200">🗺️ Background Map</div>
                    <div className="text-sm">Choose the underlying map style. Satellite view shows real terrain, Street maps display roads and cities, while 'No Basemap' focuses purely on your data layers.</div>
                  </div>
                </TooltipContent>
              </Tooltip>
              <SelectContent>
                {basemaps.map((map) => (
                  <SelectItem key={map.id} value={map.id}>
                    {map.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showDashboard ? "default" : "outline"}
                size="sm"
                onClick={onToggleDashboard}
                className="flex items-center gap-1 sm:gap-2 h-7 w-20 sm:w-24 lg:w-28 px-1 sm:px-2 text-xs border-2 border-black flex-shrink-0"
              >
                <ChartBar className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs bg-slate-800 text-white border border-slate-600">
              <div className="space-y-1">
                <div className="font-semibold text-cyan-200">📈 Analytics Dashboard</div>
                <div className="text-sm">View detailed charts, statistics, and trends for your selected data layers. Essential for understanding patterns, correlations, and quantitative insights from climate and energy data.</div>
              </div>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
              try {
                console.log('🎯 Header: Admin button clicked - checking authentication')
                
                // Check for existing valid authentication
                const authData = await LocalAuth.getAuth()
                console.log('🔍 Header: Retrieved auth data:', authData)
                
                if (authData && authData.expires) {
                  const timeLeft = authData.expires - Date.now()
                  console.log('🔍 Header: Time left in session:', Math.ceil(timeLeft / 60000), 'minutes')
                  
                  if (timeLeft > 0) {
                    console.log('✅ Header: Valid authentication found, extending session and navigating to admin')
                    // Extend session since user is actively accessing admin
                    await LocalAuth.extendSession(60)
                    console.log('✅ Header: Session extended before navigation')
                  } else {
                    console.log('❌ Header: Session expired, cleaning up')
                    await LocalAuth.deleteAuth()
                  }
                } else {
                  console.log('❌ Header: No valid auth found, will prompt for login')
                }
                
                // Navigate to admin panel (authentication will be handled by AdminApp)
                console.log('🚀 Header: Navigating to admin panel...')
                const currentUrl = new URL(window.location.href)
                currentUrl.searchParams.set('admin', 'true')
                window.location.href = currentUrl.toString()
              } catch (error) {
                console.error('❌ Header: Error checking authentication:', error)
                // Fallback: navigate anyway, let AdminApp handle authentication
                const currentUrl = new URL(window.location.href)
                currentUrl.searchParams.set('admin', 'true')
                window.location.href = currentUrl.toString()
              }
            }}
            className="flex items-center gap-1 sm:gap-2 h-7 w-20 sm:w-24 px-2 text-xs border-2 border-black"
          >
                <GearSix className="w-4 h-4" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs bg-slate-800 text-white border border-slate-600">
              <div className="space-y-1">
                <div className="font-semibold text-red-200">⚙️ System Admin</div>
                <div className="text-sm">Access data management tools, upload new datasets, configure system settings. Restricted to authorized personnel for maintaining platform resources.</div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* ESCAP Logo - Right Corner */}
        <div className="flex-shrink-0">
          <img 
            src="/data/logo/escap_logo.png" 
            alt="UN ESCAP Logo" 
            className="h-10 sm:h-12 w-auto object-contain"
          />
        </div>
      </div>
    </Card>
  )
}