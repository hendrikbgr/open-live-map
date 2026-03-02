import type { StyleSpecification } from 'maplibre-gl'

// ─── Free Tile Sources ────────────────────────────────────────────────────────
const ESRI_SATELLITE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

const ESRI_TOPO =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'

// Free open-source DEM tiles (Terrarium format) for 3D terrain
const TERRARIUM_DEM =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'

// OpenFreeMap — free vector tiles (OpenMapTiles schema)
export const ROAD_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
export const BRIGHT_STYLE_URL = 'https://tiles.openfreemap.org/styles/bright'

// ─── Shared label text field expression ──────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LABEL_TEXT_FIELD: any =
  ['case', ['has', 'name:nonlatin'],
    ['concat', ['get', 'name:latin'], '\n', ['get', 'name:nonlatin']],
    ['coalesce', ['get', 'name_en'], ['get', 'name']]]

// ─── Satellite Style ──────────────────────────────────────────────────────────
export const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  name: 'Satellite',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    satellite: {
      type: 'raster',
      tiles: [ESRI_SATELLITE],
      tileSize: 256,
      attribution: '&copy; Esri, Maxar, Earthstar Geographics',
      maxzoom: 19,
    },
    'terrain-dem': {
      type: 'raster-dem',
      tiles: [TERRARIUM_DEM],
      tileSize: 256,
      encoding: 'terrarium',
      maxzoom: 14,
      attribution: '&copy; Mapzen, AWS',
    },
    openmaptiles: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
    },
  },
  layers: [
    {
      id: 'satellite',
      type: 'raster',
      source: 'satellite',
    },
    {
      id: 'boundary_2',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['any', ['!', ['has', 'maritime']], ['!=', ['get', 'maritime'], 1]]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': 'rgba(255,255,255,0.5)',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 5, 1, 12, 2],
      },
    },
    {
      id: 'label_country_1',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      maxzoom: 9,
      filter: ['all', ['==', ['get', 'class'], 'country'], ['==', ['get', 'rank'], 1]],
      layout: {
        'text-field': LABEL_TEXT_FIELD,
        'text-font': ['Noto Sans Bold'],
        'text-max-width': 6.25,
        'text-size': ['interpolate', ['linear'], ['zoom'], 1, 10, 4, 18],
      },
      paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.7)', 'text-halo-width': 1.5, 'text-halo-blur': 1 },
    },
    {
      id: 'label_country_2',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      maxzoom: 9,
      filter: ['all', ['==', ['get', 'class'], 'country'], ['==', ['get', 'rank'], 2]],
      layout: {
        'text-field': LABEL_TEXT_FIELD,
        'text-font': ['Noto Sans Bold'],
        'text-max-width': 6.25,
        'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10, 5, 17],
      },
      paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.7)', 'text-halo-width': 1.5, 'text-halo-blur': 1 },
    },
    {
      id: 'label_country_3',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      minzoom: 2,
      maxzoom: 9,
      filter: ['all', ['==', ['get', 'class'], 'country'], ['>=', ['get', 'rank'], 3]],
      layout: {
        'text-field': LABEL_TEXT_FIELD,
        'text-font': ['Noto Sans Bold'],
        'text-max-width': 6.25,
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 9, 7, 16],
      },
      paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.7)', 'text-halo-width': 1.5, 'text-halo-blur': 1 },
    },
    {
      id: 'label_state',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      minzoom: 5,
      maxzoom: 8,
      filter: ['==', ['get', 'class'], 'state'],
      layout: {
        'text-field': LABEL_TEXT_FIELD,
        'text-font': ['Noto Sans Italic'],
        'text-letter-spacing': 0.2,
        'text-max-width': 9,
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 8, 14],
        'text-transform': 'uppercase',
      },
      paint: { 'text-color': 'rgba(255,255,255,0.85)', 'text-halo-color': 'rgba(0,0,0,0.6)', 'text-halo-width': 1.5, 'text-halo-blur': 1 },
    },
    {
      id: 'label_city_capital',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      minzoom: 3,
      filter: ['all', ['==', ['get', 'class'], 'city'], ['has', 'capital'], ['==', ['get', 'capital'], 2]],
      layout: {
        'text-field': LABEL_TEXT_FIELD,
        'text-font': ['Noto Sans Bold'],
        'text-max-width': 8,
        'text-size': ['interpolate', ['exponential', 1.2], ['zoom'], 4, 12, 7, 14, 11, 20],
      },
      paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.7)', 'text-halo-width': 1.5, 'text-halo-blur': 1 },
    },
    {
      id: 'label_city',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      minzoom: 3,
      filter: ['all', ['==', ['get', 'class'], 'city'], ['any', ['!', ['has', 'capital']], ['!=', ['get', 'capital'], 2]]],
      layout: {
        'text-field': LABEL_TEXT_FIELD,
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 8,
        'text-size': ['interpolate', ['exponential', 1.2], ['zoom'], 4, 11, 7, 13, 11, 18],
      },
      paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.7)', 'text-halo-width': 1.5, 'text-halo-blur': 1 },
    },
    {
      id: 'label_town',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      minzoom: 6,
      filter: ['==', ['get', 'class'], 'town'],
      layout: {
        'text-field': LABEL_TEXT_FIELD,
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 8,
        'text-size': ['interpolate', ['exponential', 1.2], ['zoom'], 7, 11, 11, 14],
      },
      paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.7)', 'text-halo-width': 1.5, 'text-halo-blur': 1 },
    },
    {
      id: 'label_village',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      minzoom: 9,
      filter: ['==', ['get', 'class'], 'village'],
      layout: {
        'text-field': LABEL_TEXT_FIELD,
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 8,
        'text-size': ['interpolate', ['exponential', 1.2], ['zoom'], 9, 10, 12, 12],
      },
      paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.7)', 'text-halo-width': 1.5, 'text-halo-blur': 1 },
    },
  ],
}

