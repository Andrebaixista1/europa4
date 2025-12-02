import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://85.31.61.242:5679',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
