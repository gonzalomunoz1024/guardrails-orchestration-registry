/**
 * Runtime Configuration
 *
 * Priority order:
 * 1. VITE_API_BASE_URL env var (for development)
 * 2. window.__RUNTIME_CONFIG__ (for production, set by serve.cjs)
 * 3. Default '' (empty — all endpoints are absolute paths under /v1/utilities)
 */

interface RuntimeConfig {
  API_BASE_URL: string;
}

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

export function getRuntimeConfig(): RuntimeConfig {
  // In development, prefer VITE env vars
  const envApiUrl = import.meta.env.VITE_API_BASE_URL;
  if (envApiUrl) {
    return { API_BASE_URL: envApiUrl };
  }

  // In production, use runtime config from serve.cjs
  if (window.__RUNTIME_CONFIG__?.API_BASE_URL) {
    return { API_BASE_URL: window.__RUNTIME_CONFIG__.API_BASE_URL };
  }

  // Fallback
  return { API_BASE_URL: '' };
}

export function getApiBaseUrl(): string {
  return getRuntimeConfig().API_BASE_URL;
}
