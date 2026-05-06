import { useMemo } from 'react';
import { getResourceTypeConfig } from '@/config/resourceTypes';
import type { FrontendResourceType } from '@/types/registry.types';
import type { ResourceTypeConfig } from '@/config/resourceTypeConfig';

interface UseResourceTypeConfigResult {
  config: ResourceTypeConfig;
  supportsBlastRadius: boolean;
  supportsGitHubPR: boolean;
  supportsDownloadZip: boolean;
  testInputsEnabled: boolean;
  prCreationEnabled: boolean;
  testInputsDisabledMessage?: string;
  prCreationDisabledMessage?: string;
}

export function useResourceTypeConfig(
  resourceType: FrontendResourceType
): UseResourceTypeConfigResult {
  return useMemo(() => {
    const config = getResourceTypeConfig(resourceType);

    return {
      config,
      supportsBlastRadius: config.features.blastRadius,
      supportsGitHubPR: config.features.githubPR,
      supportsDownloadZip: config.features.downloadZip,
      testInputsEnabled: config.testInputs.enabled,
      prCreationEnabled: config.prCreation.enabled,
      testInputsDisabledMessage: config.testInputs.disabledMessage,
      prCreationDisabledMessage: config.prCreation.disabledMessage,
    };
  }, [resourceType]);
}
