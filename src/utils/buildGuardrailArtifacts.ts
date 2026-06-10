import type { ExternalDependency, PolicyMetadata } from '@/types';
import type {
  ResourceKind,
  Stage,
  EnforcementType,
  GuardrailStatus,
} from '@/types/guardrail.types';
import type { InputExample } from '@/store/policyStore';
import { toGuardrailYaml, toGuardrailConfigurationYaml } from './guardrailManifest';
import { appendVersionToRegoPackage } from './regoPackage';
import { isDependencyConfigured } from '@/services/external/externalServices';

export interface BuildGuardrailArtifactsArgs {
  regoCode: string;
  configJson: string;
  configEnabled: boolean;
  inputSchemaJson: string;
  inputExamples: InputExample[];
  externalDeps: ExternalDependency[];
  metadata: PolicyMetadata;
  resourceKind: ResourceKind;
  enforcementType: EnforcementType;
  stage: Stage;
  status: GuardrailStatus;
  tags: string[];
}

function slugExample(name: string, i: number): string {
  return (
    name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') ||
    `example-${i + 1}`
  );
}

function safeParseJson(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s || '{}');
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function safeParseSchema(s: string): Record<string, unknown> | undefined {
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

/**
 * Build the file contents that get published for a guardrail version, keyed
 * by the path *within* the version directory (e.g. "policy.rego",
 * "examples/foo.json"). The Submit modal uses this for the live artifact
 * list; the Edit-load path uses it to snapshot a baseline so each file can
 * be diffed against the version that's currently in the repo.
 */
export function buildGuardrailArtifactFiles(
  args: BuildGuardrailArtifactsArgs
): Record<string, string> {
  const examples = args.inputExamples
    .filter((e) => e.payload.trim())
    .map((e, i) => ({ file: `examples/${slugExample(e.name, i)}.json`, payload: e.payload }));

  const configObject = safeParseJson(args.configJson);
  // Treat an enabled-but-empty configuration as not-published: customers who
  // toggle the configuration tab on but never type anything would otherwise
  // ship a `{}` configuration.yaml that downstream consumers read as an
  // intentional empty lookup table and fail enforcement on. The toggle stays
  // as user intent in the store; emission is gated on actual content.
  const configHasContent = args.configEnabled && Object.keys(configObject).length > 0;
  // Same idea for external deps: drop rows the user added but never finished
  // wiring up (no operation, no host). isDependencyConfigured is the single
  // source of truth for "actually shippable" — see externalServices.
  const configuredExternalDeps = args.externalDeps.filter(isDependencyConfigured);

  const manifestYaml = toGuardrailYaml({
    metadata: {
      name: args.metadata.name,
      description: args.metadata.description,
      tags: args.metadata.tags,
      version: args.metadata.version,
      author: args.metadata.author,
    },
    resourceKind: args.resourceKind,
    enforcementType: args.enforcementType,
    stage: args.stage,
    status: args.status,
    tags: args.tags,
    configEnabled: configHasContent,
    externalDeps: configuredExternalDeps,
    policyFile: 'policy.rego',
    configFile: 'configuration.yaml',
    inputSchema: {
      file: 'input-schema.json',
      content: safeParseSchema(args.inputSchemaJson),
      examples: examples.map((e) => e.file),
    },
    configuration: configHasContent
      ? { file: 'configuration.yaml', content: configObject }
      : undefined,
  });

  const files: Record<string, string> = {
    'policy.rego': appendVersionToRegoPackage(args.regoCode, args.metadata.version),
    'guardrail.yaml': manifestYaml,
    'input-schema.json': args.inputSchemaJson || '{}',
  };
  if (configHasContent) {
    files['configuration.yaml'] = toGuardrailConfigurationYaml(configObject);
  }
  for (const ex of examples) {
    files[ex.file] = ex.payload;
  }
  return files;
}
