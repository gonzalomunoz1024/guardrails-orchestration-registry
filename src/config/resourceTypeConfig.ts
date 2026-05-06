import type { FrontendResourceType } from '@/types/registry.types';

export interface GitHubRepoConfig {
  owner: string;
  repo: string;
  defaultBranch?: string;
}

export interface PRFileStructure {
  regoPath: (policyId: string) => string;
  guardrailPath: (policyId: string) => string;
  configPath: (policyId: string) => string;
}

export interface MetadataField {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  type: 'text' | 'select';
  options?: { value: string; label: string }[];
  description?: string;
}

export interface TestInputsConfig {
  enabled: boolean;
  endpoint?: string;
  disabledMessage?: string;
}

export interface PRCreationConfig {
  enabled: boolean;
  github?: GitHubRepoConfig;
  disabledMessage?: string;
  fileStructure?: PRFileStructure;
}

export interface MetadataStepConfig {
  additionalFields: MetadataField[];
}

export interface ResourceTypeFeatures {
  blastRadius: boolean;
  githubPR: boolean;
  downloadZip: boolean;
}

export interface ResourceTypeConfig {
  id: FrontendResourceType;
  label: string;
  description: string;
  metadata: MetadataStepConfig;
  testInputs: TestInputsConfig;
  prCreation: PRCreationConfig;
  features: ResourceTypeFeatures;
}
