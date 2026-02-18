import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const presencaPendingDevMiddleware = () => ({
  name: 'presenca-pending-dev-middleware',
  configureServer(server) {
    server.middlewares.use('/api/presenca/pending', async (req, res, next) => {
      if (req.method !== 'POST') return next()

      try {
        const chunks = []
        for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        const raw = Buffer.concat(chunks).toString('utf8')
        const body = raw ? JSON.parse(raw) : {}

        const { default: handler } = await import('./api/presenca/pending.js')
        // Minimal Vercel-like objects for local dev.
        const mockReq = { method: 'POST', headers: req.headers, body }
        const mockRes = {
          status(code) { this.statusCode = code; return this },
          setHeader: (k, v) => res.setHeader(k, v),
          json(payload) {
            res.statusCode = this.statusCode || 200
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify(payload))
          }
        }

        await handler(mockReq, mockRes)
      } catch (err) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ ok: false, error: err?.message || 'Erro no middleware local.' }))
      }
    })
  }
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const N8N_BASE = env.N8N_BASE_URL || process.env.N8N_BASE_URL || 'http://localhost:5678'
  const N8N_WEBHOOK = env.N8N_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL || 'http://localhost:5679'
  const BMG_SOAP_URL = env.BMG_SOAP_URL || env.VITE_BMG_SOAP_URL || process.env.BMG_SOAP_URL || process.env.VITE_BMG_SOAP_URL || ''

  return {
    plugins: [react(), presencaPendingDevMiddleware()],
    envPrefix: ['VITE_', 'login_bmg', 'senha_bmg'],
    server: {
      proxy: {
        '/api/n8n': {
          target: N8N_BASE,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/n8n/, ''),
          router: (req) => {
            const url = req?.url || ''
            return url.includes('/webhook') ? N8N_WEBHOOK : N8N_BASE
          },
        },
        ...(BMG_SOAP_URL
          ? {
            '/api/bmg': {
              target: BMG_SOAP_URL,
              changeOrigin: true,
              secure: false,
              rewrite: (path) => path.replace(/^\/api\/bmg/, ''),
            },
          }
          : {}),
        '/api/presenca/api': {
          target: 'http://85.31.61.242:3011',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/presenca/, ''),
        },
      },
    },
  }
})
