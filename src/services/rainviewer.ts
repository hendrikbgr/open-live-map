const API_URL = '/api/rainviewer/public/weather-maps.json'

interface RadarFrame {
  time: number
  path: string
}

interface RainViewerResponse {
  host: string
  radar: {
    past: RadarFrame[]
    nowcast: RadarFrame[]
  }
}

let cachedFrames: RadarFrame[] = []
let lastFetch = 0

export async function fetchLatestRadarFrame(): Promise<{
  tileUrl: string
  timestamp: number
} | null> {
  const now = Date.now()

  if (now - lastFetch > 120_000 || cachedFrames.length === 0) {
    const res = await fetch(API_URL)
    if (!res.ok) throw new Error(`RainViewer API error: ${res.status}`)

    const data = (await res.json()) as RainViewerResponse
    cachedFrames = [...data.radar.past, ...data.radar.nowcast]
    lastFetch = now
  }

  if (cachedFrames.length === 0) return null

  const latest = cachedFrames[cachedFrames.length - 1]
  const tileUrl = `/api/rainviewer-tiles${latest.path}/256/{z}/{x}/{y}/6/1_1.png`

  return { tileUrl, timestamp: latest.time }
}
