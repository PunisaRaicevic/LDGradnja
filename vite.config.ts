import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    base: '/',
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          // Split only PURE (non-React) libs into their own chunks so no single
          // chunk approaches ~1 MB — Appflow Live Update truncates oversized
          // chunks and the APK boots to a white screen. React and everything
          // that imports it (incl. react-pdf) MUST stay in one chunk.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/xlsx/')) return 'vendor-xlsx';
            if (id.includes('/jspdf') || id.includes('jspdf-autotable')) return 'vendor-jspdf';
            if (id.includes('/pdfjs-dist/')) return 'vendor-pdfjs';
            if (id.includes('/dxf-parser/')) return 'vendor-dxf';
            return 'vendor'; // react + all React consumers together
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api/gemini': {
          target: 'https://generativelanguage.googleapis.com/v1beta/openai',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/gemini/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              const apiKey = env.VITE_GEMINI_API_KEY
              if (apiKey) {
                proxyReq.setHeader('Authorization', `Bearer ${apiKey}`)
              }
            })
          },
        },
      },
    },
  }
})
