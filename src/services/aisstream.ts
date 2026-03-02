import type { Vessel } from '../types/vessel'

const API_KEY = import.meta.env.VITE_AISSTREAM_API_KEY as string | undefined
const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/ais`

const TAG = '[AIS]'
const MAX_RETRY_DELAY = 30_000
const INITIAL_RETRY_DELAY = 2_000

export interface AISBBox {
  lamin: number
  lomin: number
  lamax: number
  lomax: number
}

interface AISCallbacks {
  onMessage: (vessel: Vessel) => void
  onConnect: () => void
  onDisconnect: () => void
  onError: (error: string) => void
}

let ws: WebSocket | null = null
let callbacks: AISCallbacks | null = null
let lastBBox: AISBBox | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryDelay = INITIAL_RETRY_DELAY
let intentionalClose = false

export function isConfigured(): boolean {
  return !!API_KEY
}

function sendSubscription(bbox: AISBBox) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return
  console.log(TAG, 'Sending subscription for bbox', bbox)
  ws.send(
    JSON.stringify({
      APIKey: API_KEY,
      BoundingBoxes: [
        [
          [bbox.lamin, bbox.lomin],
          [bbox.lamax, bbox.lomax],
        ],
      ],
      FilterMessageTypes: ['PositionReport'],
    }),
  )
}

export function connect(bbox: AISBBox, cbs: AISCallbacks): void {
  disconnect()
  callbacks = cbs
  lastBBox = bbox
  intentionalClose = false

  if (!API_KEY) {
    console.warn(TAG, 'No API key configured')
    cbs.onError('VITE_AISSTREAM_API_KEY not set – register free at aisstream.io')
    return
  }

  console.log(TAG, 'Connecting to', WS_URL)
  ws = new WebSocket(WS_URL)
  ws.binaryType = 'arraybuffer'

  ws.onopen = () => {
    console.log(TAG, 'Connected')
    retryDelay = INITIAL_RETRY_DELAY
    callbacks?.onConnect()
    sendSubscription(bbox)
  }

  ws.onmessage = (event) => {
    try {
      const text = event.data instanceof ArrayBuffer
        ? new TextDecoder().decode(event.data)
        : event.data
      const data = JSON.parse(text)

      if (data.error || data.Error) {
        const errMsg = data.error || data.Error || 'Unknown server error'
        console.error(TAG, 'Server error:', errMsg)
        callbacks?.onError(String(errMsg))
        return
      }

      if (data.MessageType !== 'PositionReport') return

      const meta = data.MetaData
      const pos = data.Message.PositionReport

      const vessel: Vessel = {
        mmsi: meta.MMSI,
        name: meta.ShipName?.trim() || null,
        latitude: meta.latitude,
        longitude: meta.longitude,
        cog: pos.Cog ?? 0,
        sog: pos.Sog ?? 0,
        heading: pos.TrueHeading ?? 511,
        navStatus: pos.NavigationalStatus ?? 15,
        shipType: meta.ShipType ?? 0,
        lastUpdate: Date.now(),
      }
      callbacks?.onMessage(vessel)
    } catch {
      // skip malformed frames
    }
  }

  ws.onerror = (e) => {
    console.error(TAG, 'WebSocket error', e)
    callbacks?.onError('AIS WebSocket connection error')
  }

  ws.onclose = (e) => {
    console.log(TAG, `Disconnected (code=${e.code}, reason=${e.reason || 'none'}, intentional=${intentionalClose})`)
    callbacks?.onDisconnect()
    if (!intentionalClose && callbacks && lastBBox) {
      scheduleRetry()
    }
  }
}

function scheduleRetry() {
  if (retryTimer) return
  console.log(TAG, `Reconnecting in ${retryDelay / 1000}s...`)
  retryTimer = setTimeout(() => {
    retryTimer = null
    if (callbacks && lastBBox) {
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY)
      connect(lastBBox, callbacks)
    }
  }, retryDelay)
}

export function reconnect(bbox: AISBBox): void {
  if (!callbacks) return
  if (ws && ws.readyState === WebSocket.CONNECTING) return
  if (ws && ws.readyState === WebSocket.OPEN) {
    lastBBox = bbox
    sendSubscription(bbox)
    return
  }
  connect(bbox, callbacks)
}

export function disconnect(): void {
  intentionalClose = true
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  if (ws) {
    ws.onopen = null
    ws.onmessage = null
    ws.onerror = null
    ws.onclose = null
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close()
    }
    ws = null
  }
  callbacks = null
  lastBBox = null
  retryDelay = INITIAL_RETRY_DELAY
}
