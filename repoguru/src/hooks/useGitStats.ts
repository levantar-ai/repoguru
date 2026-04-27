import { useReducer, useCallback } from 'react';
import {
  BrowserAnalyzer,
  type BrowserAnalysisRunner,
  type BrowserGitStatsAnalysis,
} from '@repoguru/browser-adapter';
import type { GitStatsData, ProgressEvent } from '@repoguru/core';
import type { GitStatsState, GitStatsStep, GitStatsAnalysis } from '../types/gitStats';
import { browserAnalysisRunner } from '../services/analysis/browserAnalysisRunner';
import { invalidateIfDifferent } from '../services/git/repoCache';
import { useApp } from '../context/AppContext';
import { trackEvent } from '../utils/analytics';

type Action =
  | { type: 'RESET' }
  | { type: 'SET_STEP'; step: GitStatsStep; progress: number; message: string }
  | { type: 'CLONE_PROGRESS'; step: string; percent: number; subPercent: number; message: string }
  | { type: 'DONE'; analysis: GitStatsAnalysis | null; canonical: GitStatsData }
  | { type: 'ERROR'; error: string };

const initialState: GitStatsState = {
  step: 'idle',
  progress: 0,
  subProgress: 0,
  commitsFetched: 0,
  detailsFetched: 0,
  statusMessage: '',
  rawData: null,
  analysis: null,
  canonical: null,
  error: null,
};

function reducer(state: GitStatsState, action: Action): GitStatsState {
  switch (action.type) {
    case 'RESET':
      return initialState;
    case 'SET_STEP':
      return {
        ...state,
        step: action.step,
        progress: action.progress,
        statusMessage: action.message,
        error: null,
      };
    case 'CLONE_PROGRESS':
      return {
        ...state,
        step: action.step as GitStatsStep,
        progress: action.percent,
        subProgress: action.subPercent,
        statusMessage: action.message,
        error: null,
      };
    case 'DONE':
      return {
        ...state,
        step: 'done',
        progress: 100,
        statusMessage: 'Analysis complete',
        analysis: action.analysis,
        canonical: action.canonical,
      };
    case 'ERROR':
      return {
        ...state,
        step: 'error',
        error: action.error,
        statusMessage: '',
      };
    default:
      return state;
  }
}

function parseOwnerRepo(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim();

  const urlMatch = trimmed.match(/github\.com\/([^/]+)\/([^/\s#?]+)/);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/, '') };
  }

  const shortMatch = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2] };
  }

  return null;
}

function classifyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('too large')) return 'storage';
  if (m.includes('timed out')) return 'timeout';
  if (m.includes('not found')) return 'not-found';
  if (m.includes('rate limit')) return 'rate-limit';
  if (m.includes('invalid')) return 'auth';
  return 'unknown';
}

export function useGitStats() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { state: appState } = useApp();

  const analyze = useCallback(
    async (input: string) => {
      const parsed = parseOwnerRepo(input);
      if (!parsed) {
        dispatch({ type: 'ERROR', error: 'Invalid repo format. Use owner/repo or a GitHub URL.' });
        return;
      }

      const token = appState.githubToken || undefined;
      const { owner, repo } = parsed;
      const startTime = performance.now();
      const repoSlug = `${owner}/${repo}`;

      trackEvent('analysis_start', {
        tool: 'git-stats',
        repo: repoSlug,
        has_token: !!token,
      });

      invalidateIfDifferent(owner, repo);

      dispatch({
        type: 'SET_STEP',
        step: 'cloning',
        progress: 0,
        message: 'Cloning repository...',
      });

      // Wrap the singleton runner so we capture its resolved BrowserGitStatsAnalysis;
      // the analyzer itself only surfaces the canonical mapped shape, but downstream
      // consumers in this app still expect the legacy GitStatsAnalysis on `state.analysis`.
      let captured: BrowserGitStatsAnalysis | null = null;
      const wrappedRunner: BrowserAnalysisRunner = {
        async run(req, onProgress, signal) {
          const result = await browserAnalysisRunner.run(req, onProgress, signal);
          captured = result;
          return result;
        },
      };

      const analyzer = new BrowserAnalyzer(wrappedRunner);
      const canonical: GitStatsData = {};

      try {
        for await (const event of analyzer.analyze({
          source: repoSlug,
          ...(token ? { authToken: token } : {}),
        })) {
          if (event.kind === 'progress') {
            dispatchProgress(dispatch, event.event);
          } else if (event.kind === 'section') {
            (canonical as Record<string, unknown>)[event.section.name] = event.section.data;
          } else if (event.kind === 'done') {
            // event.data is the canonical aggregate; captured is the legacy shape.
            const duration = Math.round(performance.now() - startTime);
            trackEvent('analysis_complete', {
              tool: 'git-stats',
              repo: repoSlug,
              duration_ms: duration,
              has_token: !!token,
            });
            dispatch({
              type: 'DONE',
              analysis: captured as unknown as GitStatsAnalysis | null,
              canonical: event.data,
            });
          } else if (event.kind === 'error') {
            trackEvent('analysis_error', {
              tool: 'git-stats',
              repo: repoSlug,
              error_type: classifyError(event.error.message),
              browser: navigator.userAgent,
            });
            dispatch({ type: 'ERROR', error: event.error.message });
            return;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        trackEvent('analysis_error', {
          tool: 'git-stats',
          repo: repoSlug,
          error_type: classifyError(message),
          browser: navigator.userAgent,
        });
        dispatch({ type: 'ERROR', error: message });
      }
    },
    [appState.githubToken],
  );

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return { state, analyze, reset };
}

function dispatchProgress(dispatch: React.Dispatch<Action>, event: ProgressEvent): void {
  const percent = event.progress !== undefined ? Math.round(event.progress * 100) : 0;
  const subPercent = event.subProgress !== undefined ? Math.round(event.subProgress * 100) : 0;
  dispatch({
    type: 'CLONE_PROGRESS',
    step: event.phase,
    percent,
    subPercent,
    message: event.message,
  });
}
