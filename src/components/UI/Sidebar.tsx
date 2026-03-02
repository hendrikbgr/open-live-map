import { Globe, ChevronLeft, ChevronRight } from 'lucide-react'
import { StyleSelector } from './StyleSelector'
import { LayerPanel } from './LayerPanel'
import { TerrainControls } from './TerrainControls'
import { ViewModeToggle } from './ViewModeToggle'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <>
      {/* Panel */}
      <div
        className={`
          absolute left-0 top-0 bottom-0 z-10 flex flex-col
          bg-surface-800/95 backdrop-blur-sm border-r border-border
          transition-all duration-300 ease-in-out overflow-hidden
          ${collapsed ? 'w-0' : 'w-72'}
        `}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border">
          <div className="flex items-center justify-center w-7 h-7 rounded bg-accent/20 border border-accent/30">
            <Globe size={14} className="text-accent-glow" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-white tracking-wide">OpenTIR</h1>
            <p className="text-[10px] font-mono text-muted">Geospatial Intelligence</p>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-mono text-emerald-400">LIVE</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-4">
          {/* View mode */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted px-1 mb-2">
              View
            </p>
            <div className="px-1">
              <ViewModeToggle />
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Map style */}
          <StyleSelector />

          <div className="border-t border-border" />

          {/* Layers */}
          <LayerPanel />

          {/* Terrain exaggeration slider */}
          <TerrainControls />
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-2 border-t border-border">
          <p className="text-[9px] font-mono text-muted/50 text-center">
            OpenTIR v0.1.0 · MapLibre GL JS · Open Source
          </p>
        </div>
      </div>

      {/* Collapse toggle tab */}
      <button
        onClick={onToggle}
        className="absolute top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-5 h-10
          bg-surface-700 border border-border border-l-0 rounded-r
          hover:bg-surface-600 transition-all duration-300"
        style={{ left: collapsed ? 0 : '18rem' }}
        title={collapsed ? 'Open panel' : 'Close panel'}
      >
        {collapsed
          ? <ChevronRight size={12} className="text-muted" />
          : <ChevronLeft size={12} className="text-muted" />
        }
      </button>
    </>
  )
}
