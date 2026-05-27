import { lightspeedConfig } from './lightspeed';
import { vmforgeConfig } from './vmforge';
import { otherConfig } from './other';
import type { ResourceTypeConfig } from '../resourceTypeConfig';
import type { FrontendResourceType } from '@/types/registry.types';

export const resourceTypeRegistry: Record<FrontendResourceType, ResourceTypeConfig> = {
  lightspeed: lightspeedConfig,
  vmforge: vmforgeConfig,
  other: otherConfig,
};

export function getResourceTypeConfig(resourceType: FrontendResourceType): ResourceTypeConfig {
  const config = resourceTypeRegistry[resourceType];
  if (!config) {
    throw new Error(`Unknown resource type: ${resourceType}`);
  }
  return config;
}

export function getAvailableResourceTypes(): ResourceTypeConfig[] {
  return Object.values(resourceTypeRegistry);
}

export function supportsFeature(
  resourceType: FrontendResourceType,
  feature: keyof ResourceTypeConfig['features']
): boolean {
  return getResourceTypeConfig(resourceType).features[feature];
}

export type { ResourceTypeConfig } from '../resourceTypeConfig';
