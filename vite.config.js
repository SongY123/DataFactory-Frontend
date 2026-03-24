import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const API_TARGET = process.env.DATAFACTORY_API_TARGET || 'http://127.0.0.1:8888'
const SHOULD_OPEN_BROWSER = process.env.DATAFACTORY_ELECTRON_DEV !== '1'

export default defineConfig({
  base: './',
  plugins: [vue()],
  server: {
    host: true,
    port: 8001,
    open: SHOULD_OPEN_BROWSER,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist'
  }
})