// ─── Terrain / Topo Style ─────────────────────────────────────────────────────
export const TERRAIN_STYLE: StyleSpecification = {
  version: 8,
  name: 'Terrain',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    topo: {
      type: 'raster',
      tiles: [ESRI_TOPO],
      tileSize: 256,
      attribution: '&copy; Esri, HERE, Garmin, FAO, NOAA, USGS',
      maxzoom: 19,
    },
    'terrain-dem': {
      type: 'raster-dem',
      tiles: [TERRARIUM_DEM],
      tileSize: 256,
      encoding: 'terrarium',
      maxzoom: 14,
      attribution: '&copy; Mapzen, AWS',
    },
  },
  layers: [
    {
      id: 'topo-base',
      type: 'raster',
      source: 'topo',
    },
    {
      id: 'hillshading',
      type: 'hillshade',
      source: 'terrain-dem',
      paint: {
        'hillshade-illumination-direction': 335,
        'hillshade-exaggeration': 0.5,
        'hillshade-shadow-color': '#000000',
        'hillshade-highlight-color': '#ffffff',
      },
    },
  ],
}

// ─── Elevation / DEM-only Style ───────────────────────────────────────────────
export const ELEVATION_STYLE: StyleSpecification = {
  version: 8,
  name: 'Elevation',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    'terrain-dem': {
      type: 'raster-dem',
      tiles: [TERRARIUM_DEM],
      tileSize: 256,
      encoding: 'terrarium',
      maxzoom: 14,
      attribution: '&copy; Mapzen, AWS',
    },
    'osm-base': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm-base',
      type: 'raster',
      source: 'osm-base',
      paint: { 'raster-opacity': 0.3 },
    },
    {
      id: 'hillshading',
      type: 'hillshade',
      source: 'terrain-dem',
      paint: {
        'hillshade-illumination-direction': 335,
        'hillshade-exaggeration': 0.8,
        'hillshade-shadow-color': '#1a1a2e',
        'hillshade-highlight-color': '#e0e8ff',
        'hillshade-accent-color': '#3b5998',
      },
    },
  ],
}

// ─── Style metadata for the UI ────────────────────────────────────────────────
export const MAP_STYLE_META = {
  road: {
    label: 'Road',
    description: 'Vector street map with labels',
    icon: 'Map',
  },
  satellite: {
    label: 'Satellite',
    description: 'ESRI World Imagery',
    icon: 'Satellite',
  },
  terrain: {
    label: 'Terrain',
    description: 'Topographic map with hillshading',
    icon: 'Mountain',
  },
  elevation: {
    label: 'Elevation',
    description: 'Hillshade DEM elevation model',
    icon: 'TrendingUp',
  },
} as const

// ─── Layer metadata for the control panel ─────────────────────────────────────
export const LAYER_META = {
  labels: {
    label: 'Labels',
    description: 'Place names and road labels',
    group: 'base' as const,
    availableIn: ['road', 'satellite', 'terrain', 'elevation'],
  },
  terrain3D: {
    label: '3D Terrain',
    description: 'Extrude elevation into 3D relief',
    group: 'base' as const,
    availableIn: ['road', 'satellite', 'terrain', 'elevation'],
  },
  hillshading: {
    label: 'Hillshading',
    description: 'Shaded relief from DEM data',
    group: 'overlay' as const,
    availableIn: ['road', 'satellite'],
  },
  contours: {
    label: 'Contour Lines',
    description: 'Elevation contours (100m interval)',
    group: 'overlay' as const,
    availableIn: ['road', 'satellite', 'terrain', 'elevation'],
  },
  graticule: {
    label: 'Grid / Graticule',
    description: 'Latitude/longitude grid lines',
    group: 'overlay' as const,
    availableIn: ['road', 'satellite', 'terrain', 'elevation'],
  },
  buildings: {
    label: 'Buildings (3D)',
    description: 'Extruded building footprints',
    group: 'overlay' as const,
    availableIn: ['road', 'satellite', 'terrain', 'elevation'],
  },
  flights: {
    label: 'Live Flights',
    description: 'Real-time ADS-B flight data',
    group: 'data' as const,
    availableIn: ['road', 'satellite', 'terrain', 'elevation'],
  },
  weather: {
    label: 'Weather Radar',
    description: 'Live precipitation radar overlay',
    group: 'data' as const,
    availableIn: ['road', 'satellite', 'terrain', 'elevation'],
  },
  ais: {
    label: 'AIS Vessels',
    description: 'Live ship tracking (aisstream.io)',
    group: 'data' as const,
    availableIn: ['road', 'satellite', 'terrain', 'elevation'],
  },
  traffic: {
    label: 'Road Traffic',
    description: 'Simulated vehicles on roads (zoom 13+)',
    group: 'data' as const,
    availableIn: ['road', 'satellite', 'terrain', 'elevation'],
  },
}

export type LayerMetaKey = keyof typeof LAYER_META
