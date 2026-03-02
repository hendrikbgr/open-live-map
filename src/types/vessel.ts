export interface Vessel {
  mmsi: number
  name: string | null
  longitude: number
  latitude: number
  cog: number      // Course over ground (degrees)
  sog: number      // Speed over ground (knots)
  heading: number  // True heading (degrees, 511 = not available)
  navStatus: number
  shipType: number
  lastUpdate: number // Unix timestamp ms
}

export interface VesselProperties {
  mmsi: number
  name: string | null
  cog: number
  sog: number
  heading: number
  navStatus: number
  shipType: number
  lastUpdate: number
}

export interface VesselState {
  selectedVesselId: number | null
  vesselMap: Map<number, Vessel>
  vesselCount: number
  lastUpdated: number | null
  connectionError: string | null
  isConnected: boolean
}

export interface VesselActions {
  selectVessel: (mmsi: number | null) => void
  upsertVessel: (vessel: Vessel) => void
  clearVessels: () => void
  setConnectionError: (error: string | null) => void
  setIsConnected: (connected: boolean) => void
}

export type VesselStore = VesselState & VesselActions
