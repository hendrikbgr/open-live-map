import { create } from 'zustand'
import type { MapStore } from '../types/map'

export const useMapStore = create<MapStore>((set) => ({
  // State
  viewMode: '2D',
  baseStyle: 'road',
  layers: {
    labels: true,
    terrain3D: false,
    hillshading: true,
    contours: false,
    graticule: false,
    buildings: false,
    flights: false,
    weather: false,
    ais: false,
    traffic: false,
  },
  terrainExaggeration: 1.5,
  coordinates: null,
  zoom: 3,
  pitch: 0,
  bearing: 0,

  // Actions
  setViewMode: (mode) =>
    set((state) => ({
      viewMode: mode,
      pitch: mode === '3D' ? 45 : 0,
      layers: {
        ...state.layers,
        terrain3D: mode === '3D' ? true : state.layers.terrain3D,
      },
    })),

  setBaseStyle: (style) => set({ baseStyle: style }),

  toggleLayer: (layer) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [layer]: !state.layers[layer],
      },
    })),

  setTerrainExaggeration: (value) => set({ terrainExaggeration: value }),
  setCoordinates: (coords) => set({ coordinates: coords }),
  setZoom: (zoom) => set({ zoom }),
  setPitch: (pitch) => set({ pitch }),
  setBearing: (bearing) => set({ bearing }),
}))
