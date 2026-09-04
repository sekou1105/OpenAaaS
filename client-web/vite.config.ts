import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

/// <reference types="vitest" />

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  clearScreen: false,
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      // 开发模式下将 /api 代理到本地 server，避免跨域（可选，前端默认直连配置的服务器地址）
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  envPrefix: ['VITE_'],
  build: {
    target: 'es2021',
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
}))
