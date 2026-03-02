import { useEffect, useRef, useCallback } from 'react'
import type { Map, GeoJSONSource, MapMouseEvent, MapGeoJSONFeature } from 'maplibre-gl'
import { useMapStore } from '../store/mapStore'
import { useVesselStore } from '../store/vesselStore'
import { connect, disconnect, reconnect, isConfigured } from '../services/aisstream'
import type { AISBBox } from '../services/aisstream'
import type { Vessel, VesselProperties } from '../types/vessel'

const SOURCE_ID = 'vessels-source'
const LAYER_VESSELS = 'vessels-layer'
const LAYER_HITBOX = 'vessels-hitbox'
const ICON_ID = 'vessel-icon'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBBox(map: Map): AISBBox {
  const b = map.getBounds()
  return {
    lamin: Math.max(-90, b.getSouth()),
    lomin: Math.max(-180, b.getWest()),
    lamax: Math.min(90, b.getNorth()),
    lomax: Math.min(180, b.getEast()),
  }
}

function buildGeoJSON(
  vessels: Vessel[],
): GeoJSON.FeatureCollection<GeoJSON.Point, VesselProperties> {
  return {
    type: 'FeatureCollection',
    features: vessels.map((v) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [v.longitude, v.latitude] },
      properties: {
        mmsi: v.mmsi,
        name: v.name,
        cog: v.cog,
        sog: v.sog,
        heading: v.heading,
        navStatus: v.navStatus,
        shipType: v.shipType,
        lastUpdate: v.lastUpdate,
      },
    })),
  }
}

function addVesselIcon(map: Map) {
  if (map.hasImage(ICON_ID)) return

  const size = 24
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cx = size / 2

  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
  ctx.lineWidth = 1.0
  ctx.lineJoin = 'round'

  // Top-down ship silhouette pointing north
  ctx.beginPath()
  ctx.moveTo(cx, 2)           // bow tip
  ctx.lineTo(cx + 5, 9)       // right bow flare
  ctx.lineTo(cx + 5, 19)      // right hull
  ctx.lineTo(cx + 3, 22)      // right stern
  ctx.lineTo(cx - 3, 22)      // left stern
  ctx.lineTo(cx - 5, 19)      // left hull
  ctx.lineTo(cx - 5, 9)       // left bow flare
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  const imageData = ctx.getImageData(0, 0, size, size)
  map.addImage(
    ICON_ID,
    { width: size, height: size, data: new Uint8Array(imageData.data) },
    { sdf: true },
  )
}

function setupLayers(map: Map) {
  if (map.getSource(SOURCE_ID)) return

  addVesselIcon(map)

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })

  map.addLayer({
    id: LAYER_VESSELS,
    type: 'symbol',
    source: SOURCE_ID,
    layout: {
      'icon-image': ICON_ID,
      'icon-size': [
        'interpolate', ['linear'], ['zoom'],
        3, 0.4,
        7, 0.65,
        11, 0.9,
      ],
      'icon-rotate': ['case',
        ['!=', ['get', 'heading'], 511],
        ['get', 'heading'],
        ['get', 'cog'],
      ],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Regular'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        7, 0,
        9, 8,
        12, 10,
      ],
      'text-offset': [0, 1.3],
      'text-anchor': 'top',
      'text-optional': true,
      visibility: 'none',
    },
    paint: {
      'icon-color': [
        'case',
        ['all', ['>=', ['get', 'shipType'], 70], ['<', ['get', 'shipType'], 80]], '#4ade80',   // cargo — green
        ['all', ['>=', ['get', 'shipType'], 80], ['<', ['get', 'shipType'], 90]], '#fb923c',   // tanker — orange
        ['all', ['>=', ['get', 'shipType'], 60], ['<', ['get', 'shipType'], 70]], '#60a5fa',   // passenger — blue
        ['==', ['get', 'shipType'], 30], '#a78bfa',                                             // fishing — purple
        '#22d3ee',                                                                               // other — cyan
      ],
      'text-color': '#94a3b8',
      'text-halo-color': '#090e1a',
      'text-halo-width': 1.5,
    },
  })

  map.addLayer({
    id: LAYER_HITBOX,
    type: 'circle',
    source: SOURCE_ID,
    layout: { visibility: 'none' },
    paint: {
      'circle-radius': 18,
      'circle-opacity': 0,
      'circle-stroke-opacity': 0,
    },
  })
}

