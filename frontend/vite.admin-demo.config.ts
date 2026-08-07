import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  plugins: [react()],
  build: {
    outDir: 'admin-demo-build',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: 'src/admin-demo-main.tsx',
      name: 'GenMarkAdminDemo',
      formats: ['iife'],
      fileName: () => 'admin-demo.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: 'admin-demo.[ext]',
        inlineDynamicImports: true,
      },
    },
  },
})
