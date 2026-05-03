export interface PolicyMetadata {
  name: string;
  description: string;
  tags: string[];
  version: string;
  author: string;
}

export interface Policy {
  id?: string;
  regoCode: string;
  inputJson: string;
  configJson: string;
  metadata: PolicyMetadata;
  createdAt?: string;
  updatedAt?: string;
}

export interface PolicyValidationResult {
  valid: boolean;
  errors?: string[];
}
