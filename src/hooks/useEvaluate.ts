import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { evaluationApi } from '@/services/api';
import { usePolicyStore, useEvaluationStore } from '@/store';
import { parseJson } from '@/utils';
import type { EvaluationResult } from '@/types';

export function useEvaluate() {
  const { regoCode, inputJson, configJson } = usePolicyStore();
  const { setResult, setIsEvaluating } = useEvaluationStore();

  const mutation = useMutation({
    mutationFn: async () => {
      const input = parseJson(inputJson);
      const data = parseJson(configJson);

      if (input === null) {
        throw new Error('Invalid input JSON');
      }

      const startTime = performance.now();
      const response = await evaluationApi.evaluate(
        regoCode,
        input,
        data || undefined
      );
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
