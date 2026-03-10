import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()] as any,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5174, // Different port from patient-web (5173)
    cors: true,
    allowedHosts: [
      'isidra-nonpapal-georgine.ngrok-free.dev',
      'oncolife-doctor.inheritxdev.in',
    ],
    proxy: {
      '/api/v1/auth': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
        secure: false
      },
      '/api/v1/staff': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
        secure: false
      },
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  preview: {
    port: 5174,
    strictPort: true,
    allowedHosts: [
      'oncolife-doctor.inheritxdev.in',
    ],
  },
  define: {
    global: 'globalThis',
  }
})
