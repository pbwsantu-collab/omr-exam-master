import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// For GitHub Pages set base to './'
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
  },
})
