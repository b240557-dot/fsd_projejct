import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiProxy = {
  target: "http://127.0.0.1:8000",
  changeOrigin: true,
  bypass: (request) => {
    if (request.method === "GET" && request.headers.accept?.includes("text/html")) {
      return request.url
    }
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": apiProxy,
      "/signup": apiProxy,
      "/login": apiProxy,
      "/logout": apiProxy,
      "/me": apiProxy,
      "/interviews": apiProxy,
      "/health": apiProxy,
    },
  },
})
