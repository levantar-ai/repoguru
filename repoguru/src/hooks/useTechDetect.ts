import { useReducer, useCallback } from 'react';
import type { TechDetectState, TechDetectStep, TechDetectResult } from '../types/techDetect';
import {
  detectAWS,
  detectPython,
  detectAzure,
  detectGCP,
  detectGo,
  detectJava,
  detectNode,
  detectPHP,
  detectRust,
  detectRuby,
  detectFrameworks,
  detectDatabases,
  detectCicd,
  detectTesting,
} from '../services/analysis/techDetectEngine';
import { useApp } from '../context/AppContext';
import { invalidateIfDifferent } from '../services/git/repoCache';
import { ensureCloned } from '../services/git/cloneService';
import { computeLanguages } from '../services/git/extractors';
import { humanizeCloneError, formatHumanizedError } from '../utils/humanizeError';
import { trackEvent } from '../utils/analytics';

type Action =
  | { type: 'RESET' }
  | {
      type: 'SET_STEP';
      step: TechDetectStep;
      progress: number;
      subProgress?: number;
      message: string;
    }
  | { type: 'DONE'; result: TechDetectResult }
  | { type: 'ERROR'; error: string };

const initialState: TechDetectState = {
  step: 'idle',
  progress: 0,
  subProgress: 0,
  statusMessage: '',
  result: null,
  error: null,
};

function reducer(state: TechDetectState, action: Action): TechDetectState {
  switch (action.type) {
    case 'RESET':
      return initialState;
    case 'SET_STEP':
      return {
        ...state,
        step: action.step,
        progress: action.progress,
        subProgress: action.subProgress ?? 0,
        statusMessage: action.message,
        error: null,
      };
    case 'DONE':
      return {
        ...state,
        step: 'done',
        progress: 100,
        statusMessage: 'Analysis complete',
        result: action.result,
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

export function useTechDetect() {
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

      trackEvent('analysis_start', {
        tool: 'tech-detect',
        repo: `${owner}/${repo}`,
        has_token: !!token,
      });

      try {
        let techPaths: string[];
        let fileInputs: { path: string; content: string }[];
        let totalFiles = 0;
        let languages: Record<string, number> = {};

        try {
          dispatch({
            type: 'SET_STEP',
            step: 'fetching-tree',
            progress: 10,
            message: 'Cloning repository...',
          });
          invalidateIfDifferent(owner, repo);

          const cached = await ensureCloned(
            owner,
            repo,
            (_step, percent, subPercent, message) => {
              const scaled = 10 + Math.round(percent * 0.4);
              dispatch({
                type: 'SET_STEP',
                step: 'fetching-tree',
                progress: scaled,
                subProgress: subPercent,
                message,
              });
            },
            token,
          );

          // All files are already available from clone — pass everything to detectors
          totalFiles = cached.files.length;
          dispatch({
            type: 'SET_STEP',
            step: 'fetching-files',
            progress: 55,
            message: `Scanning ${totalFiles} files from clone...`,
          });

          techPaths = cached.files.map((f) => f.path);
          fileInputs = cached.files.map((f) => ({ path: f.path, content: f.content }));

          // Compute language breakdown from all blob paths in tree for more complete counts
          const allBlobPaths = cached.tree.filter((e) => e.type === 'blob').map((e) => e.path);
          languages = computeLanguages(allBlobPaths);
        } catch (cloneErr) {
          const msg = cloneErr instanceof Error ? cloneErr.message : 'Unknown error';
          const humanized = humanizeCloneError(msg);
          trackEvent('analysis_error', {
            tool: 'tech-detect',
            repo: `${owner}/${repo}`,
            error_type: humanized.title.includes('too large')
              ? 'storage'
              : humanized.title.includes('timed out')
                ? 'timeout'
                : humanized.title.includes('not found')
                  ? 'not-found'
                  : humanized.title.includes('rate limit')
                    ? 'rate-limit'
                    : humanized.title.includes('invalid')
                      ? 'auth'
                      : 'unknown',
            browser: navigator.userAgent,
          });
          dispatch({ type: 'ERROR', error: formatHumanizedError(humanized) });
          return;
        }

        // 5. Run analysis
        dispatch({
          type: 'SET_STEP',
          step: 'analyzing',
          progress: 80,
          message: 'Analyzing technologies...',
        });
        await new Promise((resolve) => setTimeout(resolve, 10));

        const aws = detectAWS(fileInputs);
        const azure = detectAzure(fileInputs);
        const gcp = detectGCP(fileInputs);
        const python = detectPython(fileInputs);
        const node = detectNode(fileInputs);
        const go = detectGo(fileInputs);
        const java = detectJava(fileInputs);
        const php = detectPHP(fileInputs);
        const rust = detectRust(fileInputs);
        const ruby = detectRuby(fileInputs);
        const frameworks = detectFrameworks(fileInputs);
        const databases = detectDatabases(fileInputs);
        const cicd = detectCicd(fileInputs);
        const testing = detectTesting(fileInputs);

        const duration = Math.round(performance.now() - startTime);
        trackEvent('analysis_complete', {
          tool: 'tech-detect',
          repo: `${owner}/${repo}`,
          duration_ms: duration,
          has_token: !!token,
        });

        dispatch({
          type: 'DONE',
          result: {
            aws,
            azure,
            gcp,
            python,
            node,
            go,
            java,
            php,
            rust,
            ruby,
            frameworks,
            databases,
            cicd,
            testing,
            languages,
            manifestFiles: techPaths,
            totalFiles,
          },
        });
      } catch (err) {
        trackEvent('analysis_error', {
          tool: 'tech-detect',
          repo: `${owner}/${repo}`,
          error_type: 'unknown',
          browser: navigator.userAgent,
        });
        dispatch({
          type: 'ERROR',
          error: err instanceof Error ? err.message : 'An unexpected error occurred.',
        });
      }
    },
    [appState.githubToken],
  );

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return { state, analyze, reset };
}
