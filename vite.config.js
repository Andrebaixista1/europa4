import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const N8N_BASE = env.N8N_BASE_URL || process.env.N8N_BASE_URL || 'http://localhost:5678'
  const N8N_WEBHOOK = env.N8N_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL || 'http://localhost:5679'
  const BMG_SOAP_URL = env.BMG_SOAP_URL || env.VITE_BMG_SOAP_URL || process.env.BMG_SOAP_URL || process.env.VITE_BMG_SOAP_URL || ''
  const PRESENCA_API_BASE = env.PRESENCA_API_BASE_URL || process.env.PRESENCA_API_BASE_URL || 'http://85.31.61.242:3011'
  const V8_IMPORT_API_BASE = env.V8_IMPORT_API_BASE_URL || process.env.V8_IMPORT_API_BASE_URL || 'http://85.31.61.242:3002'

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
        '/api/presenca': {
          target: PRESENCA_API_BASE,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/presenca/, ''),
        },
        '/api/clientes-v8': {
          target: V8_IMPORT_API_BASE,
          changeOrigin: true,
          secure: false,
        },
        '/api/consulta-v8': {
          target: V8_IMPORT_API_BASE,
          changeOrigin: true,
          secure: false,
        },
        '/api/consulta-presenca': {
          target: V8_IMPORT_API_BASE,
          changeOrigin: true,
          secure: false,
        },
        '/api/health-consult': {
          target: V8_IMPORT_API_BASE,
          changeOrigin: true,
          secure: false,
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
      },
    },
  }
})
