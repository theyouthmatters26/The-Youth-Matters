import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Read the shared .env at the project root. Only VITE_ variables reach the browser.
  envDir: '..',
  server: {
    // Flask runs on :5000 in development
    proxy: { '/api': 'http://localhost:5000', '/socket.io': { target: 'http://localhost:5000', ws: true } },
  },
})
