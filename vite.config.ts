import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Vendor code changes far less often than the app, so it gets its own
        // long-cached chunks: a storefront deploy doesn't re-download React or
        // the Supabase client.
        manualChunks(id) {
          if (id.includes('node_modules/@supabase/')) return 'supabase'
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
        },
      },
    },
  },
})
