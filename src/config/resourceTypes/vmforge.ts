import type { ResourceTypeConfig } from '../resourceTypeConfig';

export const vmforgeConfig: ResourceTypeConfig = {
  id: 'vmforge',
  label: 'VMForge',
  description: 'Virtual machine provisioning policies',

  metadata: {
    additionalFields: [],
  },

  testInputs: {
    enabled: false,
    disabledMessage:
      'Blast radius testing for VMForge policies is coming soon. You can still create and test policies manually.',
  },

  prCreation: {
    enabled: false,
    disabledMessage:
      'GitHub PR creation for VMForge policies is coming soon. Use "Download ZIP" to export your policy files.',
  },

  features: {
    blastRadius: false,
    githubPR: false,
    downloadZip: true,
  },
};
