import { useEffect, useRef, useCallback, useState } from 'react'
import maplibregl, { Map, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useMapStore } from '../../store/mapStore'
import {
  ROAD_STYLE_URL,
  SATELLITE_STYLE,
  TERRAIN_STYLE,
  ELEVATION_STYLE,
} from '../../config/mapStyles'
import type { BaseMapStyle } from '../../types/map'
import { useWeatherLayer } from '../../hooks/useWeatherLayer'
import { useVesselLayer } from '../../hooks/useVesselLayer'
import { useFlightLayer } from '../../hooks/useFlightLayer'
import { useTrafficLayer } from '../../hooks/useTrafficLayer'

// ─── Graticule source/layer helpers ──────────────────────────────────────────

function buildGraticuleGeoJSON() {
  const features: GeoJSON.Feature[] = []
  for (let lon = -180; lon <= 180; lon += 10) {
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: Array.from({ length: 181 }, (_, i) => [lon, -90 + i]) },
      properties: { label: `${lon}°` },
    })
  }
  for (let lat = -80; lat <= 80; lat += 10) {
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: Array.from({ length: 361 }, (_, i) => [-180 + i, lat]) },
      properties: { label: `${lat}°` },
    })
  }
  return { type: 'FeatureCollection' as const, features }
}

// ─── Style resolver ───────────────────────────────────────────────────────────

function resolveStyle(style: BaseMapStyle): string | StyleSpecification {
  switch (style) {
    case 'road': return ROAD_STYLE_URL
    case 'satellite': return SATELLITE_STYLE
    case 'terrain': return TERRAIN_STYLE
    case 'elevation': return ELEVATION_STYLE
  }
}

// ─── Layer management helpers ─────────────────────────────────────────────────

