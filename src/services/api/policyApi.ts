import { apiClient } from './client';
import type { Policy, PolicyValidationResult } from '@/types';

export const policyApi = {
  getAll: async (): Promise<Policy[]> => {
    const response = await apiClient.get<Policy[]>('/v1/utilities/policies');
    return response.data;
  },

  getById: async (id: string): Promise<Policy> => {
    const response = await apiClient.get<Policy>(`/v1/utilities/policies/${id}`);
    return response.data;
  },

  create: async (policy: Omit<Policy, 'id'>): Promise<Policy> => {
    const response = await apiClient.post<Policy>('/v1/utilities/policies', policy);
    return response.data;
  },

  update: async (id: string, policy: Partial<Policy>): Promise<Policy> => {
    const response = await apiClient.put<Policy>(`/v1/utilities/policies/${id}`, policy);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/v1/utilities/policies/${id}`);
  },

  validate: async (code: string): Promise<PolicyValidationResult> => {
    const response = await apiClient.post<PolicyValidationResult>(
      '/v1/utilities/policies/validate',
      { code }
    );
    return response.data;
  },
};
