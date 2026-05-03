export interface Datasource {
  id: string;
  name: string;
  type: 'api' | 'database' | 'file' | 'custom';
  description?: string;
  schema?: Record<string, unknown>;
  endpoint?: string;
}

export interface DatasourceValue {
  id: string;
  datasourceId: string;
  data: Record<string, unknown>;
  fetchedAt: string;
}
