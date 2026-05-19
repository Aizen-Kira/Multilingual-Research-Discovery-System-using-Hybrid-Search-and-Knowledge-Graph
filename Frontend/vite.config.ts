import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          graph: ['reactflow', 'graphology', 'graphology-communities-louvain', 'd3-force', 'dagre'],
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          supabase: ['@supabase/supabase-js'],
          motion: ['framer-motion'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
