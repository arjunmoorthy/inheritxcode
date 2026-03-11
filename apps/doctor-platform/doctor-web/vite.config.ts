import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBase = env.VITE_API_BASE || 'http://127.0.0.1:8000'

  return {
    plugins: [react()] as any,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: ['react', 'react-dom', 'react-router-dom'],
    },
    server: {
      host: true,
      port: 5174, // Different port from patient-web (5173)
      cors: true,
      allowedHosts: [
        'localhost',
        'isidra-nonpapal-georgine.ngrok-free.dev',
        'oncolife-doctor.inheritxdev.in',
      ],
      proxy: {
        '/api': {
          target: apiBase,
          changeOrigin: true,
          secure: false,
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
        },
      },
    },
    preview: {
      port: 5174,
      strictPort: true,
      allowedHosts: [
        'localhost',
        'oncolife-doctor.inheritxdev.in',
      ],
      proxy: {
        '/api': {
          target: apiBase,
          changeOrigin: true,
          secure: false,
          headers: { 'ngrok-skip-browser-warning': 'true' },
        },
      },
    },
    define: {
      global: 'globalThis',
    },
  }
})
