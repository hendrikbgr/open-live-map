import { Layers, ChevronDown, ChevronRight, Lock } from 'lucide-react'
import { useState } from 'react'
import { useMapStore } from '../../store/mapStore'
import { useFlightStore } from '../../store/flightStore'
import { useVesselStore } from '../../store/vesselStore'
import { LAYER_META } from '../../config/mapStyles'
import type { MapLayers } from '../../types/map'

type LayerKey = keyof MapLayers

interface LayerRowProps {
  id: LayerKey
  comingSoon?: boolean
}

function LayerRow({ id, comingSoon }: LayerRowProps) {
  const { layers, toggleLayer, baseStyle } = useMapStore()
  const aircraftCount = useFlightStore((s) => s.aircraftCount)
  const isFetching = useFlightStore((s) => s.isFetching)
  const vesselCount = useVesselStore((s) => s.vesselCount)
  const isVesselConnected = useVesselStore((s) => s.isConnected)
  const meta = LAYER_META[id]
  const enabled = layers[id]
  const available = meta.availableIn.includes(baseStyle)

  const isDisabled = comingSoon || !available

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded transition-colors
        ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-surface-600 cursor-pointer'}
      `}
      onClick={() => !isDisabled && toggleLayer(id)}
    >
      {/* Toggle */}
      <div
        className={`relative flex-shrink-0 w-8 h-4 rounded-full transition-colors
          ${enabled && !isDisabled ? 'bg-accent' : 'bg-surface-500'}
        `}
      >
        <span
          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform
            ${enabled && !isDisabled ? 'translate-x-4' : 'translate-x-0.5'}
          `}
        />
      </div>

      {/* Label */}
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-slate-300 leading-none mb-0.5 font-medium">
          {meta.label}
        </span>
        <span className="block text-[10px] font-mono text-muted truncate">
          {meta.description}
        </span>
      </span>

      {/* Live count badge for flights */}
      {id === 'flights' && enabled && !isDisabled && (
        <span className="flex items-center gap-1 text-[9px] font-mono text-accent-glow border border-accent/30 bg-accent/10 rounded px-1.5 py-0.5 min-w-[28px] justify-center">
          {isFetching && aircraftCount === 0 ? '···' : aircraftCount}
        </span>
      )}

      {/* Live count badge for vessels */}
      {id === 'ais' && enabled && !isDisabled && (
        <span className="flex items-center gap-1 text-[9px] font-mono text-cyan-300 border border-cyan-400/30 bg-cyan-400/10 rounded px-1.5 py-0.5 min-w-[28px] justify-center">
          {isVesselConnected ? vesselCount : '···'}
        </span>
      )}

      {/* Coming soon badge */}
      {comingSoon && (
        <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-muted border border-border rounded px-1.5 py-0.5">
          <Lock size={8} />
          Soon
        </span>
      )}
    </div>
  )
}

interface GroupProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

function LayerGroup({ title, children, defaultOpen = true }: GroupProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-1 py-1.5 text-[10px] font-mono uppercase tracking-widest text-muted hover:text-slate-400 transition-colors"
      >
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {title}
      </button>
      {open && <div className="space-y-0.5">{children}</div>}
    </div>
  )
}

export function LayerPanel() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Layers size={14} className="text-muted" />
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted">Layers</p>
      </div>

      <LayerGroup title="Display">
        <LayerRow id="labels" />
        <LayerRow id="terrain3D" />
        <LayerRow id="hillshading" />
        <LayerRow id="buildings" />
      </LayerGroup>

      <LayerGroup title="Overlays">
        <LayerRow id="contours" />
        <LayerRow id="graticule" />
      </LayerGroup>

      <LayerGroup title="Live Data" defaultOpen={true}>
        <LayerRow id="flights" />
        <LayerRow id="weather" />
        <LayerRow id="ais" />
        <LayerRow id="traffic" />
      </LayerGroup>
    </div>
  )
}
