import type { ExternalDependency } from '@/types';

export interface GuardrailInfo {
  id?: string;
  name?: string;
  version?: string;
  enforcementType?: string;
}

export interface AssembleInputArgs {
  /** The document being evaluated (parsed input JSON). */
  resource: Record<string, unknown>;
  /** Static configuration (parsed config JSON), or undefined when disabled. */
  configuration?: Record<string, unknown>;
  /** Configured external dependencies. */
  externalDeps?: ExternalDependency[];
  guardrail: GuardrailInfo;
}

/**
 * Assemble the OPA evaluation input from its three sources — the document,
 * static configuration, and dynamic external dependencies — plus guardrail
 * metadata. This is the single source of truth for the input shape, shared by
 * evaluation, the combined-input preview, and the Rego autocomplete.
 *
 * Shape:
 *   { ...resource, guardrail, configuration, external: { <name>: <data> } }
 */
export function assembleInput({
  resource,
  configuration,
  externalDeps = [],
  guardrail,
}: AssembleInputArgs): Record<string, unknown> {
  const external: Record<string, unknown> = {};
  for (const dep of externalDeps) {
    if (dep.name) external[dep.name] = dep.data ?? null;
  }

  const bundle: Record<string, unknown> = {
    ...resource,
    guardrail: {
      id: guardrail.id || 'test-policy',
      name: guardrail.name || 'Test Policy',
      version: guardrail.version || '1.0.0',
      enforcementType: guardrail.enforcementType || 'MANDATORY',
    },
  };

  if (configuration !== undefined) {
    bundle.configuration = configuration;
  }
  if (externalDeps.length > 0) {
    bundle.external = external;
  }

  return bundle;
}
