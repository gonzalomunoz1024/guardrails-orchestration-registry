import { apiClient } from './client';
import type { Datasource, DatasourceValue } from '@/types';

export const datasourceApi = {
  getAll: async (): Promise<Datasource[]> => {
    const response = await apiClient.get<Datasource[]>('/v1/datasources');
    return response.data;
  },

  getById: async (id: string): Promise<Datasource> => {
    const response = await apiClient.get<Datasource>(`/v1/datasources/${id}`);
    return response.data;
  },

  getValue: async (id: string): Promise<DatasourceValue> => {
    const response = await apiClient.get<DatasourceValue>(
      `/v1/datasources/${id}/value`
    );
    return response.data;
  },
};
