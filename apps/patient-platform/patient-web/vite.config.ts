import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: true,
      port: 5173,
      cors: true,
      allowedHosts: [
        'oncolife-patient.inheritxdev.in',
      ],
      proxy: {
        '/api': {
          target: env.VITE_API_BASE || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
          ws: true,
        },
        '/static': {
          target: env.VITE_API_BASE || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    preview: {
      port: 5173,
      strictPort: true,
      allowedHosts: [
        'oncolife-patient.inheritxdev.in',
      ],
    },
    define: {
      global: 'globalThis',
    }
  }
})