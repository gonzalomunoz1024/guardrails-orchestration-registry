import axios from 'axios';
import { getApiBaseUrl } from '@/utils/runtimeConfig';

export const apiClient = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Set baseURL dynamically on each request to support runtime configuration
apiClient.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Surface as much context as we have so a console line is actually
    // triageable: HTTP method, full path, status (or "no response"), and
    // either the body or the axios message. Without these, a generic
    // "Network Error" tells the user nothing.
    const cfg = error?.config ?? {};
    const method = (cfg.method || 'GET').toUpperCase();
    const url = `${cfg.baseURL ?? ''}${cfg.url ?? ''}`;
    const status = error?.response?.status ?? 'no response';
    const detail = error?.response?.data ?? error?.message ?? error;
    console.error(`[API Error] ${method} ${url} → ${status}`, detail);
    return Promise.reject(error);
  }
);
