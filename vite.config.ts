import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Tailwind v4 is configured entirely in src/index.css via @theme.
// There is deliberately no tailwind.config.js.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // Before the general firebase branch, or it is swallowed by it.
          // Messaging is only ever reached through lib/push.ts's dynamic
          // import, and only by a seller who opens their orders page — it has
          // no business in the vendor chunk every visitor downloads first.
          if (id.includes('@firebase/messaging') || id.includes('firebase/messaging')) {
            return 'firebase-messaging'
          }
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase'
          }
          if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) {
            return 'motion'
          }
          if (id.includes('node_modules/react')) return 'react'
          return undefined
        },
      },
    },
  },
})
