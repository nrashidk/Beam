import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Shared proxy configuration
const proxyConfig = {
  target: 'http://localhost:8080',
  changeOrigin: true,
}

const apiProxyConfig = {
  ...proxyConfig,
  rewrite: (path) => path.replace(/^\/api/, '')
}

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
      '/api': apiProxyConfig,
      '/auth': proxyConfig,
      '/admin': proxyConfig,
      '/companies': proxyConfig,
      '/company': proxyConfig,
      '/register': proxyConfig,
      '/plans': proxyConfig,
      '/billing': proxyConfig,
      '/invoices': proxyConfig,
      '/inward-invoices': proxyConfig,
      '/purchase-orders': proxyConfig,
      '/vendors': proxyConfig,
      '/templates': proxyConfig,
      '/settings': proxyConfig,
      '/content': proxyConfig,
      '/analytics': proxyConfig
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
  },
  preview: {
    host: '0.0.0.0',
    port: 5000,
    proxy: {
      '/api': apiProxyConfig,
      '/auth': proxyConfig,
      '/admin': proxyConfig,
      '/companies': proxyConfig,
      '/company': proxyConfig,
      '/register': proxyConfig,
      '/plans': proxyConfig,
      '/billing': proxyConfig,
      '/invoices': proxyConfig,
      '/inward-invoices': proxyConfig,
      '/purchase-orders': proxyConfig,
      '/vendors': proxyConfig,
      '/templates': proxyConfig,
      '/settings': proxyConfig,
      '/content': proxyConfig,
      '/analytics': proxyConfig
    }
  }
})
