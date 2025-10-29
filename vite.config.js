import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/auth': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/companies': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/register': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/plans': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/invoices': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/inward-invoices': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/purchase-orders': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/vendors': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/templates': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/settings': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/content': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})
