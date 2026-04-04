import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'electron/shared'),
    },
  },
  test: {
    include: ['electron/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'dist-electron'],
    environment: 'node',
  },
})
