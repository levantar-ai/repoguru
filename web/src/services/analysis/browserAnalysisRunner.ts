// Adapts the in-browser clone+analyze pipeline to the BrowserAnalysisRunner
// interface from @repoguru/browser-adapter. The adapter needs a runner it
// can drive; this is the host-supplied piece that owns isomorphic-git,
// lightning-fs, and the GitHub services.
//
// No behaviour change vs. calling cloneAndExtract + analyzeGitStats directly
// — this just reshapes progress callbacks and surfaces failures as
// AnalyzeError so the unified analyzer event stream stays well-typed.

import { AnalyzeError, type AnalyzeRequest, type ProgressEvent } from '@repoguru/core';
import type { BrowserAnalysisRunner, BrowserGitStatsAnalysis } from '@repoguru/browser-adapter';
import { cloneAndExtract } from '../git/cloneService';
import { analyzeGitStats } from './gitStatsAnalyzer';
import { humanizeCloneError, formatHumanizedError } from '../../utils/humanizeError';

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

export const browserAnalysisRunner: BrowserAnalysisRunner = {
  async run(
    request: AnalyzeRequest,
    onProgress: (event: ProgressEvent) => void,
  ): Promise<BrowserGitStatsAnalysis> {
    const parsed = parseOwnerRepo(request.source);
    if (!parsed) {
      throw new AnalyzeError(
        'invalid_source',
        'Invalid repo format. Use owner/repo or a GitHub URL.',
      );
    }
    const { owner, repo } = parsed;

    let rawData;
    try {
      rawData = await cloneAndExtract(
        owner,
        repo,
        (step, percent, subPercent, message) => {
          onProgress({
            phase: step,
            message,
            progress: percent / 100,
            subProgress: subPercent / 100,
          });
        },
        request.authToken,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      const humanized = humanizeCloneError(msg);
      throw new AnalyzeError('clone_failed', formatHumanizedError(humanized), humanized.tip);
    }

    onProgress({
      phase: 'analyzing',
      message: 'Analyzing data...',
      progress: 0.88,
    });
    // Yield the event loop before the synchronous analysis so the UI can paint.
    await new Promise((resolve) => setTimeout(resolve, 10));

    const analysis = analyzeGitStats(rawData, owner, repo);
    return analysis as unknown as BrowserGitStatsAnalysis;
  },
};
