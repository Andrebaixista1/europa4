import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const N8N_BASE = env.N8N_BASE_URL || process.env.N8N_BASE_URL || 'http://localhost:5678'
  const N8N_WEBHOOK = env.N8N_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL || 'http://localhost:5679'
  const BMG_SOAP_URL = env.BMG_SOAP_URL || env.VITE_BMG_SOAP_URL || process.env.BMG_SOAP_URL || process.env.VITE_BMG_SOAP_URL || ''

  return {
    plugins: [react()],
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
        '/api/presenca': {
          target: 'http://85.31.61.242:3011',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/presenca/, ''),
        },
      },
    },
  }
})
