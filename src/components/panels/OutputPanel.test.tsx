import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { OutputPanel } from './OutputPanel';
import { useEvaluationStore } from '@/store';

describe('OutputPanel', () => {
  beforeEach(() => {
    useEvaluationStore.setState({
      result: null,
      isEvaluating: false,
      history: [],
    });
  });

  it('displays empty state when no result', () => {
    render(<OutputPanel />);
    expect(
      screen.getByText(/run the guardrail to see the decision/i)
    ).toBeInTheDocument();
  });

  it('displays loading state when evaluating', () => {
    useEvaluationStore.setState({ isEvaluating: true });
    render(<OutputPanel />);
    expect(screen.getByText(/evaluating guardrail/i)).toBeInTheDocument();
  });

  it('displays allowed state for successful allow decision', () => {
    useEvaluationStore.setState({
      result: {
        success: true,
        result: { allow: true },
        executionTime: 10,
      },
    });
    render(<OutputPanel />);
    expect(screen.getByText(/allowed/i)).toBeInTheDocument();
  });

  it('displays denied state for failed allow decision', () => {
    useEvaluationStore.setState({
      result: {
        success: true,
        result: { allow: false },
        executionTime: 10,
      },
    });
    render(<OutputPanel />);
    expect(screen.getByText(/denied/i)).toBeInTheDocument();
  });

  it('displays error state when evaluation fails', () => {
    useEvaluationStore.setState({
      result: {
        success: false,
        error: 'Policy syntax error',
      },
    });
    render(<OutputPanel />);
    expect(screen.getByText(/evaluation error/i)).toBeInTheDocument();
    expect(screen.getByText(/policy syntax error/i)).toBeInTheDocument();
  });
});
