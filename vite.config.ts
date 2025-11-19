import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
    strictPort: false,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "escap-tools.thinkbluedata.org",
      "172.19.0.2"
    ]
    // Removed proxy - using direct API calls from frontend instead
  }
});
