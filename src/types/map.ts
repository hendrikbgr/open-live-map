export type BaseMapStyle = 'road' | 'satellite' | 'terrain' | 'elevation'

export type ViewMode = '2D' | '3D' | 'Globe'

export interface LayerConfig {
  id: string
  label: string
  enabled: boolean
  description: string
  group: 'base' | 'overlay' | 'data'
}

export interface MapLayers {
  labels: boolean
  terrain3D: boolean
  hillshading: boolean
  contours: boolean
  graticule: boolean
  buildings: boolean
  // Data layers
  flights: boolean
  weather: boolean
  ais: boolean
  traffic: boolean
}

export interface MapState {
  viewMode: ViewMode
  baseStyle: BaseMapStyle
  layers: MapLayers
  terrainExaggeration: number
  coordinates: { lng: number; lat: number } | null
  zoom: number
  pitch: number
  bearing: number
}

export interface MapActions {
  setViewMode: (mode: ViewMode) => void
  setBaseStyle: (style: BaseMapStyle) => void
  toggleLayer: (layer: keyof MapLayers) => void
  setTerrainExaggeration: (value: number) => void
  setCoordinates: (coords: { lng: number; lat: number } | null) => void
  setZoom: (zoom: number) => void
  setPitch: (pitch: number) => void
  setBearing: (bearing: number) => void
}

export type MapStore = MapState & MapActions
