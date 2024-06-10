import { fileURLToPath, URL } from 'node:url'
import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: { transformAssetUrls }
    }),
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
  base: '/',
  server: {
    proxy: {
      '/fdsnws': {
        target: 'http://localhost:8000'
      },
      '/api': {
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
