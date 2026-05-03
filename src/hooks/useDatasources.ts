import { useQuery } from '@tanstack/react-query';
import { datasourceApi } from '@/services/api';

export function useDatasources() {
  return useQuery({
    queryKey: ['datasources'],
    queryFn: datasourceApi.getAll,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDatasource(id: string) {
  return useQuery({
    queryKey: ['datasource', id],
    queryFn: () => datasourceApi.getById(id),
    enabled: !!id,
  });
}

export function useDatasourceValue(id: string) {
  return useQuery({
    queryKey: ['datasource-value', id],
    queryFn: () => datasourceApi.getValue(id),
    enabled: !!id,
  });
}
