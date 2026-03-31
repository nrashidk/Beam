import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Shared proxy configuration
const proxyConfig = {
  target: "http://localhost:8000",
  changeOrigin: true,
};

const apiProxyConfig = {
  ...proxyConfig,
  rewrite: (path) => path.replace(/^\/api/, ""),
};

const backendRoutes = {
  "/api": apiProxyConfig,
  "/auth": proxyConfig,
  "/admin": proxyConfig,
  "/companies": proxyConfig,
  "/company": proxyConfig,
  "/register": proxyConfig,
  "/plans": proxyConfig,
  "/billing": proxyConfig,
  "/invoices": proxyConfig,
  "/inward-invoices": proxyConfig,
  "/purchase-orders": proxyConfig,
  "/vendors": proxyConfig,
  "/templates": proxyConfig,
  "/settings": proxyConfig,
  "/content": proxyConfig,
  "/analytics": proxyConfig,
  "/reports": proxyConfig,
  "/vat-return": proxyConfig,
  "/vat-returns": proxyConfig,
  "/expenses": proxyConfig,
  "/expense-categories": proxyConfig,
  "/inventory": proxyConfig,
  "/journal-entries": proxyConfig,
  "/accounts": proxyConfig,
  "/gl-summary": proxyConfig,
  "/audit-trail": proxyConfig,
  "/audit-logs": proxyConfig,
  "/audit-files": proxyConfig,
  "/data-archival": proxyConfig,
  "/users": proxyConfig,
  "/me": proxyConfig,
  "/health": proxyConfig,
  "/public": proxyConfig,
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    proxy: backendRoutes,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
  },
  preview: {
    host: "0.0.0.0",
    port: 5000,
    proxy: backendRoutes,
  },
});
