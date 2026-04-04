import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'electron/shared'),
    },
  },
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5176,
  },
})
