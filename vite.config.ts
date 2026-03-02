import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tls from 'tls'
import type { Plugin } from 'vite'

// ─── AIS WebSocket relay plugin ───────────────────────────────────────────────
// Chrome (BoringSSL) cannot perform the TLS renegotiation that stream.aisstream.io
// requires before sending its 101 response.  This plugin intercepts upgrade
// requests at /ws/ais and tunnels them through Node.js's TLS stack, which
// handles renegotiation transparently, then pipes raw bytes in both directions.
function aisRelayPlugin(): Plugin {
  return {
    name: 'ais-ws-relay',
    configureServer(server) {
      server.httpServer?.on('upgrade', (req, socket, head) => {
        if (!req.url?.startsWith('/ws/ais')) return

        socket.on('error', () => upstream.destroy())

        const upstream = tls.connect({
          host: 'stream.aisstream.io',
          port: 443,
          servername: 'stream.aisstream.io',
        })

        upstream.on('error', (err) => {
          console.error('[AIS relay] upstream error:', err.message)
          socket.destroy()
        })

        upstream.on('secureConnect', () => {
          const wsKey = req.headers['sec-websocket-key']
          upstream.write(
            `GET /v0/stream HTTP/1.1\r\n` +
            `Host: stream.aisstream.io\r\n` +
            `Upgrade: websocket\r\n` +
            `Connection: Upgrade\r\n` +
            `Sec-WebSocket-Key: ${wsKey}\r\n` +
            `Sec-WebSocket-Version: 13\r\n` +
            `\r\n`,
          )
        })

        let headerBuf = Buffer.alloc(0)
        let handshakeDone = false

        upstream.on('data', function onData(chunk: Buffer) {
          if (handshakeDone) return
          headerBuf = Buffer.concat([headerBuf, chunk])
          const sep = headerBuf.indexOf('\r\n\r\n')
          if (sep === -1) return

          handshakeDone = true
          upstream.removeListener('data', onData)

          const headerStr = headerBuf.slice(0, sep).toString()
          const rest = headerBuf.slice(sep + 4)

          if (!headerStr.startsWith('HTTP/1.1 101')) {
            console.error('[AIS relay] unexpected upstream response:', headerStr.split('\r\n')[0])
            socket.destroy()
            upstream.destroy()
            return
          }

          const acceptMatch = headerStr.match(/sec-websocket-accept:\s*([^\r\n]+)/i)
          const acceptKey = acceptMatch ? acceptMatch[1].trim() : ''

          socket.write(
            `HTTP/1.1 101 Switching Protocols\r\n` +
            `Upgrade: websocket\r\n` +
            `Connection: Upgrade\r\n` +
            `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`,
          )

          // Forward any data that arrived after the 101 headers
          if (rest.length > 0) socket.write(rest)
          // Forward any data the browser already sent (usually empty for WS)
          if (head.length > 0) upstream.write(head)

          // Transparent bidirectional pipe
          socket.pipe(upstream)
          upstream.pipe(socket)
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), aisRelayPlugin()],
  optimizeDeps: {
    esbuildOptions: { target: 'es2022' },
  },
  esbuild: { target: 'es2022' },
  server: {
    port: 5174,
    strictPort: true,
    host: '127.0.0.1',
    proxy: {
      '/api/opensky-auth': {
        target: 'https://auth.opensky-network.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/opensky-auth/, ''),
        secure: true,
      },
      '/api/opensky': {
        target: 'https://opensky-network.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/opensky/, '/api'),
        secure: true,
      },
      '/api/rainviewer-tiles': {
        target: 'https://tilecache.rainviewer.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/rainviewer-tiles/, ''),
        secure: true,
      },
      '/api/rainviewer': {
        target: 'https://api.rainviewer.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/rainviewer/, ''),
        secure: true,
      },
    },
  },
})
