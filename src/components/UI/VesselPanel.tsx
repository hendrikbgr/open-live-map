import { X, Anchor, Gauge, Navigation, Ship, Compass, Wifi } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useVesselStore } from '../../store/vesselStore'
import type { Vessel } from '../../types/vessel'

// ─── Lookup tables ────────────────────────────────────────────────────────────

const NAV_STATUS: Record<number, string> = {
  0: 'Under way (engine)',
  1: 'At anchor',
  2: 'Not under command',
  3: 'Restricted manoeuvre',
  4: 'Constrained by draught',
  5: 'Moored',
  6: 'Aground',
  7: 'Fishing',
  8: 'Under way (sailing)',
  14: 'AIS-SART',
  15: 'Not defined',
}

function shipTypeLabel(type: number): string {
  if (type >= 70 && type < 80) return 'Cargo'
  if (type >= 80 && type < 90) return 'Tanker'
  if (type >= 60 && type < 70) return 'Passenger'
  if (type >= 40 && type < 50) return 'High-speed craft'
  if (type === 30) return 'Fishing'
  if (type >= 31 && type <= 32) return 'Towing'
  if (type === 35) return 'Military'
  if (type === 36) return 'Sailing'
  if (type === 37) return 'Pleasure craft'
  if (type >= 50 && type < 60) return 'Special craft'
  if (type >= 20 && type < 30) return 'WIG'
  return 'Other'
}

// ─── Sub-components ─────────────────────────────────────────────────────────

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

// ─── Panel ──────────────────────────────────────────────────────────────────

function PanelContent({ vessel }: { vessel: Vessel }) {
  const { selectVessel } = useVesselStore()

  const navLabel = NAV_STATUS[vessel.navStatus] ?? `Status ${vessel.navStatus}`
  const navCls =
    vessel.navStatus === 0 || vessel.navStatus === 8
      ? 'bg-accent/15 text-accent-glow border-accent/30'
      : vessel.navStatus === 1 || vessel.navStatus === 5
        ? 'bg-amber-400/15 text-amber-300 border-amber-400/30'
        : 'bg-slate-400/15 text-slate-300 border-slate-400/30'

  return (
    <div className="w-64 bg-surface-800/97 backdrop-blur-sm border border-border rounded shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2 bg-surface-700 border-b border-border">
        <div className="flex items-center justify-center w-5 h-5 rounded bg-cyan-400/20 border border-cyan-400/30 flex-shrink-0">
          <Ship size={10} className="text-cyan-300" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="block text-xs font-semibold text-white leading-none">
            {vessel.name || `MMSI ${vessel.mmsi}`}
          </span>
          {vessel.name && (
            <span className="block text-[9px] font-mono text-muted mt-0.5">
              {vessel.mmsi}
            </span>
          )}
        </div>

        <span
          className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0 ${navCls}`}
        >
          {vessel.navStatus === 0 || vessel.navStatus === 8 ? 'Moving' : 'Idle'}
        </span>

        <button
          onClick={() => selectVessel(null)}
          className="text-muted hover:text-slate-200 transition-colors ml-1 flex-shrink-0"
          aria-label="Close"
        >
          <X size={12} />
        </button>
      </div>

      {/* Data */}
      <div className="px-3 py-2.5 space-y-1.5">
        <DataRow icon={Anchor} label="TYPE" value={shipTypeLabel(vessel.shipType)} />
        <DataRow icon={Navigation} label="NAV" value={navLabel} />
        <DataRow icon={Gauge} label="SPEED" value={`${vessel.sog.toFixed(1)} kt`} />
        <DataRow
          icon={Compass}
          label="COURSE"
          value={`${Math.round(vessel.cog)}°`}
        />
        <DataRow
          icon={Compass}
          label="HEADING"
          value={vessel.heading === 511 ? '—' : `${Math.round(vessel.heading)}°`}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border">
        <span className="flex items-center gap-1 text-[9px] font-mono text-muted/60">
          <Wifi size={8} />
          AIS
        </span>
        <span className="text-[9px] font-mono text-muted/60">
          {new Date(vessel.lastUpdate).toLocaleTimeString()}
        </span>
      </div>
    </div>
  )
}

export function VesselPanel() {
  const selectedVesselId = useVesselStore((s) => s.selectedVesselId)
  const vesselMap = useVesselStore((s) => s.vesselMap)

  if (!selectedVesselId) return null

  const vessel = vesselMap.get(selectedVesselId)
  if (!vessel) return null

  return (
    <div className="absolute bottom-14 right-4 z-30 pointer-events-auto">
      <PanelContent vessel={vessel} />
    </div>
  )
}
