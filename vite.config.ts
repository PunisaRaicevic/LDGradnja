import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    base: '/',
    plugins: [react(), tailwindcss()],
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
