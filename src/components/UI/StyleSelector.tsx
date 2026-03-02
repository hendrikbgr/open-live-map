import { Map, Satellite, Mountain, TrendingUp } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import type { BaseMapStyle } from '../../types/map'

const STYLES: { id: BaseMapStyle; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'road', label: 'Road', icon: <Map size={16} />, desc: 'Vector street map' },
  { id: 'satellite', label: 'Satellite', icon: <Satellite size={16} />, desc: 'ESRI World Imagery' },
  { id: 'terrain', label: 'Terrain', icon: <Mountain size={16} />, desc: 'Topographic + hillshade' },
  { id: 'elevation', label: 'Elevation', icon: <TrendingUp size={16} />, desc: 'DEM relief model' },
]

export function StyleSelector() {
  const { baseStyle, setBaseStyle } = useMapStore()

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted px-1 mb-2">
        Base Map
      </p>
      {STYLES.map(({ id, label, icon, desc }) => (
        <button
          key={id}
          onClick={() => setBaseStyle(id)}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded text-left transition-all
            ${baseStyle === id
              ? 'bg-accent/20 border border-accent/40 text-accent-glow'
              : 'bg-surface-700 border border-transparent text-slate-300 hover:bg-surface-600 hover:border-border'
            }
          `}
        >
          <span className={baseStyle === id ? 'text-accent-glow' : 'text-muted'}>{icon}</span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium leading-none mb-0.5">{label}</span>
            <span className="block text-[10px] font-mono text-muted truncate">{desc}</span>
          </span>
          {baseStyle === id && (
            <span className="w-1.5 h-1.5 rounded-full bg-accent-glow flex-shrink-0" />
          )}
        </button>
      ))}
    </div>
  )
}