function addOverlayLayers(map: Map) {
  // Graticule
  if (!map.getSource('graticule')) {
    map.addSource('graticule', {
      type: 'geojson',
      data: buildGraticuleGeoJSON() as GeoJSON.FeatureCollection,
    })
    map.addLayer({
      id: 'graticule-lines',
      type: 'line',
      source: 'graticule',
      paint: {
        'line-color': '#4b5e7a',
        'line-width': 0.5,
        'line-opacity': 0.6,
        'line-dasharray': [4, 4],
      },
      layout: { visibility: 'none' },
    })
  }

  // Hillshade (for road/satellite styles that don't have it built-in)
  if (!map.getSource('hillshade-dem')) {
    map.addSource('hillshade-dem', {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      tileSize: 256,
      encoding: 'terrarium',
      maxzoom: 14,
    })
    map.addLayer({
      id: 'hillshade-overlay',
      type: 'hillshade',
      source: 'hillshade-dem',
      paint: {
        'hillshade-illumination-direction': 335,
        'hillshade-exaggeration': 0.4,
        'hillshade-shadow-color': '#000000',
        'hillshade-highlight-color': '#ffffff',
      },
      layout: { visibility: 'none' },
    })
  }

  // Buildings overlay (OpenFreeMap vector tiles — works on all base styles)
  if (!map.getSource('ofm-buildings')) {
    map.addSource('ofm-buildings', {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
    })
    map.addLayer({
      id: 'buildings-3d-overlay',
      type: 'fill-extrusion',
      source: 'ofm-buildings',
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': '#c8d4e0',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 10],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.75,
      },
      layout: { visibility: 'none' },
    })
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  // Increments on every style load — ensures useFlightLayer always re-runs after
  // a style switch even if the previous value was already "ready" (truthy).
  const [mapReadySeq, setMapReadySeq] = useState(0)
  // Prevents base-style effect from calling setStyle before initial load completes
  const mapInitializedRef = useRef(false)
  // Set to true by the base-style effect so the idle listener knows a style change is pending
  const styleChangingRef = useRef(false)

  const {
    viewMode,
    baseStyle,
    layers,
    terrainExaggeration,
    setCoordinates,
    setZoom,
    setPitch,
    setBearing,
  } = useMapStore()

  // ── Data layer hooks (order matters: weather → traffic → vessels → flights) ─
  useWeatherLayer(mapRef.current, mapReadySeq)
  useTrafficLayer(mapRef.current, mapReadySeq)
  useVesselLayer(mapRef.current, mapReadySeq)
  useFlightLayer(mapRef.current, mapReadySeq)

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: resolveStyle('road'),
      center: [0, 20],
      zoom: 3,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    })

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')

    map.on('mousemove', (e) => {
      setCoordinates({ lng: e.lngLat.lng, lat: e.lngLat.lat })
    })
    map.on('mouseleave', () => setCoordinates(null))
    map.on('zoom', () => setZoom(map.getZoom()))
    map.on('pitch', () => setPitch(map.getPitch()))
    map.on('rotate', () => setBearing(map.getBearing()))

    const onStyleReady = () => {
      addOverlayLayers(map)
      // Immediately hide liberty's built-in building layers so they don't
      // flash before the React effect cycle can run.
      const style = map.getStyle()
      style?.layers?.forEach((layer) => {
        if (layer.type === 'fill-extrusion' && layer.id !== 'buildings-3d-overlay') {
          map.setLayoutProperty(layer.id, 'visibility', 'none')
        }
      })
      setMapReadySeq(s => s + 1)
    }

    map.on('load', () => {
      mapInitializedRef.current = true
      onStyleReady()
    })

    map.on('style.load', () => {
      if (!mapInitializedRef.current) return
      if (!styleChangingRef.current) return
      styleChangingRef.current = false
      onStyleReady()
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      mapInitializedRef.current = false
      setMapReadySeq(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Base style changes ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    // Skip until after the initial map.on('load') fires — prevents a duplicate
    // setStyle('road') call on first mount that would destroy custom sources.
    if (!map || !mapInitializedRef.current) return
    styleChangingRef.current = true
    map.setStyle(resolveStyle(baseStyle), { diff: false })
  }, [baseStyle])

  // ── 3D Terrain toggle ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    if (layers.terrain3D) {
      if (!map.getSource('terrain-dem')) {
        map.addSource('terrain-dem', {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          tileSize: 256,
          encoding: 'terrarium',
          maxzoom: 14,
        })
      }
      map.setTerrain({ source: 'terrain-dem', exaggeration: terrainExaggeration })
    } else {
      map.setTerrain(null)
    }
  }, [layers.terrain3D, terrainExaggeration])

  // ── Terrain exaggeration live update ─────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layers.terrain3D) return
    if (map.getTerrain()) {
      map.setTerrain({ source: 'terrain-dem', exaggeration: terrainExaggeration })
    }
  }, [terrainExaggeration, layers.terrain3D])

  // ── View mode (2D / 3D) pitch ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.easeTo({ pitch: viewMode === '3D' ? 45 : 0, duration: 600 })
  }, [viewMode])

  // ── Globe projection ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    map.setProjection({ type: viewMode === 'Globe' ? 'globe' : 'mercator' })
  }, [viewMode, mapReadySeq])

  // ── Layer visibility toggles ──────────────────────────────────────────────
  const setLayerVisibility = useCallback((layerId: string, visible: boolean) => {
    const map = mapRef.current
    if (!map || !map.getLayer(layerId)) return
    map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
  }, [])

  useEffect(() => {
    setLayerVisibility('graticule-lines', layers.graticule)
  }, [layers.graticule, setLayerVisibility])

  useEffect(() => {
    if (baseStyle === 'road' || baseStyle === 'satellite') {
      setLayerVisibility('hillshade-overlay', layers.hillshading)
    }
  }, [layers.hillshading, baseStyle, setLayerVisibility])

  // ── Labels: hide/show text layers (exclude data-layer symbols) ───────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const style = map.getStyle()
    if (!style?.layers) return
    const dataLayerIds = new Set(['flights-airborne', 'vessels-layer'])
    style.layers.forEach((layer) => {
      if (layer.type === 'symbol' && !dataLayerIds.has(layer.id)) {
        map.setLayoutProperty(layer.id, 'visibility', layers.labels ? 'visible' : 'none')
      }
    })
  }, [layers.labels])

  // ── Buildings overlay ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    // The liberty (road) style ships its own fill-extrusion building layers.
    // Always hide those so our overlay is the sole source of truth.
    if (baseStyle === 'road') {
      const style = map.getStyle()
      style?.layers?.forEach((layer) => {
        if (layer.type === 'fill-extrusion' && layer.id !== 'buildings-3d-overlay') {
          map.setLayoutProperty(layer.id, 'visibility', 'none')
        }
      })
    }

    setLayerVisibility('buildings-3d-overlay', layers.buildings)
  }, [layers.buildings, baseStyle, mapReadySeq, setLayerVisibility])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
      style={{ cursor: 'crosshair' }}
    />
  )
}
