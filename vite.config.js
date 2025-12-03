import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const N8N_BASE = process.env.N8N_BASE_URL || 'http://localhost:5678'
const N8N_WEBHOOK = process.env.N8N_WEBHOOK_URL || 'http://localhost:5679'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
    },
  },
})
