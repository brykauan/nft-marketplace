
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      '@': path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        './src'
      ),
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@tanstack')) {
              return 'tanstack'
            }

            if (
              id.includes('react-dom') ||
              id.includes('/react/') ||
              id.includes('\\react\\')
            ) {
              return 'react-vendor'
            }

            if (id.includes('lucide-react')) {
              return 'icons'
            }
          }
        },
      },
    },
  },
})
