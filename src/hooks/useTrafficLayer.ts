import { useEffect, useRef, useCallback } from 'react'
import type { Map as MaplibreMap, GeoJSONSource } from 'maplibre-gl'
import { useMapStore } from '../store/mapStore'

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_ID = 'traffic-vehicles-source'
const LAYER_ID = 'traffic-vehicles-3d'
const MIN_ZOOM = 13
const MAX_VEHICLES = 500
const UPDATE_MS = 50 // ~20 fps
const FADE_IN_S = 0.8
const FADE_OUT_S = 0.8
const CONNECT_RADIUS_M = 25

// ─── Vehicle specs ────────────────────────────────────────────────────────────

interface VehicleSpec {
  length: number
  width: number
  height: number
  weight: number
  colors: string[]
}

const SPECS: Record<string, VehicleSpec> = {
  car: {
    length: 4.2, width: 1.8, height: 1.5, weight: 0.70,
    colors: ['#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8'],
  },
  van: {
    length: 5.5, width: 2.1, height: 2.3, weight: 0.15,
    colors: ['#fbbf24', '#f59e0b', '#d97706', '#eab308'],
  },
  truck: {
    length: 12, width: 2.5, height: 3.8, weight: 0.15,
    colors: ['#f87171', '#ef4444', '#dc2626', '#b91c1c'],
  },
}

// ─── Sim vehicle ──────────────────────────────────────────────────────────────

interface SimVehicle {
  id: number
  coords: [number, number][]
  segIdx: number
  progress: number
  speedMps: number
  color: string
  length: number
  width: number
  height: number
  lateralOffset: number
  age: number
  fadingOut: boolean
  fadeOutT: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _nextId = 0

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function weightedType(): string {
  const r = Math.random()
  let cum = 0
  for (const [type, spec] of Object.entries(SPECS)) {
    cum += spec.weight
    if (r < cum) return type
  }
  return 'car'
}

const ROAD_SPEEDS: Record<string, [number, number]> = {
  motorway: [90, 130], motorway_link: [60, 90],
  trunk: [70, 110], trunk_link: [50, 70],
  primary: [50, 80], primary_link: [40, 60],
  secondary: [40, 60], secondary_link: [30, 50],
  tertiary: [30, 50],
  residential: [20, 40], living_street: [10, 20],
  service: [10, 20], unclassified: [30, 50],
}

function randomSpeed(roadClass: string): number {
  const [min, max] = ROAD_SPEEDS[roadClass] ?? [20, 50]
  return (min + Math.random() * (max - min)) / 3.6
}

function segLenM(a: [number, number], b: [number, number]): number {
  const dLat = b[1] - a[1]
  const dLng = b[0] - a[0]
  const cosLat = Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180)
  const dy = dLat * 111_320
  const dx = dLng * cosLat * 111_320
  return Math.sqrt(dx * dx + dy * dy)
}

function headingRad(a: [number, number], b: [number, number]): number {
  return Math.atan2(b[0] - a[0], b[1] - a[1])
}

function vehicleRect(
  center: [number, number],
  h: number,
  lengthM: number,
  widthM: number,
): [number, number][] {
  const cosH = Math.cos(h)
  const sinH = Math.sin(h)
  const cosLat = Math.cos(center[1] * Math.PI / 180)
  const halfL = lengthM / 2 / 111_320
  const halfW = widthM / 2 / 111_320

  // corners: front-right, front-left, back-left, back-right, close ring
  const offsets: [number, number][] = [
    [halfL, halfW], [halfL, -halfW],
    [-halfL, -halfW], [-halfL, halfW],
    [halfL, halfW],
  ]

  return offsets.map(([fwd, right]) => {
    const dLat = fwd * cosH - right * sinH
    const dLon = (fwd * sinH + right * cosH) / cosLat
    return [center[0] + dLon, center[1] + dLat]
  })
}

// ─── Road extraction ──────────────────────────────────────────────────────────

interface RoadSeg {
  coords: [number, number][]
  roadClass: string
}

const SKIP_CLASSES = new Set(['path', 'track', 'ferry', 'rail', 'transit', 'raceway', 'busway', 'construction'])

