import { create } from 'zustand';
import type { EvaluationResult } from '@/types';

interface EvaluationState {
  result: EvaluationResult | null;
  isEvaluating: boolean;
  history: EvaluationResult[];

  setResult: (result: EvaluationResult) => void;
  setIsEvaluating: (isEvaluating: boolean) => void;
  clearResult: () => void;
  clearHistory: () => void;
}

export const useEvaluationStore = create<EvaluationState>((set) => ({
  result: null,
  isEvaluating: false,
  history: [],

  setResult: (result) =>
    set((state) => ({
      result,
      history: [result, ...state.history].slice(0, 50),
    })),
  setIsEvaluating: (isEvaluating) => set({ isEvaluating }),
  clearResult: () => set({ result: null }),
  clearHistory: () => set({ history: [] }),
}));
