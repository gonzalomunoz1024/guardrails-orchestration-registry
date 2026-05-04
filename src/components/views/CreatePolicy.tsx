import { useState, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import {
  Save,
  Play,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  FileText,
  Tag,
  Search,
  Loader2,
  Database,
  Building2,
  AppWindow,
  Server,
  ChevronDown,
  ChevronUp,
  Box,
  Layers,
  Shield,
  Zap,
  Info,
  Expand,
} from 'lucide-react';
import { BlastRadiusExecutionModal, EditorModal } from '@/components/modals';
import { useUIStore, usePolicyStore, useEvaluationStore } from '@/store';
import { useRegistryStore } from '@/store/registryStore';
import { useEvaluate, useTestInputs } from '@/hooks';
import { initializeMonaco, defaultEditorOptions } from '@/monaco/config';
import { cn } from '@/utils';
import type { ResourceType, TestInput } from '@/types/registry.types';
import type { EnforcementType, GuardrailKind } from '@/types/guardrail.types';

type Step = 'metadata' | 'code' | 'blastradius' | 'review';

const resourceTypes: { value: ResourceType; label: string; description: string }[] = [
  { value: 'lightspeed', label: 'Lightspeed', description: 'AI-powered automation policies' },
  { value: 'vmforge', label: 'VMForge', description: 'Virtual machine provisioning policies' },
];

const enforcementTypes: { value: EnforcementType; label: string; description: string }[] = [
  { value: 'MANDATORY', label: 'Mandatory', description: 'Policy must pass for action to proceed' },
  { value: 'OPTIONAL', label: 'Optional', description: 'Policy is advisory, failures are logged but allowed' },
];

// Guardrail kind is always PRECHECK for now
const DEFAULT_GUARDRAIL_KIND: GuardrailKind = 'PRECHECK';

const steps: { id: Step; label: string; number: number }[] = [
  { id: 'metadata', label: 'Metadata', number: 1 },
  { id: 'code', label: 'Policy Code', number: 2 },
  { id: 'blastradius', label: 'Blast Radius', number: 3 },
  { id: 'review', label: 'Review & Submit', number: 4 },
];


export function CreatePolicy() {
  const { resolvedTheme } = useUIStore();
  const { regoCode, setRegoCode, inputJson, setInputJson, configJson, setConfigJson, metadata, updateMetadata } = usePolicyStore();
  const { result, isEvaluating } = useEvaluationStore();
  const { setView } = useRegistryStore();

  const [currentStep, setCurrentStep] = useState<Step>('metadata');
  const [policyId, setPolicyId] = useState('');
  const [resourceType, setResourceType] = useState<ResourceType>('lightspeed');
  const [resourceKind, setResourceKind] = useState('');
  const [enforcementType, setEnforcementType] = useState<EnforcementType>('MANDATORY');

  // Pass guardrail info to evaluate hook
  const { evaluate } = useEvaluate({
    guardrailInfo: {
      id: policyId,
      name: metadata.name,
      version: '1.0.0',
      enforcementType,
    },
  });
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Blast Radius filter state
  const [applicationId, setApplicationId] = useState('');
  const [organization, setOrganization] = useState('');
  const [environment, setEnvironment] = useState('');
  const [shouldFetchTestInputs, setShouldFetchTestInputs] = useState(false);
  const [expandedTestCase, setExpandedTestCase] = useState<string | null>(null);
  const [isExecutionModalOpen, setIsExecutionModalOpen] = useState(false);
  const [expandedEditor, setExpandedEditor] = useState<'input' | 'config' | 'output' | null>(null);

  // Stabilize filter object to prevent React Query cache key instability
  const testInputFilters = useMemo(() => ({
    applicationId: applicationId || undefined,
    organization: organization || undefined,
    environment: environment || undefined,
  }), [applicationId, organization, environment]);

  // Use the real test inputs hook with scroll-based pagination
  const {
    testInputs,
    totalHits,
    hasMore,
    isLoading: isFetchingTestCases,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useTestInputs({
    filters: testInputFilters,
    enabled: shouldFetchTestInputs,
  });

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleFetchTestCases = () => {
    if (shouldFetchTestInputs) {
      // If already fetching, refetch with current filters
      refetch();
    } else {
      // Enable fetching for the first time
      setShouldFetchTestInputs(true);
    }
  };

  const handleUseTestInput = (testInput: TestInput) => {
    setInputJson(JSON.stringify(testInput.input, null, 2));
    setCurrentStep('code');
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'metadata':
        return policyId.trim() && metadata.name.trim() && metadata.description.trim() && resourceKind.trim();
      case 'code':
        return regoCode.trim().length > 0;
      case 'blastradius':
        return true;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    // Map frontend resourceType to backend format (uppercase)
    const backendResourceType = resourceType.toUpperCase() as 'LIGHTSPEED' | 'VMFORGE';

    // Prepare the guardrail definition payload
    // POST /api/v1/registry/guardrails
    const createGuardrailPayload = {
      id: policyId,
      name: metadata.name,
      description: metadata.description,
      version: '1.0.0', // Implicit: always start with 1.0.0
      status: 'DRAFT' as const, // Implicit: new policies start as draft
      enforcementType: enforcementType,
      kind: DEFAULT_GUARDRAIL_KIND,
      resourceType: backendResourceType,
      resourceKind: resourceKind,
      owner: metadata.author || 'current-user', // TODO: Get from auth context
      // createdAt and updatedAt are set by the backend
    };

    console.log('Creating guardrail with payload:', createGuardrailPayload);
    console.log('POST /api/v1/registry/guardrails');

    // TODO: Implement actual API call
    // const guardrailResponse = await fetch('/api/v1/registry/guardrails', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(createGuardrailPayload),
    // });

    // Configuration is optional - only save if provided
    const hasConfiguration = configJson && configJson.trim() !== '' && configJson.trim() !== '{}';

    if (hasConfiguration) {
      // Parse and prepare configuration payload
      let parsedConfig = {};
      try {
        parsedConfig = JSON.parse(configJson);
      } catch (e) {
        console.error('Invalid configuration JSON:', e);
      }

      // PUT /api/v1/registry/configurations/{guardrailId} - For new configurations
      // PATCH /api/v1/registry/configurations/{guardrailId} - For partial updates (edits)
      const configPayload = {
        global: parsedConfig,
        lobOverrides: {},
      };

      console.log('Saving configuration:', configPayload);
      console.log(`PUT /api/v1/registry/configurations/${policyId}`);

      // TODO: Implement actual API call
      // const configResponse = await fetch(`/api/v1/registry/configurations/${policyId}`, {
      //   method: 'PUT', // Use PATCH for partial updates during edits
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(configPayload),
      // });
    } else {
      console.log('No configuration provided - skipping configuration save');
    }

    alert('Policy submitted for review!');
    setView('policies');
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-tertiary)]">
      {/* Progress Steps */}
      <div className="p-6 border-b border-[var(--color-border-light)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => setCurrentStep(step.id)}
                className="flex items-center gap-3"
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                    currentStep === step.id
                      ? 'bg-[var(--color-info)] text-white'
                      : steps.findIndex((s) => s.id === currentStep) > index
                        ? 'bg-[var(--color-success)] text-white'
                        : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)]'
                  )}
                >
                  {steps.findIndex((s) => s.id === currentStep) > index ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    step.number
                  )}
                </div>
                <span
                  className={cn(
                    'text-sm font-medium',
                    currentStep === step.id
                      ? 'text-[var(--color-text-primary)]'
                      : 'text-[var(--color-text-tertiary)]'
                  )}
                >
                  {step.label}
                </span>
              </button>
              {index < steps.length - 1 && (
                <ChevronRight className="w-5 h-5 mx-4 text-[var(--color-text-tertiary)]" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className={cn(currentStep === 'code' ? 'max-w-none' : 'max-w-3xl mx-auto')}>
          {/* Step 1: Metadata */}
          {currentStep === 'metadata' && (
            <div className="space-y-6">
              {/* Page Header */}
              <div>
                <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
                  Create New Policy
                </h2>
                <p className="text-[var(--color-text-secondary)]">
                  Define your policy's metadata and configuration
                </p>
              </div>

              {/* Basic Information Card */}
              <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] border border-[var(--color-border-light)] overflow-hidden">
                <div className="px-6 py-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-info-bg)]">
                      <FileText className="w-5 h-5 text-[var(--color-info)]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--color-text-primary)]">Basic Information</h3>
                      <p className="text-sm text-[var(--color-text-secondary)]">Name and describe your policy</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                        Policy ID
                      </label>
                      <input
                        type="text"
                        value={policyId}
                        onChange={(e) => setPolicyId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                        placeholder="e.g., vm-size-limit"
                        className={cn(
                          'w-full px-4 py-3 rounded-[var(--radius-lg)]',
                          'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                          'border border-[var(--color-border-light)]',
                          'focus:border-[var(--color-info)] focus:ring-4 focus:ring-[var(--color-info)]/10 focus:outline-none',
                          'placeholder:text-[var(--color-text-tertiary)]',
                          'transition-all duration-200 font-mono'
                        )}
                      />
                      <p className="mt-1.5 text-xs text-[var(--color-text-tertiary)]">
                        Unique identifier (lowercase, hyphens allowed)
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                        Policy Name
                      </label>
                      <input
                        type="text"
                        value={metadata.name}
                        onChange={(e) => updateMetadata({ name: e.target.value })}
                        placeholder="e.g., VM Size Limit Policy"
                        className={cn(
                          'w-full px-4 py-3 rounded-[var(--radius-lg)]',
                          'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                          'border border-[var(--color-border-light)]',
                          'focus:border-[var(--color-info)] focus:ring-4 focus:ring-[var(--color-info)]/10 focus:outline-none',
                          'placeholder:text-[var(--color-text-tertiary)]',
                          'transition-all duration-200'
                        )}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                      Description
                    </label>
                    <textarea
                      value={metadata.description}
                      onChange={(e) => updateMetadata({ description: e.target.value })}
                      placeholder="Describe what this policy does, when it applies, and its expected behavior..."
                      rows={4}
                      className={cn(
                        'w-full px-4 py-3 rounded-[var(--radius-lg)] resize-none',
                        'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                        'border border-[var(--color-border-light)]',
                        'focus:border-[var(--color-info)] focus:ring-4 focus:ring-[var(--color-info)]/10 focus:outline-none',
                        'placeholder:text-[var(--color-text-tertiary)]',
                        'transition-all duration-200'
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Resource Type Card */}
              <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] border border-[var(--color-border-light)] overflow-hidden">
                <div className="px-6 py-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-success-bg)]">
                      <Box className="w-5 h-5 text-[var(--color-success)]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--color-text-primary)]">Resource Type</h3>
                      <p className="text-sm text-[var(--color-text-secondary)]">Select the resource type this policy applies to</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {resourceTypes.map((rt) => (
                      <button
                        key={rt.value}
                        onClick={() => setResourceType(rt.value)}
                        className={cn(
                          'flex items-start gap-4 p-4 rounded-[var(--radius-lg)]',
                          'border-2 transition-all duration-200 text-left',
                          resourceType === rt.value
                            ? 'border-[var(--color-info)] bg-[var(--color-info-bg)]'
                            : 'border-[var(--color-border-light)] bg-[var(--color-surface-secondary)] hover:border-[var(--color-border)]'
                        )}
                      >
                        <div className={cn(
                          'p-3 rounded-[var(--radius-md)]',
                          resourceType === rt.value
                            ? 'bg-[var(--color-info)] text-white'
                            : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                        )}>
                          <Box className="w-5 h-5" />
                        </div>
                        <div>
                          <span className={cn(
                            'block text-base font-semibold',
                            resourceType === rt.value
                              ? 'text-[var(--color-info)]'
                              : 'text-[var(--color-text-primary)]'
                          )}>
                            {rt.label}
                          </span>
                          <span className="text-sm text-[var(--color-text-secondary)]">
                            {rt.description}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Resource Kind Card */}
              <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] border border-[var(--color-border-light)] overflow-hidden">
                <div className="px-6 py-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-warning-bg)]">
                      <Layers className="w-5 h-5 text-[var(--color-warning)]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--color-text-primary)]">Resource Kind</h3>
                      <p className="text-sm text-[var(--color-text-secondary)]">Specify the kind of resource within the selected type</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <input
                    type="text"
                    value={resourceKind}
                    onChange={(e) => setResourceKind(e.target.value)}
                    placeholder="e.g., VirtualMachine, Playbook, Template"
                    className={cn(
                      'w-full px-4 py-3 rounded-[var(--radius-lg)]',
                      'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                      'border border-[var(--color-border-light)]',
                      'focus:border-[var(--color-info)] focus:ring-4 focus:ring-[var(--color-info)]/10 focus:outline-none',
                      'placeholder:text-[var(--color-text-tertiary)]',
                      'transition-all duration-200'
                    )}
                  />
                </div>
              </div>

              {/* Enforcement Type Card */}
              <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] border border-[var(--color-border-light)] overflow-hidden">
                <div className="px-6 py-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-error-bg)]">
                      <Shield className="w-5 h-5 text-[var(--color-error)]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--color-text-primary)]">Enforcement Type</h3>
                      <p className="text-sm text-[var(--color-text-secondary)]">How should policy violations be handled?</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {enforcementTypes.map((et) => (
                      <button
                        key={et.value}
                        onClick={() => setEnforcementType(et.value)}
                        className={cn(
                          'flex items-start gap-4 p-4 rounded-[var(--radius-lg)]',
                          'border-2 transition-all duration-200 text-left',
                          enforcementType === et.value
                            ? et.value === 'MANDATORY'
                              ? 'border-[var(--color-error)] bg-[var(--color-error-bg)]'
                              : 'border-[var(--color-warning)] bg-[var(--color-warning-bg)]'
                            : 'border-[var(--color-border-light)] bg-[var(--color-surface-secondary)] hover:border-[var(--color-border)]'
                        )}
                      >
                        <div className={cn(
                          'p-3 rounded-[var(--radius-md)]',
                          enforcementType === et.value
                            ? et.value === 'MANDATORY'
                              ? 'bg-[var(--color-error)] text-white'
                              : 'bg-[var(--color-warning)] text-white'
                            : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                        )}>
                          <Shield className="w-5 h-5" />
                        </div>
                        <div>
                          <span className={cn(
                            'block text-base font-semibold',
                            enforcementType === et.value
                              ? et.value === 'MANDATORY'
                                ? 'text-[var(--color-error)]'
                                : 'text-[var(--color-warning)]'
                              : 'text-[var(--color-text-primary)]'
                          )}>
                            {et.label}
                          </span>
                          <span className="text-sm text-[var(--color-text-secondary)]">
                            {et.description}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tags Card */}
              <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] border border-[var(--color-border-light)] overflow-hidden">
                <div className="px-6 py-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-info-bg)]">
                      <Tag className="w-5 h-5 text-[var(--color-info)]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--color-text-primary)]">Tags</h3>
                      <p className="text-sm text-[var(--color-text-secondary)]">Add tags for easier discovery</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-info-bg)] text-[var(--color-info)] text-sm font-medium"
                        >
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:text-[var(--color-error)] transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                      placeholder="Type a tag and press Enter..."
                      className={cn(
                        'flex-1 px-4 py-3 rounded-[var(--radius-lg)]',
                        'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                        'border border-[var(--color-border-light)]',
                        'focus:border-[var(--color-info)] focus:ring-4 focus:ring-[var(--color-info)]/10 focus:outline-none',
                        'placeholder:text-[var(--color-text-tertiary)]',
                        'transition-all duration-200'
                      )}
                    />
                    <button
                      onClick={handleAddTag}
                      disabled={!tagInput.trim()}
                      className={cn(
                        'px-5 py-3 rounded-[var(--radius-lg)] font-medium',
                        'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                        'border border-[var(--color-border-light)]',
                        'hover:bg-[var(--color-border-light)] transition-all duration-200',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Code - Full width layout */}
          {currentStep === 'code' && (
            <div className="space-y-4 -mx-6 px-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
                    Policy Code
                  </h2>
                  <p className="text-[var(--color-text-secondary)]">
                    Write your Rego policy and test it with sample input
                  </p>
                </div>
                <button
                  onClick={evaluate}
                  disabled={isEvaluating}
                  className={cn(
                    'flex items-center gap-2 px-6 py-2.5 rounded-[var(--radius-md)]',
                    'bg-[var(--color-info)] text-white font-medium',
                    'transition-all hover:opacity-90',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <Play className="w-4 h-4" />
                  {isEvaluating ? 'Evaluating...' : 'Test Policy'}
                </button>
              </div>

              <div className="flex gap-4" style={{ height: 'calc(100vh - 340px)', minHeight: '500px' }}>
                {/* Policy Editor - Takes 60% */}
                <div className="flex-[3] flex flex-col min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-[var(--color-text-primary)]">
                      Rego Policy
                    </label>
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      {regoCode.split('\n').length} lines
                    </span>
                  </div>
                  <div className="flex-1 rounded-[var(--radius-lg)] border border-[var(--color-border-light)] overflow-hidden shadow-[var(--shadow-card)]">
                    <Editor
                      height="100%"
                      language="rego"
                      theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs'}
                      value={regoCode}
                      onChange={(value) => setRegoCode(value || '')}
                      onMount={(_editor, monaco) => initializeMonaco(monaco)}
                      options={defaultEditorOptions}
                    />
                  </div>
                </div>

                {/* Input, Config & Output - Takes 40% */}
                <div className="flex-[2] flex flex-col gap-3 min-w-0">
                  {/* Test Input */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-[var(--color-text-primary)]">
                        Input
                      </label>
                      <button
                        onClick={() => setExpandedEditor('input')}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] transition-all"
                      >
                        <Expand className="w-3.5 h-3.5" />
                        Expand
                      </button>
                    </div>
                    <div className="flex-1 rounded-[var(--radius-lg)] border border-[var(--color-border-light)] overflow-hidden shadow-[var(--shadow-card)] relative group">
                      <Editor
                        height="100%"
                        language="json"
                        theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs'}
                        value={inputJson}
                        onChange={(value) => setInputJson(value || '{}')}
                        options={defaultEditorOptions}
                      />
                    </div>
                  </div>

                  {/* Configuration / Data */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-[var(--color-text-primary)]">
                          Configuration
                        </label>
                        <div className="relative group/tooltip">
                          <Info className="w-4 h-4 text-[var(--color-text-tertiary)] cursor-help" />
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 rounded-lg bg-[var(--color-text-primary)] text-[var(--color-surface)] text-xs w-64 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-10 shadow-lg">
                            <p className="font-medium mb-1">Dynamic Runtime Data</p>
                            <p className="text-[var(--color-surface)]/80">
                              Configuration can be modified at runtime via the Configuration Registry. Use <code className="px-1 py-0.5 rounded bg-[var(--color-surface)]/20 font-mono">input.configuration</code> to access in your Rego policy.
                            </p>
                            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[var(--color-text-primary)]" />
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setExpandedEditor('config')}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] transition-all"
                      >
                        <Expand className="w-3.5 h-3.5" />
                        Expand
                      </button>
                    </div>
                    <div className="flex-1 rounded-[var(--radius-lg)] border border-[var(--color-border-light)] overflow-hidden shadow-[var(--shadow-card)]">
                      <Editor
                        height="100%"
                        language="json"
                        theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs'}
                        value={configJson}
                        onChange={(value) => setConfigJson(value || '{}')}
                        options={defaultEditorOptions}
                      />
                    </div>
                  </div>

                  {/* Output */}
                  <div className="flex-[0.8] flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-[var(--color-text-primary)]">
                          Output
                        </label>
                        {result?.success && (
                          (() => {
                            const resultObj = result.result as Record<string, unknown> | undefined;
                            const isAllowed = resultObj?.allow === true;
                            return (
                              <span className={cn(
                                "flex items-center gap-1 text-xs",
                                isAllowed ? "text-[var(--color-success)]" : "text-[var(--color-error)]"
                              )}>
                                {isAllowed ? (
                                  <>
                                    <CheckCircle className="w-3 h-3" />
                                    Allowed
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3 h-3" />
                                    Denied
                                  </>
                                )}
                              </span>
                            );
                          })()
                        )}
                      </div>
                      {result && (
                        <button
                          onClick={() => setExpandedEditor('output')}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] transition-all"
                        >
                          <Expand className="w-3.5 h-3.5" />
                          Expand
                        </button>
                      )}
                    </div>
                    <div
                      className={cn(
                        'flex-1 p-4 rounded-[var(--radius-lg)] border overflow-auto shadow-[var(--shadow-card)]',
                        result?.success
                          ? (result.result as Record<string, unknown> | undefined)?.allow === true
                            ? 'border-[var(--color-success)] bg-[var(--color-success-bg)]'
                            : 'border-[var(--color-error)] bg-[var(--color-error-bg)]'
                          : result?.error
                            ? 'border-[var(--color-error)] bg-[var(--color-error-bg)]'
                            : 'border-[var(--color-border-light)] bg-[var(--color-surface)]'
                      )}
                    >
                      {result ? (
                        <pre className="text-sm font-mono whitespace-pre-wrap">
                          {JSON.stringify(result.result || result.error, null, 2)}
                        </pre>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <p className="text-sm text-[var(--color-text-tertiary)]">
                            Click "Test Policy" to see the evaluation result
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Blast Radius - Fetch & Execute Test Cases */}
          {currentStep === 'blastradius' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
                  Blast Radius Analysis
                </h2>
                <p className="text-[var(--color-text-secondary)]">
                  Evaluate your policy against real test cases to understand its impact
                </p>
              </div>

              {/* Filter Card */}
              <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] border border-[var(--color-border-light)] overflow-hidden">
                <div className="px-6 py-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-info-bg)]">
                      <Search className="w-5 h-5 text-[var(--color-info)]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--color-text-primary)]">Filter Test Cases</h3>
                      <p className="text-sm text-[var(--color-text-secondary)]">All fields are optional. Leave empty to fetch all test cases.</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Application ID */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)] mb-2">
                        <AppWindow className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                        Application ID
                      </label>
                      <input
                        type="text"
                        value={applicationId}
                        onChange={(e) => setApplicationId(e.target.value)}
                        placeholder="e.g., app-001"
                        className={cn(
                          'w-full px-4 py-3 rounded-[var(--radius-lg)]',
                          'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                          'border border-[var(--color-border-light)]',
                          'focus:border-[var(--color-info)] focus:ring-4 focus:ring-[var(--color-info)]/10 focus:outline-none',
                          'placeholder:text-[var(--color-text-tertiary)]'
                        )}
                      />
                    </div>

                    {/* Organization */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)] mb-2">
                        <Building2 className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                        Organization
                      </label>
                      <input
                        type="text"
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        placeholder="e.g., acme-corp"
                        className={cn(
                          'w-full px-4 py-3 rounded-[var(--radius-lg)]',
                          'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                          'border border-[var(--color-border-light)]',
                          'focus:border-[var(--color-info)] focus:ring-4 focus:ring-[var(--color-info)]/10 focus:outline-none',
                          'placeholder:text-[var(--color-text-tertiary)]'
                        )}
                      />
                    </div>

                    {/* Environment */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)] mb-2">
                        <Server className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                        Environment
                      </label>
                      <input
                        type="text"
                        value={environment}
                        onChange={(e) => setEnvironment(e.target.value)}
                        placeholder="e.g., production"
                        className={cn(
                          'w-full px-4 py-3 rounded-[var(--radius-lg)]',
                          'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                          'border border-[var(--color-border-light)]',
                          'focus:border-[var(--color-info)] focus:ring-4 focus:ring-[var(--color-info)]/10 focus:outline-none',
                          'placeholder:text-[var(--color-text-tertiary)]'
                        )}
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    <p className="text-sm text-[var(--color-text-tertiary)]">
                      {applicationId || organization || environment
                        ? `Filtering by: ${[applicationId && 'Application', organization && 'Organization', environment && 'Environment'].filter(Boolean).join(', ')}`
                        : 'No filters applied - will fetch all test cases'}
                    </p>
                    <button
                      onClick={handleFetchTestCases}
                      disabled={isFetchingTestCases}
                      className={cn(
                        'flex items-center gap-2 px-6 py-2.5 rounded-[var(--radius-lg)]',
                        'bg-[var(--color-info)] text-white font-medium',
                        'transition-all hover:opacity-90',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      {isFetchingTestCases ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Fetching...
                        </>
                      ) : (
                        <>
                          <Database className="w-4 h-4" />
                          Fetch Test Cases
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Test Cases Results */}
              {shouldFetchTestInputs && (
                <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] border border-[var(--color-border-light)] overflow-hidden">
                  <div className="px-6 py-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-success-bg)]">
                          <Database className="w-5 h-5 text-[var(--color-success)]" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-[var(--color-text-primary)]">Test Cases</h3>
                          <p className="text-sm text-[var(--color-text-secondary)]">
                            {isFetchingTestCases ? 'Loading...' : `${testInputs.length} of ${totalHits} test case${totalHits !== 1 ? 's' : ''}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="divide-y divide-[var(--color-border-light)]">
                    {testInputs.length > 0 ? (
                      <>
                        {testInputs.map((testInput) => (
                          <div key={testInput.id} className="p-4">
                            <button
                              onClick={() => setExpandedTestCase(expandedTestCase === testInput.id ? null : testInput.id)}
                              className="w-full flex items-center justify-between text-left"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                  <h4 className="font-medium text-[var(--color-text-primary)]">
                                    {testInput.name}
                                  </h4>
                                  <div className="flex gap-2">
                                    {testInput.applicationId && (
                                      <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
                                        {testInput.applicationId}
                                      </span>
                                    )}
                                    {testInput.environment && (
                                      <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--color-info-bg)] text-[var(--color-info)]">
                                        {testInput.environment}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {testInput.description && (
                                  <p className="text-sm text-[var(--color-text-secondary)]">
                                    {testInput.description}
                                  </p>
                                )}
                              </div>
                              {expandedTestCase === testInput.id ? (
                                <ChevronUp className="w-5 h-5 text-[var(--color-text-tertiary)]" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-[var(--color-text-tertiary)]" />
                              )}
                            </button>

                            {expandedTestCase === testInput.id && (
                              <div className="mt-4 space-y-3">
                                <div className="p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-secondary)]">
                                  <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-2">
                                    INPUT JSON
                                  </label>
                                  <pre className="text-sm font-mono text-[var(--color-text-primary)] overflow-auto max-h-64">
                                    {JSON.stringify(testInput.input, null, 2)}
                                  </pre>
                                </div>
                                <button
                                  onClick={() => handleUseTestInput(testInput)}
                                  className={cn(
                                    'flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)]',
                                    'bg-[var(--color-info)] text-white font-medium text-sm',
                                    'transition-all hover:opacity-90'
                                  )}
                                >
                                  <Play className="w-4 h-4" />
                                  Use This Input
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                        {/* Load More Button */}
                        {hasMore && (
                          <div className="p-4 text-center">
                            <button
                              onClick={() => fetchNextPage()}
                              disabled={isFetchingNextPage}
                              className={cn(
                                'inline-flex items-center gap-2 px-6 py-2.5 rounded-[var(--radius-lg)]',
                                'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                                'border border-[var(--color-border-light)]',
                                'font-medium transition-all hover:bg-[var(--color-border-light)]',
                                'disabled:opacity-50 disabled:cursor-not-allowed'
                              )}
                            >
                              {isFetchingNextPage ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Loading more...
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-4 h-4" />
                                  Load More ({totalHits - testInputs.length} remaining)
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    ) : isFetchingTestCases ? (
                      <div className="p-12 text-center">
                        <Loader2 className="w-12 h-12 mx-auto mb-4 text-[var(--color-info)] animate-spin" />
                        <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
                          Fetching test cases...
                        </h3>
                        <p className="text-[var(--color-text-secondary)]">
                          Searching for matching test inputs from OpenSearch.
                        </p>
                      </div>
                    ) : (
                      <div className="p-12 text-center">
                        <Database className="w-12 h-12 mx-auto mb-4 text-[var(--color-text-tertiary)] opacity-50" />
                        <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
                          No test cases found
                        </h3>
                        <p className="text-[var(--color-text-secondary)]">
                          Try adjusting your filters or leave them empty to see all test cases.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Execute Test Cases Button */}
              {testInputs.length > 0 && (
                <div className="rounded-[var(--radius-xl)] bg-gradient-to-r from-[var(--color-info)]/5 via-[var(--color-success)]/5 to-[var(--color-info)]/5 border border-[var(--color-border-light)] p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-2xl bg-gradient-to-br from-[var(--color-info)] to-[var(--color-success)] shadow-lg">
                        <Zap className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                          Ready to Analyze
                        </h3>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          Execute your policy against {testInputs.length} test case{testInputs.length !== 1 ? 's' : ''} to see the blast radius
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsExecutionModalOpen(true)}
                      disabled={!regoCode.trim()}
                      className={cn(
                        'flex items-center gap-3 px-8 py-4 rounded-2xl',
                        'bg-gradient-to-r from-[var(--color-info)] to-[var(--color-success)]',
                        'text-white font-semibold text-base',
                        'shadow-lg shadow-[var(--color-info)]/25',
                        'transition-all duration-300 hover:shadow-xl hover:shadow-[var(--color-info)]/30 hover:scale-[1.02]',
                        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
                      )}
                    >
                      <Play className="w-5 h-5" />
                      Run Blast Radius
                    </button>
                  </div>
                </div>
              )}

              {/* Info Box */}
              <div className="rounded-[var(--radius-lg)] bg-[var(--color-info-bg)] border border-[var(--color-info)]/20 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-[var(--color-info)] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-[var(--color-info)]">
                      How it works
                    </p>
                    <p className="text-sm text-[var(--color-info)]/80 mt-1">
                      Test cases are fetched from your organization's test database. Use filters to narrow down relevant inputs, then click "Run Blast Radius" to evaluate your policy against all fetched test cases.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Blast Radius Execution Modal */}
          <BlastRadiusExecutionModal
            isOpen={isExecutionModalOpen}
            onClose={() => setIsExecutionModalOpen(false)}
            testInputs={testInputs}
            regoCode={regoCode}
            configJson={configJson}
            guardrailInfo={{
              id: policyId,
              name: metadata.name,
              version: '1.0.0',
              enforcementType,
            }}
          />

          {/* Editor Modals */}
          <EditorModal
            isOpen={expandedEditor === 'input'}
            onClose={() => setExpandedEditor(null)}
            title="Input"
            subtitle="Runtime data passed to your policy"
            language="json"
            value={inputJson}
            onChange={setInputJson}
            theme={resolvedTheme}
          />
          <EditorModal
            isOpen={expandedEditor === 'config'}
            onClose={() => setExpandedEditor(null)}
            title="Configuration"
            subtitle="Dynamic data accessible via input.configuration"
            language="json"
            value={configJson}
            onChange={setConfigJson}
            theme={resolvedTheme}
          />
          <EditorModal
            isOpen={expandedEditor === 'output'}
            onClose={() => setExpandedEditor(null)}
            title="Output"
            subtitle="Policy evaluation result"
            language="json"
            value={result ? JSON.stringify(result.result || result.error, null, 2) : '{}'}
            readOnly
            theme={resolvedTheme}
          />

          {/* Step 4: Review */}
          {currentStep === 'review' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
                  Review & Submit
                </h2>
                <p className="text-[var(--color-text-secondary)]">
                  Review your policy details before submitting for approval
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Policy Details Card */}
                <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] border border-[var(--color-border-light)] overflow-hidden">
                  <div className="px-6 py-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50">
                    <h3 className="font-semibold text-[var(--color-text-primary)]">Policy Details</h3>
                  </div>
                  <div className="p-6">
                    <dl className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-light)]">
                        <dt className="text-[var(--color-text-secondary)]">ID</dt>
                        <dd className="font-mono text-sm text-[var(--color-text-primary)]">{policyId || '—'}</dd>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-light)]">
                        <dt className="text-[var(--color-text-secondary)]">Name</dt>
                        <dd className="font-medium text-[var(--color-text-primary)]">{metadata.name || '—'}</dd>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-light)]">
                        <dt className="text-[var(--color-text-secondary)]">Version</dt>
                        <dd className="font-mono text-sm text-[var(--color-text-primary)]">1.0.0</dd>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-light)]">
                        <dt className="text-[var(--color-text-secondary)]">Status</dt>
                        <dd>
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
                            Draft
                          </span>
                        </dd>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <dt className="text-[var(--color-text-secondary)]">Code Lines</dt>
                        <dd className="font-medium text-[var(--color-text-primary)]">
                          {regoCode.split('\n').length}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* Resource & Enforcement Card */}
                <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] border border-[var(--color-border-light)] overflow-hidden">
                  <div className="px-6 py-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50">
                    <h3 className="font-semibold text-[var(--color-text-primary)]">Resource & Enforcement</h3>
                  </div>
                  <div className="p-6">
                    <dl className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-light)]">
                        <dt className="text-[var(--color-text-secondary)]">Resource Type</dt>
                        <dd className="font-medium text-[var(--color-text-primary)] capitalize">
                          {resourceType}
                        </dd>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-light)]">
                        <dt className="text-[var(--color-text-secondary)]">Resource Kind</dt>
                        <dd className="font-medium text-[var(--color-text-primary)]">
                          {resourceKind || '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-light)]">
                        <dt className="text-[var(--color-text-secondary)]">Enforcement</dt>
                        <dd>
                          <span className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-medium',
                            enforcementType === 'MANDATORY'
                              ? 'bg-[var(--color-error-bg)] text-[var(--color-error)]'
                              : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                          )}>
                            {enforcementType === 'MANDATORY' ? 'Mandatory' : 'Optional'}
                          </span>
                        </dd>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <dt className="text-[var(--color-text-secondary)]">Timing</dt>
                        <dd>
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-info-bg)] text-[var(--color-info)]">
                            Pre-check
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* Tags Card */}
                <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] border border-[var(--color-border-light)] overflow-hidden">
                  <div className="px-6 py-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50">
                    <h3 className="font-semibold text-[var(--color-text-primary)]">Tags</h3>
                  </div>
                  <div className="p-6">
                    {tags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-3 py-1.5 rounded-full text-sm font-medium bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[var(--color-text-tertiary)]">No tags added</p>
                    )}
                  </div>
                </div>

                {/* Description Card */}
                <div className="md:col-span-2 rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] border border-[var(--color-border-light)] overflow-hidden">
                  <div className="px-6 py-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50">
                    <h3 className="font-semibold text-[var(--color-text-primary)]">Description</h3>
                  </div>
                  <div className="p-6">
                    <p className="text-[var(--color-text-secondary)] leading-relaxed">
                      {metadata.description || 'No description provided'}
                    </p>
                  </div>
                </div>

                {/* Code Preview Card */}
                <div className="md:col-span-2 rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] border border-[var(--color-border-light)] overflow-hidden">
                  <div className="px-6 py-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50 flex items-center justify-between">
                    <h3 className="font-semibold text-[var(--color-text-primary)]">Policy Code</h3>
                    <span className="text-sm text-[var(--color-text-tertiary)]">
                      {regoCode.split('\n').length} lines
                    </span>
                  </div>
                  <div className="p-6">
                    <pre className="p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-secondary)] text-sm font-mono text-[var(--color-text-primary)] overflow-auto max-h-64">
                      {regoCode || 'No code written'}
                    </pre>
                  </div>
                </div>

                {/* Configuration Card */}
                <div className="md:col-span-2 rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] border border-[var(--color-border-light)] overflow-hidden">
                  <div className="px-6 py-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50 flex items-center justify-between">
                    <h3 className="font-semibold text-[var(--color-text-primary)]">Configuration</h3>
                    <span className="text-sm text-[var(--color-text-tertiary)]">
                      {configJson && configJson !== '{}' ? 'Provided' : 'Optional - Not provided'}
                    </span>
                  </div>
                  <div className="p-6">
                    {configJson && configJson !== '{}' ? (
                      <pre className="p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-secondary)] text-sm font-mono text-[var(--color-text-primary)] overflow-auto max-h-48">
                        {configJson}
                      </pre>
                    ) : (
                      <p className="text-[var(--color-text-tertiary)] text-sm">
                        No configuration provided. You can add configuration data in the Policy Code step.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--color-border-light)] bg-[var(--color-surface)]">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={() => {
              const stepIndex = steps.findIndex((s) => s.id === currentStep);
              if (stepIndex > 0) {
                setCurrentStep(steps[stepIndex - 1].id);
              }
            }}
            disabled={currentStep === 'metadata'}
            className={cn(
              'px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium',
              'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Back
          </button>

          <div className="flex items-center gap-3">
            <button
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-lg)]',
                'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                'border border-[var(--color-border-light)]',
                'font-medium transition-all hover:bg-[var(--color-border-light)]'
              )}
            >
              <Save className="w-4 h-4" />
              Save Draft
            </button>

            {currentStep === 'review' ? (
              <button
                onClick={handleSubmit}
                className={cn(
                  'flex items-center gap-2 px-6 py-2.5 rounded-[var(--radius-lg)]',
                  'bg-[var(--color-success)] text-white font-medium',
                  'transition-all hover:opacity-90'
                )}
              >
                <Send className="w-4 h-4" />
                Submit for Review
              </button>
            ) : (
              <button
                onClick={() => {
                  const stepIndex = steps.findIndex((s) => s.id === currentStep);
                  if (stepIndex < steps.length - 1) {
                    setCurrentStep(steps[stepIndex + 1].id);
                  }
                }}
                disabled={!canProceed()}
                className={cn(
                  'flex items-center gap-2 px-6 py-2.5 rounded-[var(--radius-lg)]',
                  'bg-[var(--color-info)] text-white font-medium',
                  'transition-all hover:opacity-90',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
