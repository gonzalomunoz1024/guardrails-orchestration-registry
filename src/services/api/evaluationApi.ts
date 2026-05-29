import { apiClient } from './client';
import { formatOpaError } from '@/utils/regoError';
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
   * Uses backend passthrough: POST /v1/utilities/opa/evaluate
   * Input should contain: guardrail, configuration, resource
   */
  evaluate: async (
    policy: string,
    input: Record<string, unknown>
  ): Promise<EvaluateResponse> => {
    try {
      const response = await apiClient.post<{ result: unknown; metrics?: object }>(
        '/v1/utilities/opa/evaluate',
        {
          policy,
          input,
        }
      );

      return {
        result: response.data.result,
      };
    } catch (error: unknown) {
      // Surface the actual OPA error (with its source location) instead of the
      // generic Axios "Request failed with status code …" message.
      const data = (error as { response?: { data?: unknown } }).response?.data;
      const formatted = formatOpaError(data);
      if (formatted) throw new Error(formatted);
      throw error;
    }
  },

  /**
   * Validate policy syntax without evaluation
   * Uses backend passthrough: POST /v1/utilities/opa/validate
   */
  validatePolicy: async (
    policy: string
  ): Promise<{ valid: boolean; errors?: string[] }> => {
    try {
      const response = await apiClient.post<{ valid: boolean; errors?: Array<{ message: string }> }>(
        '/v1/utilities/opa/validate',
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
