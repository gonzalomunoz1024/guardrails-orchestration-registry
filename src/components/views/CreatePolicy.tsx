import { useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  Save,
  Play,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { useUIStore, usePolicyStore, useEvaluationStore } from '@/store';
import { useRegistryStore } from '@/store/registryStore';
import { useEvaluate } from '@/hooks';
import { initializeMonaco, defaultEditorOptions } from '@/monaco/config';
import { cn, isValidJson } from '@/utils';
import type { PolicyCategory, PolicySeverity } from '@/types';

type Step = 'metadata' | 'code' | 'tests' | 'review';

const categories: { value: PolicyCategory; label: string }[] = [
  { value: 'access-control', label: 'Access Control' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'security', label: 'Security' },
  { value: 'cost', label: 'Cost Management' },
  { value: 'operational', label: 'Operational' },
];

const severities: { value: PolicySeverity; label: string; description: string }[] = [
  { value: 'critical', label: 'Critical', description: 'Core security or compliance policy' },
  { value: 'high', label: 'High', description: 'Important business rule' },
  { value: 'medium', label: 'Medium', description: 'Standard operational policy' },
  { value: 'low', label: 'Low', description: 'Advisory or informational' },
];

const steps: { id: Step; label: string; number: number }[] = [
  { id: 'metadata', label: 'Metadata', number: 1 },
  { id: 'code', label: 'Policy Code', number: 2 },
  { id: 'tests', label: 'Test Cases', number: 3 },
  { id: 'review', label: 'Review & Submit', number: 4 },
];

interface TestCaseForm {
  id: string;
  name: string;
  description: string;
  inputJson: string;
  expectedJson: string;
}

export function CreatePolicy() {
  const { resolvedTheme } = useUIStore();
  const { regoCode, setRegoCode, inputJson, setInputJson, configJson, setConfigJson, metadata, updateMetadata } = usePolicyStore();
  const { result, isEvaluating } = useEvaluationStore();
  const { setView } = useRegistryStore();
  const { evaluate } = useEvaluate();

  const [currentStep, setCurrentStep] = useState<Step>('metadata');
  const [category, setCategory] = useState<PolicyCategory>('access-control');
  const [severity, setSeverity] = useState<PolicySeverity>('medium');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [testCases, setTestCases] = useState<TestCaseForm[]>([]);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleAddTestCase = () => {
    setTestCases([
      ...testCases,
      {
        id: `test-${Date.now()}`,
        name: '',
        description: '',
        inputJson: '{}',
        expectedJson: '{"allow": true}',
      },
    ]);
  };

  const handleUpdateTestCase = (id: string, field: keyof TestCaseForm, value: string) => {
    setTestCases(testCases.map((tc) => (tc.id === id ? { ...tc, [field]: value } : tc)));
  };

  const handleRemoveTestCase = (id: string) => {
    setTestCases(testCases.filter((tc) => tc.id !== id));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'metadata':
        return metadata.name.trim() && metadata.description.trim();
      case 'code':
        return regoCode.trim().length > 0;
      case 'tests':
        return true; // Tests are optional
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = () => {
    // In a real app, this would submit to the backend
    alert('Policy submitted for review!');
    setView('policies');
  };

  return (
    <div className="h-full flex flex-col">
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
        <div className={cn(currentStep === 'code' ? 'max-w-none' : 'max-w-4xl mx-auto')}>
          {/* Step 1: Metadata */}
          {currentStep === 'metadata' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1">
                  Policy Information
                </h2>
                <p className="text-[var(--color-text-secondary)]">
                  Provide basic information about your policy
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    Policy Name *
                  </label>
                  <input
                    type="text"
                    value={metadata.name}
                    onChange={(e) => updateMetadata({ name: e.target.value })}
                    placeholder="e.g., Admin Access Control"
                    className={cn(
                      'w-full px-4 py-3 rounded-[var(--radius-md)]',
                      'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                      'border border-transparent focus:border-[var(--color-info)] focus:outline-none',
                      'placeholder:text-[var(--color-text-tertiary)]'
                    )}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    Description *
                  </label>
                  <textarea
                    value={metadata.description}
                    onChange={(e) => updateMetadata({ description: e.target.value })}
                    placeholder="Describe what this policy does and when it should be applied..."
                    rows={3}
                    className={cn(
                      'w-full px-4 py-3 rounded-[var(--radius-md)] resize-none',
                      'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                      'border border-transparent focus:border-[var(--color-info)] focus:outline-none',
                      'placeholder:text-[var(--color-text-tertiary)]'
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as PolicyCategory)}
                    className={cn(
                      'w-full px-4 py-3 rounded-[var(--radius-md)]',
                      'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                      'border border-transparent focus:border-[var(--color-info)] focus:outline-none'
                    )}
                  >
                    {categories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    Severity
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as PolicySeverity)}
                    className={cn(
                      'w-full px-4 py-3 rounded-[var(--radius-md)]',
                      'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                      'border border-transparent focus:border-[var(--color-info)] focus:outline-none'
                    )}
                  >
                    {severities.map((sev) => (
                      <option key={sev.value} value={sev.value}>
                        {sev.label} - {sev.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--color-info-bg)] text-[var(--color-info)] text-sm"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-[var(--color-error)]"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                      placeholder="Add a tag..."
                      className={cn(
                        'flex-1 px-4 py-2 rounded-[var(--radius-md)]',
                        'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                        'border border-transparent focus:border-[var(--color-info)] focus:outline-none',
                        'placeholder:text-[var(--color-text-tertiary)]'
                      )}
                    />
                    <button
                      onClick={handleAddTag}
                      className={cn(
                        'px-4 py-2 rounded-[var(--radius-md)]',
                        'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                        'hover:bg-[var(--color-border-light)] transition-colors'
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
                  <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1">
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
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        Runtime data passed to policy
                      </span>
                    </div>
                    <div className="flex-1 rounded-[var(--radius-lg)] border border-[var(--color-border-light)] overflow-hidden shadow-[var(--shadow-card)]">
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
                      <label className="text-sm font-medium text-[var(--color-text-primary)]">
                        Configuration
                      </label>
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        Static data available as "data"
                      </span>
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
                      <label className="text-sm font-medium text-[var(--color-text-primary)]">
                        Output
                      </label>
                      {result?.success && (
                        <span className="flex items-center gap-1 text-xs text-[var(--color-success)]">
                          <CheckCircle className="w-3 h-3" />
                          Evaluation successful
                        </span>
                      )}
                    </div>
                    <div
                      className={cn(
                        'flex-1 p-4 rounded-[var(--radius-lg)] border overflow-auto shadow-[var(--shadow-card)]',
                        result?.success
                          ? 'border-[var(--color-success)] bg-[var(--color-success-bg)]'
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

          {/* Step 3: Tests */}
          {currentStep === 'tests' && (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1">
                    Test Cases
                  </h2>
                  <p className="text-[var(--color-text-secondary)]">
                    Define test cases to validate your policy behavior
                  </p>
                </div>
                <button
                  onClick={handleAddTestCase}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)]',
                    'bg-[var(--color-info)] text-white font-medium',
                    'transition-all hover:opacity-90'
                  )}
                >
                  <Plus className="w-4 h-4" />
                  Add Test Case
                </button>
              </div>

              {testCases.length > 0 ? (
                <div className="space-y-4">
                  {testCases.map((test, index) => (
                    <div
                      key={test.id}
                      className="p-4 rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)]"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                          Test Case #{index + 1}
                        </span>
                        <button
                          onClick={() => handleRemoveTestCase(test.id)}
                          className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                          type="text"
                          value={test.name}
                          onChange={(e) => handleUpdateTestCase(test.id, 'name', e.target.value)}
                          placeholder="Test name"
                          className={cn(
                            'px-4 py-2 rounded-[var(--radius-md)]',
                            'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                            'border border-transparent focus:border-[var(--color-info)] focus:outline-none'
                          )}
                        />
                        <input
                          type="text"
                          value={test.description}
                          onChange={(e) => handleUpdateTestCase(test.id, 'description', e.target.value)}
                          placeholder="Description"
                          className={cn(
                            'px-4 py-2 rounded-[var(--radius-md)]',
                            'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                            'border border-transparent focus:border-[var(--color-info)] focus:outline-none'
                          )}
                        />
                        <div>
                          <label className="block text-xs text-[var(--color-text-tertiary)] mb-1">
                            Input JSON
                          </label>
                          <textarea
                            value={test.inputJson}
                            onChange={(e) => handleUpdateTestCase(test.id, 'inputJson', e.target.value)}
                            rows={3}
                            className={cn(
                              'w-full px-4 py-2 rounded-[var(--radius-md)] font-mono text-sm resize-none',
                              'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                              'border border-transparent focus:border-[var(--color-info)] focus:outline-none',
                              !isValidJson(test.inputJson) && 'border-[var(--color-error)]'
                            )}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-[var(--color-text-tertiary)] mb-1">
                            Expected Result
                          </label>
                          <textarea
                            value={test.expectedJson}
                            onChange={(e) => handleUpdateTestCase(test.id, 'expectedJson', e.target.value)}
                            rows={3}
                            className={cn(
                              'w-full px-4 py-2 rounded-[var(--radius-md)] font-mono text-sm resize-none',
                              'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                              'border border-transparent focus:border-[var(--color-info)] focus:outline-none',
                              !isValidJson(test.expectedJson) && 'border-[var(--color-error)]'
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-light)] text-[var(--color-text-tertiary)]">
                  <AlertCircle className="w-12 h-12 mb-3 opacity-50" />
                  <p className="font-medium">No test cases defined</p>
                  <p className="text-sm">Add test cases to validate your policy</p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 'review' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1">
                  Review & Submit
                </h2>
                <p className="text-[var(--color-text-secondary)]">
                  Review your policy before submitting for approval
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)]">
                  <h3 className="font-medium text-[var(--color-text-primary)] mb-3">Policy Details</h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-[var(--color-text-secondary)]">Name</dt>
                      <dd className="font-medium text-[var(--color-text-primary)]">{metadata.name || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[var(--color-text-secondary)]">Category</dt>
                      <dd className="font-medium text-[var(--color-text-primary)] capitalize">
                        {category.replace('-', ' ')}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[var(--color-text-secondary)]">Severity</dt>
                      <dd className="font-medium text-[var(--color-text-primary)] capitalize">{severity}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[var(--color-text-secondary)]">Test Cases</dt>
                      <dd className="font-medium text-[var(--color-text-primary)]">{testCases.length}</dd>
                    </div>
                  </dl>
                </div>

                <div className="p-4 rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)]">
                  <h3 className="font-medium text-[var(--color-text-primary)] mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {tags.length > 0 ? (
                      tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1 rounded-full text-xs bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-[var(--color-text-tertiary)]">No tags</span>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2 p-4 rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)]">
                  <h3 className="font-medium text-[var(--color-text-primary)] mb-3">Description</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {metadata.description || 'No description provided'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--color-border-light)] bg-[var(--color-surface)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
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
                'flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)]',
                'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
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
                  'flex items-center gap-2 px-6 py-2 rounded-[var(--radius-md)]',
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
                  'flex items-center gap-2 px-6 py-2 rounded-[var(--radius-md)]',
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
