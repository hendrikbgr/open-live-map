import { X, Globe, Gauge, Wind, ArrowUpDown, Radio, Navigation, Wifi } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useFlightStore } from '../../store/flightStore'
import type { Aircraft } from '../../types/flight'

// ─── Formatting helpers ───────────────────────────────────────────────────────

function msToKnots(ms: number | null): string {
  if (ms === null) return '—'
  return `${Math.round(ms * 1.944)} kt`
}

function metersToFeet(m: number | null): string {
  if (m === null) return '—'
  return `${Math.round(m * 3.281).toLocaleString()} ft`
}

function verticalRate(vr: number | null): { text: string; cls: string } {
  if (vr === null) return { text: '—', cls: 'text-muted' }
  const fpm = Math.round(vr * 196.85)
  if (vr > 1) return { text: `+${fpm} fpm`, cls: 'text-green-400' }
  if (vr < -1) return { text: `${fpm} fpm`, cls: 'text-orange-400' }
  return { text: 'Level', cls: 'text-accent-glow' }
}

const POSITION_SOURCE = ['ADS-B', 'ASTERIX', 'MLAT', 'FLARM'] as const

// ─── Sub-components ───────────────────────────────────────────────────────────

function DataRow({
  icon: Icon,
  label,
  value,
  valueCls = 'text-slate-300',
}: {
  icon: LucideIcon
  label: string
  value: string
  valueCls?: string
}) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-mono">
      <Icon size={10} className="text-muted flex-shrink-0" />
      <span className="text-muted w-[72px] flex-shrink-0 text-[10px]">{label}</span>
      <span className={`flex-1 text-right ${valueCls}`}>{value}</span>
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

function PanelContent({ aircraft }: { aircraft: Aircraft }) {
  const { selectAircraft } = useFlightStore()
  const vr = verticalRate(aircraft.verticalRate)

  return (
    <div className="w-64 bg-surface-800/97 backdrop-blur-sm border border-border rounded shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2 bg-surface-700 border-b border-border">
        <div className="flex items-center justify-center w-5 h-5 rounded bg-accent/20 border border-accent/30 flex-shrink-0">
          <Navigation size={10} className="text-accent-glow" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="block text-xs font-semibold text-white leading-none">
            {aircraft.callsign?.trim() || aircraft.icao24.toUpperCase()}
          </span>
          {aircraft.callsign && (
            <span className="block text-[9px] font-mono text-muted mt-0.5">
              {aircraft.icao24.toUpperCase()}
            </span>
          )}
        </div>

        {/* Status chip */}
        <span
          className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0 ${
            aircraft.onGround
              ? 'bg-violet-400/15 text-violet-300 border-violet-400/30'
              : 'bg-accent/15 text-accent-glow border-accent/30'
          }`}
        >
          {aircraft.onGround ? 'Ground' : 'Airborne'}
        </span>

        <button
          onClick={() => selectAircraft(null)}
          className="text-muted hover:text-slate-200 transition-colors ml-1 flex-shrink-0"
          aria-label="Close"
        >
          <X size={12} />
        </button>
      </div>

      {/* Data */}
      <div className="px-3 py-2.5 space-y-1.5">
        <DataRow icon={Globe} label="COUNTRY" value={aircraft.originCountry} />
        <DataRow icon={Gauge} label="ALTITUDE" value={metersToFeet(aircraft.baroAltitude)} />
        <DataRow icon={Wind} label="SPEED" value={msToKnots(aircraft.velocity)} />
        <DataRow
          icon={ArrowUpDown}
          label="VERT RATE"
          value={vr.text}
          valueCls={vr.cls}
        />
        <DataRow
          icon={Navigation}
          label="HEADING"
          value={aircraft.trueTrack != null ? `${Math.round(aircraft.trueTrack)}°` : '—'}
        />
        {aircraft.squawk && (
          <DataRow icon={Radio} label="SQUAWK" value={aircraft.squawk} />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border">
        <span className="flex items-center gap-1 text-[9px] font-mono text-muted/60">
          <Wifi size={8} />
          {POSITION_SOURCE[aircraft.positionSource] ?? 'Unknown'}
        </span>
        <span className="text-[9px] font-mono text-muted/60">
          {new Date(aircraft.lastContact * 1000).toLocaleTimeString()}
        </span>
      </div>
    </div>
  )
}

export function FlightPanel() {
  const selectedAircraftId = useFlightStore((s) => s.selectedAircraftId)
  const aircraftMap = useFlightStore((s) => s.aircraftMap)

  if (!selectedAircraftId) return null

  const aircraft = aircraftMap.get(selectedAircraftId)
  if (!aircraft) return null

  return (
    <div className="absolute bottom-14 right-4 z-30 pointer-events-auto">
      <PanelContent aircraft={aircraft} />
    </div>
  )
}
