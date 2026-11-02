import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\/](react|react-dom|react-router|react-router-dom|scheduler)[\/]/, priority: 3 },
            { name: 'ui', test: /node_modules[\/](radix-ui|@radix-ui|motion|framer-motion|motion-dom|motion-utils|lucide-react|sonner)[\/]/, priority: 2 },
            { name: 'data', test: /node_modules[\/](@tanstack)[\/]/, priority: 1 },
          ],
        },
      },
    },
  },
  server: { proxy: { '/api': 'http://localhost:4000' } },
})
