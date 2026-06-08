/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';

// Dev-only middleware: fetch an arbitrary external URL server-side so the
// browser sidesteps CORS on hosts that don't advertise our origin (e.g. the
// OpenShift swagger routes the API Explorer points at). Production needs an
// equivalent proxy on whatever serves the built app (see serve.cjs).
//
// Method, content-type, and body are forwarded so the same path serves both
// the spec load (GET /openapi.json) and the Execute button's runtime calls
// (POST/PUT with JSON bodies).
const externalProxyPlugin = {
  name: 'external-url-proxy',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use('/__external', async (req, res) => {
      try {
        const target = new URL(req.url ?? '', 'http://localhost').searchParams.get('url');
        if (!target) {
          res.statusCode = 400;
          res.end('Missing url parameter');
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req as unknown as AsyncIterable<Buffer>) {
          chunks.push(chunk);
        }
        const requestBody = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
        const fetchHeaders: Record<string, string> = {
          Accept: String(req.headers.accept ?? 'application/json'),
        };
        if (req.headers['content-type']) {
          fetchHeaders['Content-Type'] = String(req.headers['content-type']);
        }
        const upstream = await fetch(target, {
          method: req.method,
          headers: fetchHeaders,
          body: requestBody,
        });
        res.statusCode = upstream.status;
        upstream.headers.forEach((value, key) => {
          // content-encoding is stripped because Node's fetch already decoded the body.
          if (key.toLowerCase() !== 'content-encoding') res.setHeader(key, value);
        });
        const body = Buffer.from(await upstream.arrayBuffer());
        res.end(body);
      } catch (err) {
        res.statusCode = 502;
        res.end(`Upstream fetch failed: ${(err as Error).message}`);
      }
    });
  },
};

export default defineConfig({
  plugins: [tailwindcss(), react(), externalProxyPlugin],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      // Backend API — all endpoints live under /v1/utilities/...
      '/v1': {
        target: 'http://localhost:8080',
        changeOrigin: true,
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
