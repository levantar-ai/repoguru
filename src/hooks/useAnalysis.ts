import { useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useAnalysisContext } from '../context/AnalysisContext';
import { parseRepoUrl } from '../services/github/parser';
import { githubFetch } from '../services/github/client';
import { fetchTree } from '../services/github/tree';
import { filterTargetFiles, fetchFileContents } from '../services/github/contents';
import { runAnalysis } from '../services/analysis/engine';
import { enrichWithLlm } from '../services/llm/client';
import { saveReport } from '../services/persistence/repoCache';
import { addHistoryEntry } from '../services/persistence/history';
import { invalidateIfDifferent } from '../services/git/repoCache';
import { ensureCloned } from '../services/git/cloneService';
import type { GitHubRepoResponse } from '../services/github/types';
import type { RepoInfo, CategoryKey, TreeEntry, FileContent } from '../types';

export function useAnalysis() {
  const { state: appState, dispatch: appDispatch, addRecentRepo } = useApp();
  const { state: analysisState, dispatch } = useAnalysisContext();

  const analyze = useCallback(
    async (input: string) => {
      dispatch({ type: 'RESET' });

      // Step 1: Parse URL
      dispatch({ type: 'SET_STEP', step: 'parsing', progress: 5 });
      const parsed = parseRepoUrl(input);
      if (!parsed) {
        dispatch({
          type: 'SET_ERROR',
          error: 'Invalid GitHub URL. Try: owner/repo or https://github.com/owner/repo',
        });
        return;
      }

      const token = appState.githubToken || undefined;
      const onRateLimit = (info: typeof appState.rateLimit) => {
        if (info) appDispatch({ type: 'SET_RATE_LIMIT', info });
      };

      try {
        // Step 2: Fetch repo info (stars, forks, topics — not available from clone)
        dispatch({ type: 'SET_STEP', step: 'fetching-info', progress: 10 });
        const raw = await githubFetch<GitHubRepoResponse>(
          `/repos/${parsed.owner}/${parsed.repo}`,
          token,
          onRateLimit,
        );

        const repoInfo: RepoInfo = {
          owner: raw.full_name.split('/')[0],
          repo: raw.name,
          defaultBranch: raw.default_branch,
          description: raw.description || '',
          stars: raw.stargazers_count,
          forks: raw.forks_count,
          openIssues: raw.open_issues_count,
          license: raw.license?.spdx_id || null,
          language: raw.language,
          createdAt: raw.created_at,
          updatedAt: raw.updated_at,
          topics: raw.topics || [],
          archived: raw.archived,
          size: raw.size,
        };

        const branch = parsed.branch || repoInfo.defaultBranch;

        let tree: TreeEntry[];
        let files: FileContent[];

        // Try clone-first approach
        try {
          dispatch({ type: 'SET_STEP', step: 'cloning', progress: 20 });
          invalidateIfDifferent(parsed.owner, parsed.repo);

          const cached = await ensureCloned(
            parsed.owner,
            parsed.repo,
            (_step, percent) => {
              // Scale clone progress from 20-60%
              const scaled = 20 + Math.round(percent * 0.4);
              dispatch({ type: 'SET_STEP', step: 'cloning', progress: scaled });
            },
            token,
          );

          tree = cached.tree;

          // Filter target files and find their contents from cache
          const targetPaths = filterTargetFiles(tree);
          dispatch({ type: 'SET_FILES_TOTAL', total: targetPaths.length });

          const targetPathSet = new Set(targetPaths);
          files = cached.files.filter((f) => targetPathSet.has(f.path));

          // Count files found for progress
          dispatch({ type: 'SET_STEP', step: 'fetching-files', progress: 65 });
          for (let i = 0; i < files.length; i++) {
            dispatch({ type: 'INCREMENT_FILES_FETCHED' });
          }
        } catch (cloneErr) {
          // Clone failed — fall back to API path if token available
          if (token) {
            console.warn('Clone failed, falling back to API:', cloneErr);

            dispatch({ type: 'SET_STEP', step: 'fetching-tree', progress: 25 });
            tree = await fetchTree(parsed.owner, parsed.repo, branch, token, onRateLimit);

            const targetFiles = filterTargetFiles(tree);
            dispatch({ type: 'SET_FILES_TOTAL', total: targetFiles.length });

            dispatch({ type: 'SET_STEP', step: 'fetching-files', progress: 35 });
            files = await fetchFileContents(
              parsed.owner,
              parsed.repo,
              branch,
              targetFiles,
              token,
              onRateLimit,
              () => {
                dispatch({ type: 'INCREMENT_FILES_FETCHED' });
              },
            );
          } else {
            throw cloneErr;
          }
        }

        // Step 6: Run analysis
        dispatch({ type: 'SET_STEP', step: 'analyzing', progress: 80 });
        let report = runAnalysis({ ...parsed, branch }, repoInfo, tree, files);

        // Step 7: Optional LLM enrichment
        if (appState.settings.llmMode === 'enriched' && appState.anthropicKey) {
          dispatch({ type: 'SET_STEP', step: 'llm-enrichment', progress: 90 });
          try {
            const insights = await enrichWithLlm(report, appState.anthropicKey);
            report = { ...report, llmInsights: insights };
          } catch (err) {
            // LLM enrichment is optional — don't fail the whole analysis
            console.warn('LLM enrichment failed:', err);
          }
        }

        // Step 8: Cache and finish
        dispatch({ type: 'SET_REPORT', report });

        // Persist
        try {
          await saveReport(report);
          addRecentRepo({
            owner: parsed.owner,
            repo: parsed.repo,
            grade: report.grade,
            analyzedAt: report.analyzedAt,
            overallScore: report.overallScore,
          });
          // Save history entry for trend tracking
          const categoryScores = {} as Record<CategoryKey, number>;
          for (const cat of report.categories) {
            categoryScores[cat.key] = cat.score;
          }
          addHistoryEntry({
            owner: parsed.owner,
            repo: parsed.repo,
            overallScore: report.overallScore,
            grade: report.grade,
            categoryScores,
            analyzedAt: report.analyzedAt,
          });
        } catch {
          // Persistence is optional
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        dispatch({ type: 'SET_ERROR', error: message });
      }
    },
    [appState, appDispatch, dispatch, addRecentRepo],
  );

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  return { state: analysisState, analyze, reset };
}
