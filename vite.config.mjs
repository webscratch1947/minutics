import { defineConfig } from 'vite'

export default defineConfig({
  root: 'app',
  // The Cognito SDK (amazon-cognito-identity-js) is CommonJS and references
  // Node's `global`, which browsers don't have — map it to globalThis at
  // build time instead of shipping a polyfill hack.
  define: {
    global: 'globalThis',
  },
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
