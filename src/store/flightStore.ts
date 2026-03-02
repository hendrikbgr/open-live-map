import { create } from 'zustand'
import type { Aircraft, FlightStore } from '../types/flight'

export const useFlightStore = create<FlightStore>((set) => ({
  // State
  selectedAircraftId: null,
  aircraftMap: new Map<string, Aircraft>(),
  aircraftCount: 0,
  lastUpdated: null,
  fetchError: null,
  isFetching: false,

  // Actions
  selectAircraft: (icao24) => set({ selectedAircraftId: icao24 }),

  setAircraftData: (aircraft, timestamp) => {
    const map = new Map<string, Aircraft>()
    for (const a of aircraft) map.set(a.icao24, a)
    set({
      aircraftMap: map,
      aircraftCount: aircraft.length,
      lastUpdated: timestamp,
      fetchError: null,
    })
  },

  setFetchError: (error) => set({ fetchError: error }),
  setIsFetching: (fetching) => set({ isFetching: fetching }),
}))
