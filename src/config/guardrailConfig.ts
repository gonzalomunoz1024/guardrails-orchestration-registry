/**
 * Global guardrail app config. Replaces the former per-resourceType config now
 * that `resourceType` is removed — features and the GitHub publish target are
 * application-wide.
 */

export interface GuardrailFeatures {
  blastRadius: boolean;
  githubPR: boolean;
  downloadZip: boolean;
}

export interface GuardrailGitHubConfig {
  owner: string;
  repo: string;
  defaultBranch?: string;
}

export interface GuardrailAppConfig {
  features: GuardrailFeatures;
  github: GuardrailGitHubConfig;
  testInputs: { enabled: boolean; endpoint?: string; disabledMessage?: string };
}

export const guardrailConfig: GuardrailAppConfig = {
  features: {
    blastRadius: true,
    githubPR: true,
    downloadZip: true,
  },
  github: {
    owner: 'wftgitsas-CHIEF-TECH-OFC',
    repo: 'App-claut-schema-registry',
    defaultBranch: 'main',
  },
  testInputs: {
    enabled: true,
    endpoint: '/v1/registry/test-inputs',
  },
};
