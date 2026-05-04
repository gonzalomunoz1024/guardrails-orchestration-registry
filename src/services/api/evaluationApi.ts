import { apiClient } from './client';
import type { EvaluateResponse } from '@/types';

/**
 * OPA Evaluation API
 *
 * Uses backend passthrough endpoint for policy evaluation.
 * Backend proxies requests to OPA server.
 */
export const evaluationApi = {
  /**
   * Evaluate a policy with given input
   * Uses backend passthrough: POST /v1/opa/evaluate
   * Input should contain: guardrail, configuration, resource
   */
  evaluate: async (
    policy: string,
    input: Record<string, unknown>
  ): Promise<EvaluateResponse> => {
    const response = await apiClient.post<{ result: unknown; metrics?: object }>(
      '/v1/opa/evaluate',
      {
        policy,
        input,
      }
    );

    return {
      result: response.data.result,
    };
  },

  /**
   * Validate policy syntax without evaluation
   * Uses backend passthrough: POST /v1/opa/validate
   */
  validatePolicy: async (
    policy: string
  ): Promise<{ valid: boolean; errors?: string[] }> => {
    try {
      const response = await apiClient.post<{ valid: boolean; errors?: Array<{ message: string }> }>(
        '/v1/opa/validate',
        { policy }
      );

      if (response.data.valid) {
        return { valid: true };
      }

      return {
        valid: false,
        errors: response.data.errors?.map(e => e.message) || ['Invalid policy'],
      };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return {
        valid: false,
        errors: [err.response?.data?.message || 'Validation failed'],
      };
    }
  },
};
