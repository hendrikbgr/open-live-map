import { useState } from 'react'
import { MapView } from './components/Map/MapView'
import { Sidebar } from './components/UI/Sidebar'
import { StatusBar } from './components/UI/StatusBar'
import { FlightPanel } from './components/UI/FlightPanel'
import { VesselPanel } from './components/UI/VesselPanel'

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="relative w-full h-full bg-surface-900 overflow-hidden">
      {/* Full-screen map — offset by sidebar width */}
      <div
        className="absolute inset-0 transition-all duration-300"
        style={{ left: sidebarCollapsed ? 0 : '18rem' }}
      >
        <MapView />
      </div>

      {/* Sidebar + toggle tab */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />

      {/* Detail panels — float in map area, pointer-events passthrough when hidden */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-300"
        style={{ left: sidebarCollapsed ? 0 : '18rem' }}
      >
        <FlightPanel />
        <VesselPanel />
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  )
}
