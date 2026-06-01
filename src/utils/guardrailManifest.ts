import yaml from 'js-yaml';
import { VAULT_ADDRESS, CUSTOM_SERVICE_ID } from '@/services/external/externalServices';
import type { ExternalDependency, ExternalParam, PolicyMetadata } from '@/types';
import type { EnforcementType, Stage, ResourceKind } from '@/types/guardrail.types';

export interface ManifestInputSchema {
  file: string;
  /** Parsed JSON Schema body — embedded into spec.inputSchema.content. */
  content?: Record<string, unknown>;
  examples: string[];
}

export interface ManifestConfiguration {
  /** Path of the sibling configuration artifact (relative to the version dir). */
  file?: string;
  /** Parsed configuration data — embedded into spec.configuration.content. */
  content?: Record<string, unknown>;
}

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
  resourceKind: ResourceKind;
  enforcementType: EnforcementType;
  stage: Stage;
  status?: string;
  tags: string[];
  configEnabled: boolean;
  externalDeps: ExternalDependency[];
  /** Sibling artifact filenames; default to policy.rego / configuration.yaml. */
  policyFile?: string;
  configFile?: string;
  /** Published input schema contract reference. */
  inputSchema?: ManifestInputSchema;
  /**
   * Configuration override — when present, the parsed `content` is embedded
   * into spec.configuration.content so a POST /registry/manifests also upserts
   * the configurations collection server-side.
   */
  configuration?: ManifestConfiguration;
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

  // Undeclared query keys — emitted as an ordered array so duplicate keys
  // are preservable and the orchestrator can append them verbatim. Keyed
  // separately from `parameters` so the backend knows these are dynamic
  // filters, not spec-declared params with an `in` field to consult.
  const extras = (dep.extraQueryParams ?? []).filter((e) => e.name.trim());
  if (extras.length > 0) {
    request.extraQueryParameters = extras.map((e) => ({
      name: e.name.trim(),
      ...encodeParam(e.param),
    }));
  }

  const bodyEntries = Object.entries(dep.body ?? {});
  if (bodyEntries.length > 0) {
    const body: Record<string, unknown> = {};
    for (const [name, param] of bodyEntries) body[name] = encodeParam(param);
    request.body = body;
  }

  const result: Record<string, unknown> = {
    name: dep.name,
    service: dep.serviceId,
    baseUrl: dep.baseUrl,
    spec: dep.specUrl,
    request,
  };

  // Vault-backed auth applies only to custom services (registered ones are
  // pre-integrated). The credentials are resolved from Vault at runtime.
  if (dep.auth && dep.serviceId === CUSTOM_SERVICE_ID) {
    result.auth = {
      type: 'vault',
      vault: {
        address: VAULT_ADDRESS,
        secretPath: dep.auth.secretPath,
        usernameKey: dep.auth.usernameKey,
        passwordKey: dep.auth.passwordKey,
      },
    };
  }

  return result;
}

export function buildGuardrailManifest(args: GuardrailManifestArgs): Record<string, unknown> {
  const { metadata, resourceKind, enforcementType, stage, tags, configEnabled, externalDeps } =
    args;
  const name = slugify(metadata.name || 'untitled-guardrail');

  const meta: Record<string, unknown> = {
    name,
    displayName: metadata.name || 'Untitled guardrail',
    version: metadata.version || '1.0',
  };
  if (metadata.description) meta.description = metadata.description;
  if (metadata.author) meta.owner = metadata.author;
  if (tags.length > 0) meta.labels = [...tags];

  const spec: Record<string, unknown> = {
    enforcement: enforcementType,
    stage,
    ...(args.status ? { status: args.status } : {}),
    target: {
      resourceKind,
    },
    policy: {
      file: args.policyFile ?? 'policy.rego',
      package: `data.${name.replace(/-/g, '_')}`,
    },
    document: {
      source: 'request',
    },
  };

  if (args.inputSchema) {
    spec.inputSchema = {
      file: args.inputSchema.file,
      // Embedding the JSON Schema body is part of the declarative contract —
      // the registry stores spec.inputSchema.content on every manifest write.
      ...(args.inputSchema.content ? { content: args.inputSchema.content } : {}),
      ...(args.inputSchema.examples.length > 0 ? { examples: args.inputSchema.examples } : {}),
    };
  }

  if (configEnabled) {
    spec.configuration = {
      file: args.configuration?.file ?? args.configFile ?? 'configuration.yaml',
      // Backend's MongoLookupTableAdapter reads from this collection name.
      lookup: { table: 'guardrail_configurations', onMissing: 'fail' },
      filter: { byResourceKind: false },
      // Embedding `content` causes POST /manifests to also upsert the
      // configurations collection keyed by {name}@{version}.
      ...(args.configuration?.content ? { content: args.configuration.content } : {}),
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

/**
 * Serialize the static configuration to YAML, as published in the sibling
 * `configuration.yaml` artifact and merged at `input.configuration` during
 * evaluation. This is the raw data the policy reads — no apiVersion / kind /
 * metadata / spec wrapping. The backend's manifest record stores the same
 * shape under spec.configuration.content; the file on disk mirrors it.
 */
export function toGuardrailConfigurationYaml(data: Record<string, unknown>): string {
  return yaml.dump(data ?? {}, {
    lineWidth: 100,
    noRefs: true,
    quotingType: '"',
  });
}
