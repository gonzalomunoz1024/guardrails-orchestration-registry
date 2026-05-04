/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // Don't rewrite - backend expects /api prefix
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // req.url has the full path with query string
            console.log('[PROXY] req.url:', req.url);
            console.log('[PROXY] proxyReq.path:', proxyReq.path);
            console.log('[PROXY] Forwarding to:', `http://localhost:8080${req.url}`);
          });
        },
      },
    },
  },
  build: {
    outDir: 'build',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.tsx',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/'],
    },
  },
});
