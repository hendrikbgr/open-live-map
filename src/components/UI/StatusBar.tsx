import { useMapStore } from '../../store/mapStore'

function fmt(n: number, decimals = 2) {
  return n.toFixed(decimals)
}

export function StatusBar() {
  const { coordinates, zoom, pitch, bearing, baseStyle, viewMode } = useMapStore()

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
      <div className="flex items-center gap-4 bg-surface-800/90 backdrop-blur border border-border rounded px-4 py-1.5 text-[11px] font-mono text-muted whitespace-nowrap shadow-xl">
        {/* Coordinates */}
        <span className="flex items-center gap-1.5">
          <span className="text-muted/60">LAT</span>
          <span className={coordinates ? 'text-slate-300' : 'text-muted/40'}>
            {coordinates ? fmt(coordinates.lat, 5) : '—'}
          </span>
          <span className="text-muted/60 ml-1">LON</span>
          <span className={coordinates ? 'text-slate-300' : 'text-muted/40'}>
            {coordinates ? fmt(coordinates.lng, 5) : '—'}
          </span>
        </span>

        <span className="w-px h-3 bg-border" />

        {/* Zoom */}
        <span className="flex items-center gap-1.5">
          <span className="text-muted/60">ZOOM</span>
          <span className="text-slate-300">{fmt(zoom, 1)}</span>
        </span>

        <span className="w-px h-3 bg-border" />

        {/* Pitch */}
        <span className="flex items-center gap-1.5">
          <span className="text-muted/60">PITCH</span>
          <span className="text-slate-300">{fmt(pitch, 0)}°</span>
        </span>

        <span className="w-px h-3 bg-border" />

        {/* Bearing */}
        <span className="flex items-center gap-1.5">
          <span className="text-muted/60">HDG</span>
          <span className="text-slate-300">{fmt(bearing < 0 ? bearing + 360 : bearing, 0)}°</span>
        </span>

        <span className="w-px h-3 bg-border" />

        {/* Mode badges */}
        <span className="flex items-center gap-1.5">
          <span className="bg-accent/20 text-accent-glow border border-accent/30 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider">
            {viewMode}
          </span>
          <span className="bg-surface-700 text-slate-400 border border-border rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider">
            {baseStyle}
          </span>
        </span>
      </div>
    </div>
  )
}
