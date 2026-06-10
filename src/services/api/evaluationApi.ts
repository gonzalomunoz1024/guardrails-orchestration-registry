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
   *
   * IMPORTANT: a `{ valid: false }` return value MUST mean "the validator
   * received the policy and judged it invalid". Transport / 5xx / network
   * failures throw instead, so callers (and React Query) can distinguish
   * "the validator said no" from "we couldn't reach the validator". The
   * previous implementation swallowed every thrown error into a fake
   * `{ valid: false, errors: ['Validation failed'] }`, which TanStack then
   * cached as legitimate-but-invalid data — a transient backend blip got
   * stuck in the cache and the submit modal stayed in the "Submission
   * blocked" state even after the user fixed the Rego.
   */
  validatePolicy: async (
    policy: string
  ): Promise<{ valid: boolean; errors?: string[] }> => {
    let response;
    try {
      response = await apiClient.post<{ valid: boolean; errors?: Array<{ message: string }> }>(
        '/v1/utilities/opa/validate',
        { policy }
      );
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      throw new Error(
        err.response?.data?.message ||
          err.message ||
          'Could not reach the OPA validator'
      );
    }

    if (response.data.valid) {
      return { valid: true };
    }

    return {
      valid: false,
      errors: response.data.errors?.map((e) => e.message) || ['Invalid policy'],
    };
  },
};
