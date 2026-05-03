export interface EvaluateRequest {
  policy: string;
  input: Record<string, unknown>;
  data?: Record<string, unknown>;
}

export interface EvaluationMetrics {
  timer_rego_query_eval_ns: number;
  timer_rego_query_compile_ns: number;
}

export interface EvaluateResponse {
  result: unknown;
  decision_id?: string;
  metrics?: EvaluationMetrics;
}

export interface EvaluationResult {
  success: boolean;
  result?: unknown;
  error?: string;
  executionTime?: number;
}
