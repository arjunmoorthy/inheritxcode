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
        'localhost',
        'oncolife-patient.inheritxdev.in',
        'leida-bailable-loraine.ngrok-free.dev',
        'isidra-nonpapal-georgine.ngrok-free.dev',
        'oncolife-ai-patient-web.vercel.app',
      ],
      proxy: {
        '/api': {
          target: env.VITE_API_BASE || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
          ws: true,
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
        },
        '/static': {
          target: env.VITE_API_BASE || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
        }
      }
    },
    preview: {
      port: 5173,
      strictPort: true,
      allowedHosts: [
        'localhost',
        'oncolife-patient.inheritxdev.in',
        'leida-bailable-loraine.ngrok-free.dev',
        'isidra-nonpapal-georgine.ngrok-free.dev',
        'oncolife-ai-patient-web.vercel.app',
      ],
    },
    define: {
      global: 'globalThis',
    }
  }
})