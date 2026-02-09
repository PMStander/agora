import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // For Tauri
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    proxy: {
      '/openclaw': {
        target: 'http://127.0.0.1:18789',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/openclaw/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, _req, _res) => {
            proxyReq.setHeader('Origin', 'http://127.0.0.1:18789');
          });
          proxy.on('proxyReqWs', (proxyReq, _req, _socket, _options, _head) => {
            proxyReq.setHeader('Origin', 'http://127.0.0.1:18789');
          });
        },
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/openclaw': {
        target: 'http://127.0.0.1:18789',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/openclaw/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, _req, _res) => {
            proxyReq.setHeader('Origin', 'http://127.0.0.1:18789');
          });
          proxy.on('proxyReqWs', (proxyReq, _req, _socket, _options, _head) => {
            proxyReq.setHeader('Origin', 'http://127.0.0.1:18789');
          });
        },
      },
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
})
