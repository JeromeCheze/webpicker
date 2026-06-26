import { fileURLToPath, URL } from 'node:url'
import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'
import vueDevTools from 'vite-plugin-vue-devtools'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: { transformAssetUrls }
    }),
    vueDevTools(),
    vuetify()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    assetsDir: './static'
  },
  base: process.env.WEBPICKER_BASE_URL || '/',
  server: {
    proxy: {
      '/fdsnws': {
        target: 'http://localhost:8000'
      },
      '/api': {
        target: 'http://localhost:8000'
      },
      '/app': {
        target: 'http://localhost:8000'
      },
      '/user': {
        target: 'http://localhost:8000'
      },
      '/ws': {
        target: 'http://localhost:8000',
        ws: true
      }
    }
  }
})