function extractRoadSegments(map: MaplibreMap): RoadSeg[] {
  const segments: RoadSeg[] = []

  const processFeature = (f: { geometry: GeoJSON.Geometry; properties?: Record<string, unknown> }) => {
    const cls = (f.properties?.class as string) || ''
    if (SKIP_CLASSES.has(cls)) return
    const geom = f.geometry
    if (geom.type === 'LineString') {
      const c = geom.coordinates as [number, number][]
      if (c.length >= 2) segments.push({ coords: c, roadClass: cls })
    } else if (geom.type === 'MultiLineString') {
      for (const line of geom.coordinates as [number, number][][]) {
        if (line.length >= 2) segments.push({ coords: line, roadClass: cls })
      }
    }
  }

  // Primary: query rendered features (works when road layers are visible)
  for (const f of map.queryRenderedFeatures()) {
    if (f.sourceLayer === 'transportation') processFeature(f)
  }

  if (segments.length > 0) return segments

  // Fallback: query source features from any vector source
  const style = map.getStyle()
  if (!style?.sources) return segments

  for (const srcId of Object.keys(style.sources)) {
    const src = style.sources[srcId]
    if (src.type !== 'vector') continue
    try {
      for (const f of map.querySourceFeatures(srcId, { sourceLayer: 'transportation' })) {
        processFeature(f)
      }
      if (segments.length > 0) return segments
    } catch { /* source may not have this layer */ }
  }

  return segments
}

// ─── Road connectivity ───────────────────────────────────────────────────────

interface EndpointEntry {
  segIndex: number
  end: 'start' | 'end'
  coord: [number, number]
}

type EndpointIndex = Map<string, EndpointEntry[]>

function epKey(coord: [number, number]): string {
  return `${Math.round(coord[0] * 5000)},${Math.round(coord[1] * 5000)}`
}

function buildEndpointIndex(segments: RoadSeg[]): EndpointIndex {
  const idx: EndpointIndex = new Map()
  for (let i = 0; i < segments.length; i++) {
    const c = segments[i].coords
    for (const entry of [
      { segIndex: i, end: 'start' as const, coord: c[0] },
      { segIndex: i, end: 'end' as const, coord: c[c.length - 1] },
    ]) {
      const key = epKey(entry.coord)
      let bucket = idx.get(key)
      if (!bucket) { bucket = []; idx.set(key, bucket) }
      bucket.push(entry)
    }
  }
  return idx
}

function angleDiff(a: number, b: number): number {
  let d = b - a
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  return Math.abs(d)
}

function findConnection(
  coord: [number, number],
  heading: number,
  segments: RoadSeg[],
  index: EndpointIndex,
): { segIndex: number; reversed: boolean } | null {
  const cx = Math.round(coord[0] * 5000)
  const cy = Math.round(coord[1] * 5000)
  const candidates: { segIndex: number; reversed: boolean }[] = []

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const entries = index.get(`${cx + dx},${cy + dy}`)
      if (!entries) continue
      for (const e of entries) {
        if (segLenM(coord, e.coord) > CONNECT_RADIUS_M) continue
        const seg = segments[e.segIndex]
        if (!seg) continue
        const reversed = e.end === 'end'
        const [s, n] = reversed
          ? [seg.coords[seg.coords.length - 1], seg.coords[seg.coords.length - 2]]
          : [seg.coords[0], seg.coords[1]]
        if (angleDiff(heading, headingRad(s, n)) > 2.35) continue
        candidates.push({ segIndex: e.segIndex, reversed })
      }
    }
  }

  return candidates.length > 0 ? pick(candidates) : null
}

// ─── Vehicle lifecycle ────────────────────────────────────────────────────────

const SPAWN_PER_FRAME = 3 // max new vehicles per animation tick (prevents pop-in bursts)

function spawnVehicle(segments: RoadSeg[], randomPosition: boolean): SimVehicle | null {
  if (segments.length === 0) return null
  const seg = pick(segments)
  const type = weightedType()
  const spec = SPECS[type]

  const coords = Math.random() > 0.5 ? [...seg.coords] : [...seg.coords].reverse()

  // randomPosition=true for initial population, false for replacements
  // so new vehicles enter at the start of a road naturally
  const startSeg = randomPosition
    ? Math.floor(Math.random() * (coords.length - 1))
    : 0

  return {
    id: _nextId++,
    coords,
    segIdx: startSeg,
    progress: randomPosition ? Math.random() : 0,
    speedMps: randomSpeed(seg.roadClass),
    color: pick(spec.colors),
    length: spec.length * (0.9 + Math.random() * 0.2),
    width: spec.width * (0.9 + Math.random() * 0.15),
    height: spec.height * (0.8 + Math.random() * 0.4),
    lateralOffset: 1.5 + Math.random() * 1.5,
    age: randomPosition ? FADE_IN_S : 0,
    fadingOut: false,
    fadeOutT: 0,
  }
}

