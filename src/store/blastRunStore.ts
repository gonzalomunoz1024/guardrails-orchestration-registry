import { create } from 'zustand';
import { evaluationApi } from '@/services/api';
import { assembleInput, fetchDepsForDocument } from '@/utils';
import type { FetchedDep } from '@/utils';
import type { ExternalDependency, TestInput } from '@/types';
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
  /** Per-test snapshot of every external dep fetched for this run. */
  fetchedDeps?: FetchedDep[];
  /** The assembled input that was sent to OPA. Stored for triage. */
  bundleInput?: Record<string, unknown>;
}

interface StartArgs {
  testInputs: TestInput[];
  regoCode: string;
  configJson: string;
  configEnabled: boolean;
  externalDeps: ExternalDependency[];
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
  configEnabled: boolean;
  configuration: Record<string, unknown>;
  externalDeps: ExternalDependency[];
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

const initial = {
  status: 'idle' as const,
  runId: 0,
  guardrail: null,
  testInputs: [] as TestInput[],
  regoCode: '',
  configJson: '{}',
  configEnabled: false,
  configuration: {} as Record<string, unknown>,
  externalDeps: [] as ExternalDependency[],
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

  start: ({ testInputs, regoCode, configJson, configEnabled, externalDeps, guardrailInfo }) => {
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
      configEnabled,
      configuration,
      externalDeps,
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
          const document = (ti.input || {}) as Record<string, unknown>;

          // Per-test fetch of every configured external dep. Each dep's
          // params resolve against THIS document, so two test inputs that
          // reference different appIds get different external responses.
          const fetchedDeps = await fetchDepsForDocument(
            externalDeps,
            document,
            configuration
          );

          // If any required-looking dep fetched into an error, surface it
          // explicitly so the author can fix it; the OPA call would
          // otherwise see `input.external.<name>` as null and produce a
          // misleading verdict.
          const fatalError = fetchedDeps.find((d) => d.status === 'error');
          if (fatalError) {
            res = {
              testInputId: ti.id,
              status: 'error',
              error: `External dependency "${fatalError.name}" failed: ${fatalError.error}`,
              fetchedDeps,
              executionTimeMs: performance.now() - startTime,
            };
          } else {
            // Hydrate each ExternalDependency with the fetched response so
            // assembleInput places it under input.external.<name>.
            const depsForBundle: ExternalDependency[] = externalDeps.map((d) => {
              const f = fetchedDeps.find((x) => x.dep === d);
              return { ...d, data: f?.data ?? null, status: 'success' };
            });

            const bundle = assembleInput({
              resource: document,
              configuration: configEnabled ? configuration : undefined,
              externalDeps: depsForBundle,
              guardrail: guardrailInfo,
            });

            const response = await evaluationApi.evaluate(regoCode, bundle);
            const obj = response.result as Record<string, unknown> | undefined;
            const passed = obj?.allow === true || obj?.result === true;
            res = {
              testInputId: ti.id,
              status: passed ? 'passed' : 'failed',
              result: response.result,
              fetchedDeps,
              bundleInput: bundle,
              executionTimeMs: performance.now() - startTime,
            };
          }
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
