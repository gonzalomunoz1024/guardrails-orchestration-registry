#!/usr/bin/env node
/**
 * OPA Policy Registry Server
 *
 * Single server that handles:
 * - Static file serving for the React frontend
 * - Runtime configuration via command line flags
 *
 * Zero external dependencies - uses only Node.js built-ins.
 *
 * Usage:
 *   node serve.cjs --api-url http://localhost:8181/api --port 3000
 *
 * Options:
 *   --api-url, -a   Backend API base URL (default: /api)
 *   --port, -p      Port to serve on (default: 3000)
 *   --help, -h      Show help
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * Proxy requests to backend API (bypasses CORS)
 */
function proxyToBackend(backendUrl, targetPath, req, res) {
  const url = new URL(backendUrl);
  const isHttps = url.protocol === 'https:';
  const httpModule = isHttps ? https : http;

  // Combine backend base path with target path
  // e.g., backendUrl = "http://localhost:8080/api", targetPath = "/v1/policies"
  // result = "/api/v1/policies"
  const basePath = url.pathname.replace(/\/$/, ''); // Remove trailing slash
  const fullPath = basePath + targetPath;

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: fullPath,
      method: req.method,
      headers: {
        ...req.headers,
        host: url.hostname,
      },
      rejectUnauthorized: false,
    };

    // Remove content-length for GET/DELETE, set for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && body) {
      options.headers['content-length'] = Buffer.byteLength(body);
    } else {
      delete options.headers['content-length'];
    }

    console.log(`[Proxy] ${req.method} ${url.origin}${fullPath}`);

    const proxyReq = httpModule.request(options, (proxyRes) => {
      let data = '';
      proxyRes.on('data', chunk => { data += chunk; });
      proxyRes.on('end', () => {
        const headers = {
          ...proxyRes.headers,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };
        res.writeHead(proxyRes.statusCode, headers);
        res.end(data);
      });
    });

    proxyReq.on('error', (err) => {
      console.error('[Proxy] Error:', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
    });

    if (body) {
      proxyReq.write(body);
    }
    proxyReq.end();
  });
}

/**
 * Proxy POST requests to GitHub API (bypasses CORS)
 */
function proxyToGitHub(githubPath, req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const options = {
      hostname: 'github.com',
      port: 443,
      path: githubPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      // Skip certificate validation (needed for corporate proxies/firewalls)
      rejectUnauthorized: false,
    };

    const proxyReq = https.request(options, (proxyRes) => {
      let data = '';
      proxyRes.on('data', chunk => { data += chunk; });
      proxyRes.on('end', () => {
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(data);
      });
    });

    proxyReq.on('error', (err) => {
      console.error('GitHub proxy error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
    });

    proxyReq.write(body);
    proxyReq.end();
  });
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    apiUrl: process.env.API_BASE_URL || '/api',
    port: parseInt(process.env.PORT, 10) || 3000,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === '--help' || arg === '-h') {
      console.log(`
OPA Policy Registry Server

Usage:
  node serve.cjs [options]

Options:
  --api-url, -a <url>   Backend API base URL (default: /api)
  --port, -p <port>     Port to serve on (default: 3000)

Environment Variables:
  API_BASE_URL          Same as --api-url
  PORT                  Same as --port

Examples:
  node serve.cjs --api-url http://localhost:8181/api
  node serve.cjs -a http://backend:8181/api -p 8080
`);
      process.exit(0);
    }

    if (arg === '--api-url' || arg === '-a') {
      config.apiUrl = next;
      i++;
    } else if (arg === '--port' || arg === '-p') {
      config.port = parseInt(next, 10);
      i++;
    }
  }

  return config;
}

// MIME types for static files
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

function main() {
  const config = parseArgs();
  const buildPath = path.join(__dirname, 'build');

  // Check if build folder exists
  if (!fs.existsSync(buildPath)) {
    console.error('Error: build/ folder not found. Run "npm run build" first.');
    process.exit(1);
  }

  // Generate runtime config
  // When proxying (apiUrl is a full URL), frontend uses /api and we proxy to backend
  const frontendApiUrl = config.apiUrl.startsWith('http') ? '/api' : config.apiUrl;
  const runtimeConfig = `// Runtime configuration - generated by serve.cjs
window.__RUNTIME_CONFIG__ = ${JSON.stringify({ API_BASE_URL: frontendApiUrl }, null, 2)};
`;

  const server = http.createServer((req, res) => {
    const urlPath = req.url.split('?')[0];

    // Handle CORS preflight for GitHub proxy endpoints
    if (req.method === 'OPTIONS' && urlPath.startsWith('/auth/github/')) {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    // GitHub Device Flow proxy: request device code
    if (req.method === 'POST' && urlPath === '/auth/github/device/code') {
      proxyToGitHub('/login/device/code', req, res);
      return;
    }

    // GitHub Device Flow proxy: poll for access token
    if (req.method === 'POST' && urlPath === '/auth/github/oauth/access_token') {
      proxyToGitHub('/login/oauth/access_token', req, res);
      return;
    }

    // Handle CORS preflight for API proxy
    if (req.method === 'OPTIONS' && urlPath.startsWith('/api/')) {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      res.end();
      return;
    }

    // Proxy API requests to backend (when apiUrl is a full URL)
    if (urlPath.startsWith('/api/') && config.apiUrl.startsWith('http')) {
      // Strip /api prefix and forward to backend, preserving query string
      const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
      const targetPath = urlPath.replace(/^\/api/, '') + queryString;
      proxyToBackend(config.apiUrl, targetPath, req, res);
      return;
    }

    // Health check endpoint (local)
    if (urlPath === '/api/health' && !config.apiUrl.startsWith('http')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', apiUrl: config.apiUrl }));
      return;
    }

    // Serve dynamic config.js with runtime values
    if (urlPath === '/config.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(runtimeConfig);
      return;
    }

    // Static file serving
    let filePath = path.join(buildPath, urlPath);

    // Default to index.html for SPA routing
    if (urlPath === '/' || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      const hasExtension = path.extname(urlPath) !== '';
      if (!hasExtension || urlPath === '/') {
        filePath = path.join(buildPath, 'index.html');
      }
    }

    // Serve file
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      const mimeType = getMimeType(filePath);
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(data);
    });
  });

  server.listen(config.port, () => {
    const proxyMode = config.apiUrl.startsWith('http');
    console.log(`
┌──────────────────────────────────────────────────────────────┐
│  OPA Policy Registry                                         │
├──────────────────────────────────────────────────────────────┤
│  Server:    http://localhost:${String(config.port).padEnd(30)}│
│  Backend:   ${config.apiUrl.padEnd(48)}│
│  Proxying:  ${proxyMode ? 'Yes (/api/* → backend)' : 'No'}${proxyMode ? ''.padEnd(26) : ''.padEnd(40)}│
└──────────────────────────────────────────────────────────────┘
`);
  });
}

main();
