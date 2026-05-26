import { useEffect, useMemo } from 'react';
import { usePolicyStore } from '@/store';
import { setRegoInputShape } from '@/monaco/config';
import { parseJson, assembleInput } from '@/utils';
import type { GuardrailInfo } from '@/utils';

/**
 * Computes the merged OPA input shape (document + configuration + external
 * dependency data + guardrail metadata) and feeds it to the Rego autocomplete
 * provider. Returns the assembled object so callers can also render a preview.
 */
export function useInputShape(guardrail: GuardrailInfo = {}) {
  const { inputJson, configJson, configEnabled, externalDeps } = usePolicyStore();

  const shape = useMemo(() => {
    const resource = (parseJson(inputJson) || {}) as Record<string, unknown>;
    const configuration = configEnabled
      ? ((parseJson(configJson) || {}) as Record<string, unknown>)
      : undefined;
    return assembleInput({ resource, configuration, externalDeps, guardrail });
    // guardrail is a fresh object each render; spread its primitives as deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    inputJson,
    configJson,
    configEnabled,
    externalDeps,
    guardrail.id,
    guardrail.name,
    guardrail.version,
    guardrail.enforcementType,
  ]);

  useEffect(() => {
    setRegoInputShape(shape);
  }, [shape]);

  return shape;
}
