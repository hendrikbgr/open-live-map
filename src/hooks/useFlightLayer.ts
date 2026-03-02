import { useEffect, useRef, useCallback } from 'react'
import type { Map, GeoJSONSource, MapMouseEvent, MapGeoJSONFeature } from 'maplibre-gl'
import { useMapStore } from '../store/mapStore'
import { useFlightStore } from '../store/flightStore'
import { fetchFlights } from '../services/opensky'
import type { BBox } from '../services/opensky'
import type { Aircraft, AircraftProperties } from '../types/flight'

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_ID = 'flights-source'
const LAYER_AIRBORNE = 'flights-airborne'
const LAYER_GROUND = 'flights-ground'
const LAYER_HITBOX = 'flights-hitbox'
const ICON_ID = 'aircraft-icon'
const POLL_INTERVAL_MS = 10_000

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBBox(map: Map): BBox {
  const b = map.getBounds()
  return {
    lamin: Math.max(-90, b.getSouth()),
    lomin: Math.max(-180, b.getWest()),
    lamax: Math.min(90, b.getNorth()),
    lomax: Math.min(180, b.getEast()),
  }
}

function buildGeoJSON(
  aircraft: Aircraft[],
): GeoJSON.FeatureCollection<GeoJSON.Point, AircraftProperties> {
  return {
    type: 'FeatureCollection',
    features: aircraft.map((a) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [a.longitude, a.latitude] },
      properties: {
        icao24: a.icao24,
        callsign: a.callsign,
        onGround: a.onGround,
        trueTrack: a.trueTrack,
        verticalRate: a.verticalRate,
        baroAltitude: a.baroAltitude,
        velocity: a.velocity,
        originCountry: a.originCountry,
        squawk: a.squawk,
        lastContact: a.lastContact,
        positionSource: a.positionSource,
      },
    })),
  }
}

function addAircraftIcon(map: Map) {
  if (map.hasImage(ICON_ID)) return

  const size = 28
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Draw a top-down airplane silhouette (pointing up = north)
  // Icon rotation is applied by MapLibre at render time via icon-rotate
  ctx.clearRect(0, 0, size, size)
  // White fill on transparent bg → SDF icon (tinted at runtime via icon-color)
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
  ctx.lineWidth = 1.0
  ctx.lineJoin = 'round'

  const cx = size / 2

  ctx.beginPath()
  // Fuselage nose → tail
  ctx.moveTo(cx, 2)           // nose tip
  ctx.lineTo(cx + 2.5, 10)
  // Right wing
  ctx.lineTo(cx + 12, 16)
  ctx.lineTo(cx + 10, 18)
  ctx.lineTo(cx + 3, 15)
  // Right tail fin
  ctx.lineTo(cx + 5, 25)
  ctx.lineTo(cx + 2, 26)
  ctx.lineTo(cx, 21)
  // Left tail fin (mirror)
  ctx.lineTo(cx - 2, 26)
  ctx.lineTo(cx - 5, 25)
  ctx.lineTo(cx - 3, 15)
  // Left wing (mirror)
  ctx.lineTo(cx - 10, 18)
  ctx.lineTo(cx - 12, 16)
  ctx.lineTo(cx - 2.5, 10)
  ctx.closePath()

  ctx.fill()
  ctx.stroke()

  const imageData = ctx.getImageData(0, 0, size, size)
  // sdf: true enables icon-color tinting at render time
  map.addImage(
    ICON_ID,
    { width: size, height: size, data: new Uint8Array(imageData.data) },
    { sdf: true },
  )
}

