import { create } from 'zustand'
import type { Vessel, VesselStore } from '../types/vessel'

export const useVesselStore = create<VesselStore>((set) => ({
  selectedVesselId: null,
  vesselMap: new Map<number, Vessel>(),
  vesselCount: 0,
  lastUpdated: null,
  connectionError: null,
  isConnected: false,

  selectVessel: (mmsi) => set({ selectedVesselId: mmsi }),

  upsertVessel: (vessel) =>
    set((state) => {
      const next = new Map(state.vesselMap)
      next.set(vessel.mmsi, vessel)
      return {
        vesselMap: next,
        vesselCount: next.size,
        lastUpdated: Date.now(),
        connectionError: null,
      }
    }),

  clearVessels: () =>
    set({
      vesselMap: new Map(),
      vesselCount: 0,
      lastUpdated: null,
    }),

  setConnectionError: (error) => set({ connectionError: error }),
  setIsConnected: (connected) => set({ isConnected: connected }),
}))
