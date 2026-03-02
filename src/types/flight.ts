// Raw row from the OpenSky /states/all response (17 fields)
export type RawStateVector = [
  string,          // [0]  icao24
  string | null,   // [1]  callsign
  string,          // [2]  origin_country
  number | null,   // [3]  time_position
  number,          // [4]  last_contact
  number | null,   // [5]  longitude
  number | null,   // [6]  latitude
  number | null,   // [7]  baro_altitude (meters)
  boolean,         // [8]  on_ground
  number | null,   // [9]  velocity (m/s)
  number | null,   // [10] true_track (degrees, clockwise from north)
  number | null,   // [11] vertical_rate (m/s, positive = climbing)
  number[] | null, // [12] sensors
  number | null,   // [13] geo_altitude (meters)
  string | null,   // [14] squawk
  boolean,         // [15] spi
  number,          // [16] position_source (0=ADS-B, 1=ASTERIX, 2=MLAT, 3=FLARM)
]

export interface OpenSkyResponse {
  time: number
  states: RawStateVector[] | null
}

// Normalized, parsed aircraft state
export interface Aircraft {
  icao24: string
  callsign: string | null
  originCountry: string
  longitude: number
  latitude: number
  baroAltitude: number | null
  onGround: boolean
  velocity: number | null       // m/s
  trueTrack: number             // degrees 0–360 (defaults to 0 if null)
  verticalRate: number | null   // m/s
  geoAltitude: number | null
  squawk: string | null
  lastContact: number           // Unix timestamp
  positionSource: number        // 0=ADS-B, 1=ASTERIX, 2=MLAT, 3=FLARM
}

// Properties stored on each GeoJSON feature (subset of Aircraft)
export interface AircraftProperties {
  icao24: string
  callsign: string | null
  onGround: boolean
  trueTrack: number
  verticalRate: number | null
  baroAltitude: number | null
  velocity: number | null
  originCountry: string
  squawk: string | null
  lastContact: number
  positionSource: number
}

// OAuth2 cached token
export interface TokenState {
  accessToken: string
  expiresAt: number // Date.now() + (expires_in - 60) * 1000
}

// Zustand flight store shape
export interface FlightState {
  selectedAircraftId: string | null
  aircraftMap: Map<string, Aircraft>
  aircraftCount: number
  lastUpdated: number | null
  fetchError: string | null
  isFetching: boolean
}

export interface FlightActions {
  selectAircraft: (icao24: string | null) => void
  setAircraftData: (aircraft: Aircraft[], timestamp: number) => void
  setFetchError: (error: string | null) => void
  setIsFetching: (fetching: boolean) => void
}

export type FlightStore = FlightState & FlightActions
