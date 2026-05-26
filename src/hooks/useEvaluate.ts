import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { evaluationApi } from '@/services/api';
import { usePolicyStore, useEvaluationStore } from '@/store';
import { parseJson, assembleInput } from '@/utils';
import type { GuardrailInfo } from '@/utils';
import type { EvaluationResult } from '@/types';

interface UseEvaluateOptions {
  guardrailInfo?: GuardrailInfo;
}

export function useEvaluate(options: UseEvaluateOptions = {}) {
  const { regoCode, inputJson, configJson, configEnabled, externalDeps, metadata } =
    usePolicyStore();
  const { setResult, setIsEvaluating } = useEvaluationStore();

  const mutation = useMutation({
    mutationFn: async () => {
      const resource = (parseJson(inputJson) || {}) as Record<string, unknown>;
      const configuration = configEnabled
        ? ((parseJson(configJson) || {}) as Record<string, unknown>)
        : undefined;

      const guardrailInfo: GuardrailInfo = {
        id: options.guardrailInfo?.id,
        name: options.guardrailInfo?.name || metadata.name,
        version: options.guardrailInfo?.version || metadata.version,
        enforcementType: options.guardrailInfo?.enforcementType || 'MANDATORY',
      };

      const inputBundle = assembleInput({
        resource,
        configuration,
        externalDeps,
        guardrail: guardrailInfo,
      });

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
