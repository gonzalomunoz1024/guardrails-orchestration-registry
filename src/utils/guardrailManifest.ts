import yaml from 'js-yaml';
import type { ExternalDependency, ExternalParam, PolicyMetadata } from '@/types';
import type { ResourceType } from '@/types/registry.types';
import type { EnforcementType } from '@/types/guardrail.types';

/**
 * Builds the kube-like Guardrail manifest (`guardrails.dev/v1alpha1`) from the
 * authored studio state. This manifest is published alongside `guardrail.rego`
 * and `configuration.json`; the backend reads it to reconstruct the OPA input at
 * enforcement time — looking up configuration and calling external dependencies.
 *
 * It captures authoring INTENT only: no fetched data, client ids, or timestamps.
 * Optional sections (configuration, externalDependencies) are omitted entirely
 * when unused, so a trivial guardrail stays tiny.
 */

export const GUARDRAIL_API_VERSION = 'guardrails.dev/v1alpha1';

export interface GuardrailManifestArgs {
  metadata: PolicyMetadata;
  resourceType: ResourceType;
  resourceKind: string;
  enforcementType: EnforcementType;
  tags: string[];
  configEnabled: boolean;
  externalDeps: ExternalDependency[];
  /** PRECHECK | POSTCHECK — defaults to PRECHECK (the only stage the studio authors today). */
  stage?: 'PRECHECK' | 'POSTCHECK';
  /** Sibling artifact filenames; default to guardrail.rego / configuration.json. */
  policyFile?: string;
  configFile?: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Encode a parameter binding using the readable "source-as-key" form. */
function encodeParam(param: ExternalParam): Record<string, string> {
  switch (param.source) {
    case 'document':
      return { document: param.value };
    case 'configuration':
      return { config: param.value };
    case 'static':
    default:
      return { value: param.value };
  }
}

function encodeDependency(dep: ExternalDependency): Record<string, unknown> {
  const request: Record<string, unknown> = {
    method: dep.method || 'GET',
    path: dep.path,
  };

  const paramEntries = Object.entries(dep.params ?? {});
  if (paramEntries.length > 0) {
    const parameters: Record<string, unknown> = {};
    for (const [name, param] of paramEntries) parameters[name] = encodeParam(param);
    request.parameters = parameters;
  }

  const bodyEntries = Object.entries(dep.body ?? {});
  if (bodyEntries.length > 0) {
    const body: Record<string, unknown> = {};
    for (const [name, param] of bodyEntries) body[name] = encodeParam(param);
    request.body = body;
  }

  return {
    name: dep.name,
    service: dep.serviceId,
    baseUrl: dep.baseUrl,
    spec: dep.specUrl,
    request,
  };
}

export function buildGuardrailManifest(args: GuardrailManifestArgs): Record<string, unknown> {
  const { metadata, resourceType, resourceKind, enforcementType, tags, configEnabled, externalDeps } =
    args;
  const name = slugify(metadata.name || 'untitled-guardrail');

  const meta: Record<string, unknown> = {
    name,
    displayName: metadata.name || 'Untitled guardrail',
    version: metadata.version || '1.0.0',
  };
  if (metadata.description) meta.description = metadata.description;
  if (metadata.author) meta.owner = metadata.author;
  if (tags.length > 0) meta.labels = [...tags];

  const spec: Record<string, unknown> = {
    enforcement: enforcementType,
    stage: args.stage ?? 'PRECHECK',
    target: {
      resourceType: resourceType.toUpperCase(),
      ...(resourceKind ? { resourceKind } : {}),
    },
    policy: {
      file: args.policyFile ?? 'guardrail.rego',
      package: `data.${name.replace(/-/g, '_')}`,
    },
    document: {
      source: 'request',
    },
  };

  if (configEnabled) {
    spec.configuration = {
      file: args.configFile ?? 'configuration.json',
      lookup: { table: 'guardrail_configuration', onMissing: 'fail' },
    };
  }

  const configuredDeps = externalDeps.filter((d) => d.name && d.path);
  if (configuredDeps.length > 0) {
    spec.externalDependencies = configuredDeps.map(encodeDependency);
  }

  return {
    apiVersion: GUARDRAIL_API_VERSION,
    kind: 'Guardrail',
    metadata: meta,
    spec,
  };
}

/** Serialize the manifest to YAML (deterministic key order as constructed). */
export function toGuardrailYaml(args: GuardrailManifestArgs): string {
  return yaml.dump(buildGuardrailManifest(args), {
    lineWidth: 100,
    noRefs: true,
    quotingType: '"',
  });
}

export interface GuardrailConfigurationArgs {
  /** Guardrail display name; slugified for metadata.name (ties config to its guardrail). */
  name: string;
  /** The configuration data merged at input.configuration during evaluation. */
  data: Record<string, unknown>;
}

/**
 * Builds the kube-like GuardrailConfiguration resource — the static configuration
 * a guardrail's policy reads at `input.configuration`. Published as the sibling
 * `configurations/<id>.yaml` and resolved from the configuration table at runtime.
 */
export function buildGuardrailConfiguration(
  args: GuardrailConfigurationArgs
): Record<string, unknown> {
  return {
    apiVersion: GUARDRAIL_API_VERSION,
    kind: 'GuardrailConfiguration',
    metadata: { name: slugify(args.name || 'untitled-guardrail') },
    spec: { data: args.data ?? {} },
  };
}

/** Serialize the GuardrailConfiguration to YAML. */
export function toGuardrailConfigurationYaml(args: GuardrailConfigurationArgs): string {
  return yaml.dump(buildGuardrailConfiguration(args), {
    lineWidth: 100,
    noRefs: true,
    quotingType: '"',
  });
}