function stepVehicles(
  vehicles: SimVehicle[],
  dt: number,
  segments: RoadSeg[],
  epIndex: EndpointIndex,
): SimVehicle[] {
  const alive: SimVehicle[] = []

  for (const v of vehicles) {
    v.age += dt

    if (v.fadingOut) {
      v.fadeOutT += dt
      if (v.fadeOutT < FADE_OUT_S) alive.push(v)
      continue
    }

    if (v.segIdx + 1 >= v.coords.length) {
      transferOrFade(v, segments, epIndex)
      alive.push(v)
      continue
    }

    const a = v.coords[v.segIdx]
    const b = v.coords[v.segIdx + 1]
    const len = segLenM(a, b)

    if (len < 0.5) {
      if (v.segIdx + 2 < v.coords.length) {
        v.segIdx++
        v.progress = 0
        alive.push(v)
      } else {
        transferOrFade(v, segments, epIndex)
        alive.push(v)
      }
      continue
    }

    v.progress += (v.speedMps * dt) / len

    if (v.progress >= 1) {
      v.segIdx++
      v.progress = 0
      if (v.segIdx + 1 >= v.coords.length) {
        transferOrFade(v, segments, epIndex)
        alive.push(v)
        continue
      }
    }

    alive.push(v)
  }

  return alive
}

function transferOrFade(
  v: SimVehicle,
  segments: RoadSeg[],
  epIndex: EndpointIndex,
) {
  const endCoord = v.coords[v.coords.length - 1]
  const prevCoord = v.coords[Math.max(0, v.coords.length - 2)]
  const heading = segLenM(prevCoord, endCoord) > 0.5
    ? headingRad(prevCoord, endCoord)
    : 0
  const conn = findConnection(endCoord, heading, segments, epIndex)

  if (conn && segments[conn.segIndex]) {
    const seg = segments[conn.segIndex]
    v.coords = conn.reversed ? [...seg.coords].reverse() : [...seg.coords]
    v.segIdx = 0
    v.progress = 0
    v.speedMps = randomSpeed(seg.roadClass)
  } else {
    v.segIdx = Math.max(0, v.coords.length - 2)
    v.progress = 1
    v.fadingOut = true
    v.fadeOutT = 0
  }
}

// ─── GeoJSON builder ──────────────────────────────────────────────────────────

function buildGeoJSON(vehicles: SimVehicle[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []

  for (const v of vehicles) {
    const a = v.coords[v.segIdx]
    const b = v.coords[v.segIdx + 1]
    if (!a || !b) continue

    let hScale = 1
    if (v.age < FADE_IN_S) hScale = v.age / FADE_IN_S
    if (v.fadingOut) hScale = Math.max(0, 1 - v.fadeOutT / FADE_OUT_S)
    hScale = hScale * (2 - hScale) // ease-out curve
    if (hScale < 0.01) continue // skip invisible vehicles

    const lng = a[0] + (b[0] - a[0]) * v.progress
    const lat = a[1] + (b[1] - a[1]) * v.progress
    const h = headingRad(a, b)

    const cosLat = Math.cos(lat * Math.PI / 180)
    const offM = v.lateralOffset / 111_320
    const adjLng = lng + (Math.cos(h) * offM) / cosLat
    const adjLat = lat + (-Math.sin(h) * offM)

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [vehicleRect([adjLng, adjLat], h, v.length, v.width)],
      },
      properties: {
        color: v.color,
        height: v.height * hScale,
      },
    })
  }

  return { type: 'FeatureCollection', features }
}

// ─── Layer setup ──────────────────────────────────────────────────────────────

function setupLayers(map: MaplibreMap) {
  if (map.getSource(SOURCE_ID)) {
    console.log('[traffic] source already exists, skipping setup')
    return
  }

  try {
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })

    map.addLayer({
      id: LAYER_ID,
      type: 'fill-extrusion',
      source: SOURCE_ID,
      minzoom: MIN_ZOOM,
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.92,
      },
      layout: { visibility: 'none' },
    })
    console.log('[traffic] layers setup OK')
  } catch (e) {
    console.error('[traffic] setupLayers FAILED:', e)
  }
}

