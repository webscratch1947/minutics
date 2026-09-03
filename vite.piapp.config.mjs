import { defineConfig } from 'vite'

export default defineConfig({
  root: 'piapp',
  // Output to app/dist/piapp so the same Vercel output directory serves
  // both app.minutics.com (via /app/) and piapp.minutics.com (via /piapp/).
  build: {
    outDir: '../app/dist/piapp',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    open: false
  }
})
