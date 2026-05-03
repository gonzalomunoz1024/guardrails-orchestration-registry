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
  const fullUrl = `${config.baseURL}${config.url}`;
  console.log(`[API] ${config.method?.toUpperCase()} ${fullUrl}`, config.data || '');
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
