import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Tailwind v4 is configured entirely in src/index.css via @theme.
// There is deliberately no tailwind.config.js.
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
