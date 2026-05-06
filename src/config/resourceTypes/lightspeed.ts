import type { ResourceTypeConfig } from '../resourceTypeConfig';

export const lightspeedConfig: ResourceTypeConfig = {
  id: 'lightspeed',
  label: 'Lightspeed',
  description: 'AI-powered automation policies',

  metadata: {
    additionalFields: [
      {
        key: 'resourceKind',
        label: 'Resource Kind',
        placeholder: 'e.g., VirtualMachine, Playbook, Template',
        required: true,
        type: 'text',
        description: 'Specify the kind of resource within Lightspeed',
      },
    ],
  },

  testInputs: {
    enabled: true,
    endpoint: '/v1/registry/test-inputs',
  },

  prCreation: {
    enabled: true,
    github: {
      owner: 'wftgitsas-CHIEF-TECH-OFC',
      repo: 'App-claut-schema-registry',
      defaultBranch: 'main',
    },
    fileStructure: {
      regoPath: (policyId) => `rego/${policyId}.rego`,
      guardrailPath: (policyId) => `guardrails/${policyId}.yaml`,
      configPath: (policyId) => `configurations/${policyId}.yaml`,
    },
  },

  features: {
    blastRadius: true,
    githubPR: true,
    downloadZip: true,
  },
};
