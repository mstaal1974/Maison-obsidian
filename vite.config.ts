import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Google Search Console's HTML-tag verification: set GOOGLE_SITE_VERIFICATION
// to the token from the tag Search Console gives you (the content="…" value)
// and it is written into every page's <head> at build time, including the
// prerendered fragrance pages. Unset, nothing is added. (A Domain property
// verified by DNS record needs none of this.)
function siteVerification(token: string): Plugin {
  return {
    name: 'mo-site-verification',
    transformIndexHtml() {
      if (!/^[\w-]{10,100}$/.test(token)) return []
      return [{ tag: 'meta', attrs: { name: 'google-site-verification', content: token }, injectTo: 'head' }]
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  return {
    plugins: [react(), siteVerification(String(env.GOOGLE_SITE_VERIFICATION ?? '').trim())],
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
  }
})
