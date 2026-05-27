import type { ResourceTypeConfig } from '../resourceTypeConfig';

export const otherConfig: ResourceTypeConfig = {
  id: 'other',
  label: 'Other',
  description: 'Guardrails for any other resource type',

  metadata: {
    additionalFields: [],
  },

  testInputs: {
    enabled: false,
    disabledMessage:
      'Blast radius testing is not available for this resource type. You can still create and test guardrails manually.',
  },

  prCreation: {
    enabled: false,
    disabledMessage:
      'GitHub PR creation is not configured for this resource type. Use "Download ZIP" to export your guardrail files.',
  },

  features: {
    blastRadius: false,
    githubPR: false,
    downloadZip: true,
  },
};
