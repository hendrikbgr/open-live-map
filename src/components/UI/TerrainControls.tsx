import { useMapStore } from '../../store/mapStore'

export function TerrainControls() {
  const { layers, terrainExaggeration, setTerrainExaggeration } = useMapStore()

  if (!layers.terrain3D) return null

  return (
    <div className="border-t border-border pt-3 space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
          Elevation Scale
        </span>
        <span className="text-[11px] font-mono text-accent-glow">
          {terrainExaggeration.toFixed(1)}x
        </span>
      </div>
      <div className="px-1">
        <input
          type="range"
          min={0.5}
          max={5}
          step={0.1}
          value={terrainExaggeration}
          onChange={(e) => setTerrainExaggeration(parseFloat(e.target.value))}
          className="w-full h-1 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #3b82f6 ${((terrainExaggeration - 0.5) / 4.5) * 100}%, #1e2d45 0%)`,
          }}
        />
        <div className="flex justify-between mt-1">
          <span className="text-[9px] font-mono text-muted">0.5x</span>
          <span className="text-[9px] font-mono text-muted">5.0x</span>
        </div>
      </div>
    </div>
  )
}
