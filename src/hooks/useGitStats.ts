import { useReducer, useCallback } from 'react';
import type { RateLimitInfo } from '../types';
import type { GitStatsState, GitStatsStep } from '../types/gitStats';
import { fetchGitStatsData } from '../services/github/stats';
import { cloneAndExtract } from '../services/git/cloneService';
import { analyzeGitStats } from '../services/analysis/gitStatsAnalyzer';
import { invalidateIfDifferent } from '../services/git/repoCache';
import { useApp } from '../context/AppContext';

type Action =
  | { type: 'RESET' }
  | { type: 'SET_STEP'; step: GitStatsStep; progress: number; message: string }
  | { type: 'CLONE_PROGRESS'; step: string; percent: number; message: string }
  | { type: 'COMMITS_PROGRESS'; count: number }
  | { type: 'DETAILS_PROGRESS'; count: number }
  | { type: 'DONE'; analysis: GitStatsState['analysis']; rawData: GitStatsState['rawData'] }
  | { type: 'ERROR'; error: string };

const initialState: GitStatsState = {
  step: 'idle',
  progress: 0,
  commitsFetched: 0,
  detailsFetched: 0,
  statusMessage: '',
  rawData: null,
  analysis: null,
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
        statusMessage: action.message,
        error: null,
      };
    case 'COMMITS_PROGRESS':
      return {
        ...state,
        commitsFetched: action.count,
        progress: Math.min(40, (action.count / 1000) * 40),
        statusMessage: `Fetching commits... ${action.count} found`,
      };
    case 'DETAILS_PROGRESS':
      return {
        ...state,
        detailsFetched: action.count,
        progress: 40 + Math.min(30, (action.count / 200) * 30),
        statusMessage: `Fetching commit details... ${action.count}`,
      };
    case 'DONE':
      return {
        ...state,
        step: 'done',
        progress: 100,
        statusMessage: 'Analysis complete',
        rawData: action.rawData,
        analysis: action.analysis,
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

  // Full URL: https://github.com/owner/repo
  const urlMatch = trimmed.match(/github\.com\/([^/]+)\/([^/\s#?]+)/);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/, '') };
  }

  // Shorthand: owner/repo
  const shortMatch = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2] };
  }

  return null;
}

export function useGitStats() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { state: appState, dispatch: appDispatch } = useApp();

  const handleRateLimit = useCallback(
    (info: RateLimitInfo) => {
      appDispatch({ type: 'SET_RATE_LIMIT', info });
    },
    [appDispatch],
  );

  const analyze = useCallback(
    async (input: string) => {
      const parsed = parseOwnerRepo(input);
      if (!parsed) {
        dispatch({ type: 'ERROR', error: 'Invalid repo format. Use owner/repo or a GitHub URL.' });
        return;
      }

      const token = appState.githubToken || undefined;
      const { owner, repo } = parsed;

      // Invalidate cache if different repo
      invalidateIfDifferent(owner, repo);

      // Try clone-first approach (no token needed for public repos)
      dispatch({
        type: 'SET_STEP',
        step: 'cloning',
        progress: 0,
        message: 'Cloning repository...',
      });

      let rawData;

      try {
        rawData = await cloneAndExtract(
          owner,
          repo,
          (step, percent, message) => {
            dispatch({ type: 'CLONE_PROGRESS', step, percent, message });
          },
          token,
        );
      } catch (cloneErr) {
        // Clone failed — fall back to REST API if token is available
        if (token) {
          console.warn('Clone failed, falling back to REST API:', cloneErr);

          dispatch({
            type: 'SET_STEP',
            step: 'fetching-commits',
            progress: 0,
            message: 'Clone failed, fetching via API...',
          });

          try {
            rawData = await fetchGitStatsData(
              owner,
              repo,
              token,
              handleRateLimit,
              (count) => dispatch({ type: 'COMMITS_PROGRESS', count }),
              (count) => dispatch({ type: 'DETAILS_PROGRESS', count }),
              () =>
                dispatch({
                  type: 'SET_STEP',
                  step: 'fetching-stats',
                  progress: 72,
                  message: 'Fetching repository statistics...',
                }),
            );
          } catch (apiErr) {
            dispatch({
              type: 'ERROR',
              error: apiErr instanceof Error ? apiErr.message : 'An unexpected error occurred.',
            });
            return;
          }
        } else {
          dispatch({
            type: 'ERROR',
            error:
              cloneErr instanceof Error
                ? `Clone failed: ${cloneErr.message}. Add a GitHub token in Settings to use the API fallback.`
                : 'Clone failed. Add a GitHub token in Settings to use the API fallback.',
          });
          return;
        }
      }

      dispatch({
        type: 'SET_STEP',
        step: 'analyzing',
        progress: 88,
        message: 'Analyzing data...',
      });

      // Run analysis (synchronous, but we yield the event loop)
      await new Promise((resolve) => setTimeout(resolve, 10));
      const analysis = analyzeGitStats(rawData, owner, repo);

      dispatch({ type: 'DONE', analysis, rawData });
    },
    [appState.githubToken, handleRateLimit],
  );

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return { state, analyze, reset };
}