function setVesselLayerVisibility(map: Map, visible: boolean) {
  const v = visible ? 'visible' : 'none'
  for (const id of [LAYER_VESSELS, LAYER_HITBOX]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v)
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVesselLayer(map: Map | null, mapReadySeq: number) {
  const aisEnabled = useMapStore((s) => s.layers.ais)
  const selectVessel = useVesselStore((s) => s.selectVessel)

  const updateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeRef = useRef(false)

  const startGeoJSONSync = useCallback((m: Map) => {
    if (updateTimerRef.current) return
    updateTimerRef.current = setInterval(() => {
      const source = m.getSource(SOURCE_ID) as GeoJSONSource | undefined
      if (!source) return
      const vessels = Array.from(useVesselStore.getState().vesselMap.values())
      source.setData(buildGeoJSON(vessels))
    }, 500)
  }, [])

  const stopGeoJSONSync = useCallback(() => {
    if (updateTimerRef.current) {
      clearInterval(updateTimerRef.current)
      updateTimerRef.current = null
    }
  }, [])

  // ── Enable / disable vessel layer ─────────────────────────────────────────
  useEffect(() => {
    if (!map || mapReadySeq === 0) return

    const store = useVesselStore.getState()
    activeRef.current = true

    setupLayers(map)
    setVesselLayerVisibility(map, aisEnabled)

    if (aisEnabled) {
      if (!isConfigured()) {
        store.setConnectionError(
          'VITE_AISSTREAM_API_KEY not set – register free at aisstream.io',
        )
        return
      }

      const bbox = getBBox(map)
      connect(bbox, {
        onMessage: (vessel) => {
          if (activeRef.current) useVesselStore.getState().upsertVessel(vessel)
        },
        onConnect: () => {
          if (!activeRef.current) return
          useVesselStore.getState().setIsConnected(true)
          useVesselStore.getState().setConnectionError(null)
        },
        onDisconnect: () => {
          if (activeRef.current) useVesselStore.getState().setIsConnected(false)
        },
        onError: (err) => {
          if (activeRef.current) useVesselStore.getState().setConnectionError(err)
        },
      })
      startGeoJSONSync(map)
    } else {
      disconnect()
      stopGeoJSONSync()
      store.clearVessels()
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
      source?.setData({ type: 'FeatureCollection', features: [] })
      store.setIsConnected(false)
      store.setConnectionError(null)
    }

    return () => {
      activeRef.current = false
      disconnect()
      stopGeoJSONSync()
    }
  }, [aisEnabled, map, mapReadySeq, startGeoJSONSync, stopGeoJSONSync])

  // ── Click handlers ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map || mapReadySeq === 0) return

    let featureClickedThisTick = false

    const handleFeatureClick = (
      e: MapMouseEvent & { features?: MapGeoJSONFeature[] },
    ) => {
      const props = e.features?.[0]?.properties as VesselProperties | undefined
      if (props?.mmsi) {
        featureClickedThisTick = true
        selectVessel(props.mmsi)
      }
    }

    const handleMapClick = () => {
      if (featureClickedThisTick) {
        featureClickedThisTick = false
        return
      }
      selectVessel(null)
    }

    map.on('click', LAYER_HITBOX, handleFeatureClick)
    map.on('click', handleMapClick)
    map.on('mouseenter', LAYER_HITBOX, () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', LAYER_HITBOX, () => {
      map.getCanvas().style.cursor = 'crosshair'
    })

    return () => {
      map.off('click', LAYER_HITBOX, handleFeatureClick)
      map.off('click', handleMapClick)
    }
  }, [map, mapReadySeq, selectVessel])

  // ── Reconnect on significant viewport move (debounced 2s) ─────────────────
  useEffect(() => {
    if (!map || mapReadySeq === 0 || !aisEnabled || !isConfigured()) return

    let debounce: ReturnType<typeof setTimeout> | null = null

    const handleMoveEnd = () => {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        if (activeRef.current) reconnect(getBBox(map))
      }, 2000)
    }

    map.on('moveend', handleMoveEnd)
    return () => {
      map.off('moveend', handleMoveEnd)
      if (debounce) clearTimeout(debounce)
    }
  }, [map, mapReadySeq, aisEnabled])
}
