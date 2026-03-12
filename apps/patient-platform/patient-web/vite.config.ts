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
      // Prevent duplicate React/Emotion/MUI so theme and sx styles apply on live (shared package otherwise can use different instances)
      dedupe: [
        'react',
        'react-dom',
        'react-router-dom',
        '@emotion/react',
        '@emotion/styled',
        '@mui/material',
        '@mui/system',
      ],
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
        'oncolife-patient-api.inheritxdev.in'
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
        'oncolife-patient-api.inheritxdev.in'
      ],
      // Proxy to backend so preview (npm run preview) can hit API like dev server
      proxy: {
        '/api': {
          target: env.VITE_API_BASE || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
          ws: true,
          headers: { 'ngrok-skip-browser-warning': 'true' },
        },
        '/static': {
          target: env.VITE_API_BASE || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
          headers: { 'ngrok-skip-browser-warning': 'true' },
        },
      },
    },
    define: {
      global: 'globalThis',
    }
  }
})