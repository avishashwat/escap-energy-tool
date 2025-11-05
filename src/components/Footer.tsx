import React from 'react'
import { Card } from '@/components/ui/card'

export function Footer() {
  return (
    <div 
      className="relative w-full bg-center bg-no-repeat flex items-center"
      style={{ 
        backgroundImage: 'url(/data/background/footer1.png)',
        backgroundSize: '100% 100%', // Fill entire container: 100% width, 100% height
        backgroundPosition: 'center center',
        height: '15px' // Compact height that matches the stretched image
      }}
    >
      <div className="relative w-full px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <p className="text-xs font-medium text-white" style={{textShadow: '2px 2px 4px rgba(0,0,0,1), -1px -1px 2px rgba(0,0,0,1), 1px -1px 2px rgba(0,0,0,1), -1px 1px 2px rgba(0,0,0,1)'}}>
              © 2025 UN ESCAP
            </p>
            <p className="text-xs text-white" style={{textShadow: '2px 2px 4px rgba(0,0,0,1), -1px -1px 2px rgba(0,0,0,1), 1px -1px 2px rgba(0,0,0,1), -1px 1px 2px rgba(0,0,0,1)'}}>
              Climate & Energy Risk Explorer
            </p>
          </div>
          <div className="flex items-center gap-6">
            <p className="text-xs text-white" style={{textShadow: '2px 2px 4px rgba(0,0,0,1), -1px -1px 2px rgba(0,0,0,1), 1px -1px 2px rgba(0,0,0,1), -1px 1px 2px rgba(0,0,0,1)'}}>
              Built with GeoServer, PostgreSQL & OpenLayers
            </p>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full shadow-lg"></div>
              <span className="text-xs text-white" style={{textShadow: '2px 2px 4px rgba(0,0,0,1), -1px -1px 2px rgba(0,0,0,1), 1px -1px 2px rgba(0,0,0,1), -1px 1px 2px rgba(0,0,0,1)'}}>System Online</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}