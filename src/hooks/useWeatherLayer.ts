import { useEffect, useRef, useCallback } from 'react'
import type { Map } from 'maplibre-gl'
import { useMapStore } from '../store/mapStore'
import { fetchLatestRadarFrame } from '../services/rainviewer'

const SOURCE_ID = 'weather-radar-source'
const LAYER_ID = 'weather-radar-layer'
const POLL_INTERVAL_MS = 300_000 // 5 minutes

export function useWeatherLayer(map: Map | null, mapReadySeq: number) {
  const weatherEnabled = useMapStore((s) => s.layers.weather)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentTimestampRef = useRef<number>(0)

  const updateRadar = useCallback(async () => {
    if (!map) return
    try {
      const frame = await fetchLatestRadarFrame()
      if (!frame || frame.timestamp === currentTimestampRef.current) return

      currentTimestampRef.current = frame.timestamp

      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)

      map.addSource(SOURCE_ID, {
        type: 'raster',
        tiles: [frame.tileUrl],
        tileSize: 256,
        maxzoom: 8,
        attribution: '&copy; RainViewer',
      })

      map.addLayer({
        id: LAYER_ID,
        type: 'raster',
        source: SOURCE_ID,
        paint: {
          'raster-opacity': 0.55,
          'raster-fade-duration': 300,
        },
        layout: { visibility: 'visible' },
      })
    } catch (err) {
      console.error('Weather radar update failed:', err)
    }
  }, [map])

  useEffect(() => {
    if (!map || mapReadySeq === 0) return

    if (weatherEnabled) {
      updateRadar()
      intervalRef.current = setInterval(updateRadar, POLL_INTERVAL_MS)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      currentTimestampRef.current = 0
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [weatherEnabled, map, mapReadySeq, updateRadar])
}
