import { Globe } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import type { ViewMode } from '../../types/map'

export function ViewModeToggle() {
  const { viewMode, setViewMode } = useMapStore()

  const modes: { id: ViewMode; label: React.ReactNode }[] = [
    { id: '2D', label: '2D' },
    { id: '3D', label: '3D' },
    { id: 'Globe', label: <Globe size={12} /> },
  ]

  return (
    <div className="flex items-center gap-1 bg-surface-800 border border-border rounded p-0.5">
      {modes.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => setViewMode(id)}
          title={id}
          className={`
            px-3 py-1 text-xs font-mono font-medium rounded transition-all flex items-center justify-center
            ${viewMode === id
              ? 'bg-accent text-white shadow'
              : 'text-muted hover:text-slate-300'
            }
          `}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