function setVisibility(map: MaplibreMap, visible: boolean) {
  if (map.getLayer(LAYER_ID)) {
    map.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none')
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTrafficLayer(map: MaplibreMap | null, mapReadySeq: number) {
  const trafficEnabled = useMapStore((s) => s.layers.traffic)
  const vehiclesRef = useRef<SimVehicle[]>([])
  const segmentsRef = useRef<RoadSeg[]>([])
  const epIndexRef = useRef<EndpointIndex>(new Map())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastTRef = useRef(0)

  const refreshRoads = useCallback(() => {
    if (!map || map.getZoom() < MIN_ZOOM - 1) {
      console.log('[traffic] refreshRoads skipped — map:', !!map, 'zoom:', map?.getZoom())
      return
    }
    segmentsRef.current = extractRoadSegments(map)
    epIndexRef.current = buildEndpointIndex(segmentsRef.current)
    console.log('[traffic] refreshRoads →', segmentsRef.current.length, 'segments,', epIndexRef.current.size, 'endpoint buckets')
  }, [map])

  const spawnAll = useCallback(() => {
    const segs = segmentsRef.current
    if (segs.length === 0) {
      console.warn('[traffic] spawnAll — no segments available')
      return
    }
    const count = Math.min(MAX_VEHICLES, Math.max(30, segs.length * 3))
    const batch: SimVehicle[] = []
    for (let i = 0; i < count; i++) {
      const v = spawnVehicle(segs, true)
      if (v) batch.push(v)
    }
    vehiclesRef.current = batch
    console.log('[traffic] spawnAll →', batch.length, 'vehicles')
  }, [])

  const startLoop = useCallback(() => {
    if (timerRef.current || !map) return
    lastTRef.current = performance.now()
    let _tickCount = 0

    console.log('[traffic] startLoop — beginning animation')

    timerRef.current = setInterval(() => {
      const now = performance.now()
      const dt = Math.min((now - lastTRef.current) / 1000, 0.25)
      lastTRef.current = now
      _tickCount++

      if (map.getZoom() < MIN_ZOOM) return

      vehiclesRef.current = stepVehicles(vehiclesRef.current, dt, segmentsRef.current, epIndexRef.current)

      const target = Math.min(MAX_VEHICLES, Math.max(30, segmentsRef.current.length * 3))
      const deficit = target - vehiclesRef.current.length
      const toSpawn = Math.min(deficit, SPAWN_PER_FRAME)
      for (let i = 0; i < toSpawn; i++) {
        const v = spawnVehicle(segmentsRef.current, false)
        if (v) vehiclesRef.current.push(v)
        else break
      }

      const geojson = buildGeoJSON(vehiclesRef.current)

      if (_tickCount <= 3 || _tickCount % 40 === 0) {
        console.log(`[traffic] tick ${_tickCount}: ${vehiclesRef.current.length} vehicles, ${geojson.features.length} features, zoom=${map.getZoom().toFixed(1)}, source=${!!map.getSource(SOURCE_ID)}, layer=${!!map.getLayer(LAYER_ID)}`)
        if (geojson.features.length > 0) {
          const f = geojson.features[0]
          console.log('[traffic] sample feature:', JSON.stringify(f).slice(0, 300))
        }
      }

      const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
      if (!src) {
        if (_tickCount <= 3) console.warn('[traffic] source not found on map!')
        return
      }
      try {
        src.setData(geojson)
      } catch (e) {
        console.error('[traffic] setData error:', e)
      }
    }, UPDATE_MS)
  }, [map])

  const stopLoop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    vehiclesRef.current = []
  }, [])

  // ── Enable / disable ─────────────────────────────────────────────────────
  useEffect(() => {
    console.log('[traffic] effect — enabled:', trafficEnabled, 'map:', !!map, 'mapReadySeq:', mapReadySeq)
    if (!map || mapReadySeq === 0) return

    setupLayers(map)
    setVisibility(map, trafficEnabled)

    if (trafficEnabled) {
      refreshRoads()
      spawnAll()
      startLoop()

      map.on('error', (e: { error?: { message?: string } }) => {
        console.error('[traffic] map error event:', e.error?.message ?? e)
      })
    } else {
      stopLoop()
      const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
      src?.setData({ type: 'FeatureCollection', features: [] })
    }

    return () => { stopLoop() }
  }, [trafficEnabled, map, mapReadySeq, refreshRoads, spawnAll, startLoop, stopLoop])

  // ── Refresh roads on viewport change ──────────────────────────────────────
  useEffect(() => {
    if (!map || mapReadySeq === 0 || !trafficEnabled) return

    let debounce: ReturnType<typeof setTimeout> | null = null

    const handleMoveEnd = () => {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        refreshRoads()
        // Keep all existing vehicles — they continue on their stored
        // coordinates.  The per-frame top-up will gradually fill any
        // gap between current count and the target, so new vehicles
        // trickle in naturally instead of the whole fleet teleporting.
      }, 800)
    }

    map.on('moveend', handleMoveEnd)
    return () => {
      map.off('moveend', handleMoveEnd)
      if (debounce) clearTimeout(debounce)
    }
  }, [map, mapReadySeq, trafficEnabled, refreshRoads])
}
