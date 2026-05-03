/**
 * Runtime Configuration
 *
 * Reads configuration from window.__RUNTIME_CONFIG__ which is set by /config.js
 * This allows configuration to be changed at runtime without rebuilding.
 */

interface RuntimeConfig {
  API_BASE_URL: string;
}

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

const defaultConfig: RuntimeConfig = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '/api',
};

export function getRuntimeConfig(): RuntimeConfig {
  return {
    ...defaultConfig,
    ...window.__RUNTIME_CONFIG__,
  };
}

export function getApiBaseUrl(): string {
  return getRuntimeConfig().API_BASE_URL;
}