function setupLayers(map: Map) {
  // Idempotent — skips if already set up
  if (map.getSource(SOURCE_ID)) return

  addAircraftIcon(map)

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })

  // ── Airborne: symbol layer with rotating icon ─────────────────────────────
  map.addLayer({
    id: LAYER_AIRBORNE,
    type: 'symbol',
    source: SOURCE_ID,
    filter: ['==', ['get', 'onGround'], false],
    layout: {
      'icon-image': ICON_ID,
      'icon-size': [
        'interpolate', ['linear'], ['zoom'],
        3, 0.45,
        7, 0.7,
        11, 1.0,
      ],
      'icon-rotate': ['get', 'trueTrack'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'text-field': ['get', 'callsign'],
      'text-font': ['Noto Sans Regular'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        7, 0,
        9, 9,
        12, 11,
      ],
      'text-offset': [0, 1.3],
      'text-anchor': 'top',
      'text-optional': true,
      visibility: 'none',
    },
    paint: {
      'icon-color': [
        'case',
        ['>', ['coalesce', ['get', 'verticalRate'], 0], 1], '#4ade80',   // climbing  — green-400
        ['<', ['coalesce', ['get', 'verticalRate'], 0], -1], '#fb923c',  // descending — orange-400
        '#60a5fa',                                                         // level      — accent-glow
      ],
      'icon-translate': [0, -40],
      'icon-translate-anchor': 'viewport',
      'text-color': '#94a3b8',
      'text-halo-color': '#090e1a',
      'text-halo-width': 1.5,
    },
  })

  // ── Ground traffic: circle layer ──────────────────────────────────────────
  map.addLayer({
    id: LAYER_GROUND,
    type: 'circle',
    source: SOURCE_ID,
    filter: ['==', ['get', 'onGround'], true],
    layout: { visibility: 'none' },
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        4, 2,
        10, 5,
      ],
      'circle-color': '#a78bfa',
      'circle-stroke-color': '#090e1a',
      'circle-stroke-width': 1,
      'circle-opacity': 0.9,
    },
  })

  // ── Hitbox: invisible, generous click target for all aircraft ─────────────
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

function setFlightLayerVisibility(map: Map, visible: boolean) {
  const v = visible ? 'visible' : 'none'
  for (const id of [LAYER_AIRBORNE, LAYER_GROUND, LAYER_HITBOX]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v)
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFlightLayer(map: Map | null, mapReadySeq: number) {
  const flightsEnabled = useMapStore((s) => s.layers.flights)
  const { setAircraftData, setFetchError, setIsFetching, selectAircraft } =
    useFlightStore()

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // ── Fetch + push GeoJSON ──────────────────────────────────────────────────
  const fetchAndUpdate = useCallback(async () => {
    if (!map) return
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setIsFetching(true)
    try {
      const bbox = getBBox(map)
      const aircraft = await fetchFlights(bbox)
      setAircraftData(aircraft, Date.now())

      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
      source?.setData(buildGeoJSON(aircraft))
    } catch (err) {
      const msg = (err as Error).message
      if (msg !== 'AbortError') setFetchError(msg)
    } finally {
      setIsFetching(false)
    }
  }, [map, setAircraftData, setFetchError, setIsFetching])

  // ── Enable / disable flights layer ───────────────────────────────────────
  useEffect(() => {
    if (!map || mapReadySeq === 0) return

    setupLayers(map)
    setFlightLayerVisibility(map, flightsEnabled)

    if (flightsEnabled) {
      fetchAndUpdate()
      intervalRef.current = setInterval(fetchAndUpdate, POLL_INTERVAL_MS)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      abortRef.current?.abort()
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
      source?.setData({ type: 'FeatureCollection', features: [] })
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      abortRef.current?.abort()
    }
  }, [flightsEnabled, map, mapReadySeq, fetchAndUpdate])

  // ── Click handlers ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map || mapReadySeq === 0) return

    // Track whether a feature was just clicked so the generic handler doesn't clear it
    let featureClickedThisTick = false

    const handleFeatureClick = (
      e: MapMouseEvent & { features?: MapGeoJSONFeature[] },
    ) => {
      const props = e.features?.[0]?.properties as AircraftProperties | undefined
      if (props?.icao24) {
        featureClickedThisTick = true
        selectAircraft(props.icao24)
      }
    }

    const handleMapClick = () => {
      if (featureClickedThisTick) { featureClickedThisTick = false; return }
      selectAircraft(null)
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
  }, [map, mapReadySeq, selectAircraft])

  // ── Re-fetch on map move (debounced 500ms) ────────────────────────────────
  useEffect(() => {
    if (!map || mapReadySeq === 0 || !flightsEnabled) return

    let debounce: ReturnType<typeof setTimeout> | null = null

    const handleMoveEnd = () => {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        if (intervalRef.current) clearInterval(intervalRef.current)
        fetchAndUpdate()
        intervalRef.current = setInterval(fetchAndUpdate, POLL_INTERVAL_MS)
      }, 500)
    }

    map.on('moveend', handleMoveEnd)
    return () => {
      map.off('moveend', handleMoveEnd)
      if (debounce) clearTimeout(debounce)
    }
  }, [map, mapReadySeq, flightsEnabled, fetchAndUpdate])
}
