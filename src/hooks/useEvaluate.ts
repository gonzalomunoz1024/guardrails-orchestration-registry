import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { evaluationApi } from '@/services/api';
import { usePolicyStore, useEvaluationStore } from '@/store';
import { parseJson } from '@/utils';
import type { EvaluationResult } from '@/types';

interface GuardrailInfo {
  id?: string;
  name?: string;
  version?: string;
  enforcementType?: string;
}

/**
 * Build the inputBundle for OPA evaluation
 * Merges user input with guardrail metadata and configuration
 */
function buildInputBundle(
  userInput: Record<string, unknown>,
  configuration: Record<string, unknown>,
  guardrailInfo: GuardrailInfo
): Record<string, unknown> {
  return {
    ...userInput,
    guardrail: {
      id: guardrailInfo.id || 'test-policy',
      name: guardrailInfo.name || 'Test Policy',
      version: guardrailInfo.version || '1.0.0',
      enforcementType: guardrailInfo.enforcementType || 'MANDATORY',
    },
    configuration: configuration,
  };
}

interface UseEvaluateOptions {
  guardrailInfo?: GuardrailInfo;
}

export function useEvaluate(options: UseEvaluateOptions = {}) {
  const { regoCode, inputJson, configJson, metadata } = usePolicyStore();
  const { setResult, setIsEvaluating } = useEvaluationStore();

  const mutation = useMutation({
    mutationFn: async () => {
      const resource = parseJson(inputJson) || {};
      const configuration = parseJson(configJson) || {};

      // Build the inputBundle with guardrail info, configuration, and resource
      const guardrailInfo: GuardrailInfo = {
        id: options.guardrailInfo?.id,
        name: options.guardrailInfo?.name || metadata.name,
        version: options.guardrailInfo?.version || metadata.version,
        enforcementType: options.guardrailInfo?.enforcementType || 'MANDATORY',
      };

      const inputBundle = buildInputBundle(resource, configuration, guardrailInfo);

      const startTime = performance.now();
      const response = await evaluationApi.evaluate(regoCode, inputBundle);
      const executionTime = performance.now() - startTime;

      return {
        success: true,
        result: response.result,
        executionTime,
      } as EvaluationResult;
    },
    onMutate: () => {
      setIsEvaluating(true);
    },
    onSuccess: (result) => {
      setResult(result);
      setIsEvaluating(false);
    },
    onError: (error: Error) => {
      setResult({
        success: false,
        error: error.message,
      });
      setIsEvaluating(false);
    },
  });

  const evaluate = useCallback(() => {
    mutation.mutate();
  }, [mutation]);

  return {
    evaluate,
    isEvaluating: mutation.isPending,
    error: mutation.error,
  };
}
