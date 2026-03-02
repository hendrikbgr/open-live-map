import type { Aircraft, OpenSkyResponse, RawStateVector, TokenState } from '../types/flight'

const CLIENT_ID = import.meta.env.VITE_OPENSKY_CLIENT_ID as string
const CLIENT_SECRET = import.meta.env.VITE_OPENSKY_CLIENT_SECRET as string

const TOKEN_URL =
  '/api/opensky-auth/auth/realms/opensky-network/protocol/openid-connect/token'
const STATES_URL = '/api/opensky/states/all'

// ─── Token singleton ──────────────────────────────────────────────────────────
// Module-level cache shared across all poll calls. Never re-created if still valid.

let tokenCache: TokenState | null = null
let tokenPromise: Promise<TokenState> | null = null

async function fetchNewToken(): Promise<TokenState> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  })

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    throw new Error(`OpenSky auth failed: ${res.status} ${res.statusText}`)
  }

  const data = (await res.json()) as {
    access_token: string
    expires_in: number
    token_type: string
  }

  const state: TokenState = {
    accessToken: data.access_token,
    // Subtract 60s so we refresh before the hard 30-minute expiry
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }

  tokenCache = state
  return state
}

export async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken
  }
  // Deduplicate: if a fetch is already in flight, wait for it
  if (!tokenPromise) {
    tokenPromise = fetchNewToken().finally(() => {
      tokenPromise = null
    })
  }
  const state = await tokenPromise
  return state.accessToken
}

// ─── State vector parsing ─────────────────────────────────────────────────────

export function parseStateVector(raw: RawStateVector): Aircraft | null {
  const lon = raw[5]
  const lat = raw[6]
  if (lon === null || lat === null) return null // no position data

  const callsign = raw[1]?.trim() || null

  return {
    icao24: raw[0],
    callsign,
    originCountry: raw[2],
    longitude: lon,
    latitude: lat,
    baroAltitude: raw[7],
    onGround: raw[8],
    velocity: raw[9],
    trueTrack: raw[10] ?? 0, // default north-pointing if null
    verticalRate: raw[11],
    geoAltitude: raw[13],
    squawk: raw[14],
    lastContact: raw[4],
    positionSource: raw[16],
  }
}

// ─── Bounding box ─────────────────────────────────────────────────────────────

export interface BBox {
  lamin: number
  lomin: number
  lamax: number
  lomax: number
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

export async function fetchFlights(bbox: BBox): Promise<Aircraft[]> {
  let token: string

  try {
    token = await getAccessToken()
  } catch {
    // Fall back to unauthenticated (rate-limited but functional)
    token = ''
  }

  const params = new URLSearchParams({
    lamin: String(Math.max(-90, bbox.lamin)),
    lomin: String(Math.max(-180, bbox.lomin)),
    lamax: String(Math.min(90, bbox.lamax)),
    lomax: String(Math.min(180, bbox.lomax)),
  })

  const headers: HeadersInit = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  const res = await fetch(`${STATES_URL}?${params}`, { headers })

  // Token expired mid-session — clear cache and retry once
  if (res.status === 401) {
    tokenCache = null
    const newToken = await getAccessToken()
    const retryRes = await fetch(`${STATES_URL}?${params}`, {
      headers: { Authorization: `Bearer ${newToken}` },
    })
    if (!retryRes.ok) {
      throw new Error(`OpenSky API error: ${retryRes.status}`)
    }
    const retryData = (await retryRes.json()) as OpenSkyResponse
    return (retryData.states ?? []).map(parseStateVector).filter(Boolean) as Aircraft[]
  }

  if (!res.ok) {
    throw new Error(`OpenSky API error: ${res.status} ${res.statusText}`)
  }

  const data = (await res.json()) as OpenSkyResponse
  return (data.states ?? []).map(parseStateVector).filter(Boolean) as Aircraft[]
}
