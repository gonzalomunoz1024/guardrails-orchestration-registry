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
  // Build full URL with query params for logging
  const paramsObj = config.params || {};
  const paramKeys = Object.keys(paramsObj);
  const queryString = paramKeys.length > 0
    ? '?' + paramKeys.map(k => `${k}=${encodeURIComponent(paramsObj[k])}`).join('&')
    : '';
  const fullUrl = `${config.baseURL}${config.url}${queryString}`;
  console.log(`[AXIOS REQUEST] ${config.method?.toUpperCase()} ${fullUrl}`);
  console.log(`[AXIOS REQUEST] params object:`, paramsObj);
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API] ✓ ${response.status} ${response.config.url}`, response.data);
    return response;
  },
  (error) => {
    const fullUrl = `${error.config?.baseURL}${error.config?.url}`;
    console.error(`[API] ✗ ${error.response?.status || 'ERR'} ${fullUrl}`, error.response?.data || error.message);
    return Promise.reject(error);
  }
);
