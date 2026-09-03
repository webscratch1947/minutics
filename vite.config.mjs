import { defineConfig } from 'vite'

export default defineConfig({
  root: 'app',
  // Output nested under dist/app (i.e. app/dist/app) so the built SPA can
  // live alongside the marketing site's static files, which are copied to
  // app/dist/ by scripts/postbuild.mjs. middleware.js rewrites
  // app.minutics.com requests to this "/app" subpath.
  build: {
    outDir: 'dist/app',
  },
  server: {
    port: 5173,
    open: false
  }
})
