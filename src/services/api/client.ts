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
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);
