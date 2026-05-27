import { guardrailConfig } from '@/config/guardrailConfig';
import type { GuardrailAppConfig } from '@/config/guardrailConfig';

interface UseGuardrailConfigResult {
  config: GuardrailAppConfig;
  supportsBlastRadius: boolean;
  supportsGitHubPR: boolean;
  supportsDownloadZip: boolean;
  testInputsEnabled: boolean;
  prCreationEnabled: boolean;
  testInputsDisabledMessage?: string;
  prCreationDisabledMessage?: string;
}

/** Global guardrail feature/publish config (no longer keyed by resource type). */
export function useGuardrailConfig(): UseGuardrailConfigResult {
  return {
    config: guardrailConfig,
    supportsBlastRadius: guardrailConfig.features.blastRadius,
    supportsGitHubPR: guardrailConfig.features.githubPR,
    supportsDownloadZip: guardrailConfig.features.downloadZip,
    testInputsEnabled: guardrailConfig.testInputs.enabled,
    prCreationEnabled: guardrailConfig.features.githubPR,
    testInputsDisabledMessage: guardrailConfig.testInputs.disabledMessage,
    prCreationDisabledMessage: undefined,
  };
}
