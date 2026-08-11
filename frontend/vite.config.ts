import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const backendPort = env.BACKEND_PORT || '8081'

  return {
    // Expose only the existing public values needed by the frontend.
    // KAKAO_REST_API_KEY remains backend-only.
    define: {
      'import.meta.env.GOOGLE_CLIENT_ID': JSON.stringify(env.GOOGLE_CLIENT_ID ?? ''),
      'import.meta.env.BACKEND_PORT': JSON.stringify(env.BACKEND_PORT ?? ''),
    },
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
