import { create } from 'zustand';
import { evaluationApi } from '@/services/api';
import type { TestInput } from '@/types/registry.types';
import type { EnforcementType } from '@/types/guardrail.types';

export interface BlastGuardrailInfo {
  id: string;
  name: string;
  version: string;
  enforcementType: EnforcementType;
}

export type ExecutionStatus = 'pending' | 'running' | 'passed' | 'failed' | 'error';

export interface ExecutionResult {
  testInputId: string;
  status: ExecutionStatus;
  result?: unknown;
  error?: string;
  executionTimeMs?: number;
}

interface StartArgs {
  testInputs: TestInput[];
  regoCode: string;
  configJson: string;
  guardrailInfo: BlastGuardrailInfo;
}

interface BlastRunState {
  /** Lifecycle of the most recent run. */
  status: 'idle' | 'running' | 'done';
  runId: number;
  guardrail: BlastGuardrailInfo | null;
  testInputs: TestInput[];
  regoCode: string;
  configJson: string;
  configuration: Record<string, unknown>;
  results: Record<string, ExecutionResult>;
  currentIndex: number;
  total: number;
  startedAt: string | null;
  finishedAt: string | null;
  /** Increments on each completion — drives the completion toast. */
  finishedTick: number;
  /** True once the user has viewed the completed run (clears the red dot). */
  seen: boolean;

  start: (args: StartArgs) => void;
  markSeen: () => void;
  reset: () => void;
}

function buildInputBundle(
  testInputData: Record<string, unknown>,
  guardrailInfo: BlastGuardrailInfo,
  configuration: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...testInputData,
    guardrail: {
      id: guardrailInfo.id,
      name: guardrailInfo.name,
      version: guardrailInfo.version,
      enforcementType: guardrailInfo.enforcementType,
    },
    configuration,
  };
}

const initial = {
  status: 'idle' as const,
  runId: 0,
  guardrail: null,
  testInputs: [] as TestInput[],
  regoCode: '',
  configJson: '{}',
  configuration: {} as Record<string, unknown>,
  results: {} as Record<string, ExecutionResult>,
  currentIndex: 0,
  total: 0,
  startedAt: null,
  finishedAt: null,
  finishedTick: 0,
  seen: true,
};

export const useBlastRunStore = create<BlastRunState>((set, get) => ({
  ...initial,

  start: ({ testInputs, regoCode, configJson, guardrailInfo }) => {
    let configuration: Record<string, unknown> = {};
    try {
      configuration = JSON.parse(configJson || '{}');
    } catch {
      configuration = {};
    }

    const runId = get().runId + 1;
    set({
      status: 'running',
      runId,
      guardrail: guardrailInfo,
      testInputs,
      regoCode,
      configJson,
      configuration,
      results: {},
      currentIndex: 0,
      total: testInputs.length,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      seen: true,
    });

    void (async () => {
      for (let i = 0; i < testInputs.length; i++) {
        if (get().runId !== runId) return; // a newer run superseded this one
        const ti = testInputs[i];
        set((s) => ({
          currentIndex: i,
          results: { ...s.results, [ti.id]: { testInputId: ti.id, status: 'running' } },
        }));

        const startTime = performance.now();
        let res: ExecutionResult;
        try {
          const bundle = buildInputBundle(ti.input || {}, guardrailInfo, configuration);
          const response = await evaluationApi.evaluate(regoCode, bundle);
          const obj = response.result as Record<string, unknown> | undefined;
          const passed = obj?.allow === true || obj?.result === true;
          res = {
            testInputId: ti.id,
            status: passed ? 'passed' : 'failed',
            result: response.result,
            executionTimeMs: performance.now() - startTime,
          };
        } catch (e) {
          res = {
            testInputId: ti.id,
            status: 'error',
            error: e instanceof Error ? e.message : 'Unknown error',
            executionTimeMs: performance.now() - startTime,
          };
        }

        if (get().runId !== runId) return;
        set((s) => ({ results: { ...s.results, [ti.id]: res } }));
        await new Promise((r) => setTimeout(r, 100));
      }

      if (get().runId !== runId) return;
      set((s) => ({
        status: 'done',
        finishedAt: new Date().toISOString(),
        finishedTick: s.finishedTick + 1,
        seen: false,
      }));
    })();
  },

  markSeen: () => set({ seen: true }),
  reset: () => set({ ...initial }),
}));
