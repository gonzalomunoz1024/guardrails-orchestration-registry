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
   * Validate a Rego policy by piggybacking on /evaluate. There is no
   * dedicated `/v1/utilities/opa/validate` endpoint on the backend (an
   * earlier version of this code assumed one and 404'd every time, which
   * made the submit modal show a stuck "Submission blocked" banner).
   *
   * OPA parses and compiles the policy before evaluating, so a successful
   * evaluate response means the rego is syntactically and type-correct.
   * A response containing OPA's structured error body (formatOpaError
   * recognizes the shape) means the rego itself is bad — return
   * `{ valid: false }` with the formatted message. Anything else
   * (transport failure, 5xx with non-OPA body, etc.) throws so React
   * Query treats it as `isError` instead of caching a fake invalid
   * verdict that survives until the user changes the rego text.
   */
  validatePolicy: async (
    policy: string,
    input: Record<string, unknown> = {}
  ): Promise<{ valid: boolean; errors?: string[] }> => {
    try {
      await apiClient.post('/v1/utilities/opa/evaluate', { policy, input });
      return { valid: true };
    } catch (error: unknown) {
      const data = (error as { response?: { data?: unknown } }).response?.data;
      const formatted = formatOpaError(data);
      if (formatted) {
        return { valid: false, errors: [formatted] };
      }
      const err = error as { message?: string };
      throw new Error(err.message || 'Could not reach the OPA evaluator');
    }
  },
};
