import { useState, useCallback, useRef, useEffect } from 'react';
import { useRepoGuru } from '../services/Provider.js';
import { OrgScanView } from '../views/OrgScanView.js';
import { PageContainer } from '../chrome/PageContainer.js';
import { PageHero } from '../chrome/PageHero.js';
import { PrimaryButton, SecondaryButton } from '../chrome/Buttons.js';
import { LoadingPanel, ErrorPanel } from '../chrome/StatusPanels.js';
import type { OrgScanResult, OrgScanProgress } from '../services/types.js';

type Step = 'idle' | 'loading' | 'done' | 'error';

interface State {
  step: Step;
  progress: OrgScanProgress | null;
  message: string;
  result: OrgScanResult | null;
  error: string | null;
}

/** Authoritative Org Scan page. Both hosts mount this same React file —
 *  services.orgScan injects the host's bulk-analyse engine (browser:
 *  paginated GitHub API + light analysis per repo; desktop: gRPC
 *  ScanOrg streaming RPC against the CLI). */
export function OrgScanPage() {
  const { orgScan, repoBrowse } = useRepoGuru();
  const currentLogin = repoBrowse.currentUser?.()?.login ?? '';
  // Pre-fill with the signed-in user's login when authed. Use a lazy
  // initialiser AND a one-shot effect for the case where the /user
  // fetch hasn't resolved by first render — auto-fill if the user
  // hasn't started typing yet, but never overwrite once they have.
  const [target, setTarget] = useState(currentLogin);
  useEffect(() => {
    if (currentLogin && !target) setTarget(currentLogin);
    // intentionally only dependent on currentLogin so we don't re-run
    // every keystroke and clobber the user's typing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLogin]);
  const [skipForks, setSkipForks] = useState(true);
  const [skipArchived, setSkipArchived] = useState(true);
  const [maxRepos, setMaxRepos] = useState(0);
  const [state, setState] = useState<State>({
    step: 'idle',
    progress: null,
    message: '',
    result: null,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const handleScan = useCallback(async () => {
    if (!target.trim()) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ step: 'loading', progress: null, message: 'Starting scan...', result: null, error: null });
    try {
      const result = await orgScan.run(
        { target: target.trim(), skipForks, skipArchived, maxRepos: maxRepos || undefined },
        {
          signal: controller.signal,
          onProgress: (p) =>
            setState((prev) =>
              prev.step === 'loading'
                ? {
                    ...prev,
                    progress: p,
                    message: p.phase === 'listing'
                      ? 'Listing repositories...'
                      : `Analyzing ${p.currentRepo || `repo ${p.completed + 1}/${p.total}`}...`,
                  }
                : prev,
            ),
        },
      );
      setState({ step: 'done', progress: null, message: '', result, error: null });
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setState({
        step: 'error',
        progress: null,
        message: '',
        result: null,
        error: err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    }
  }, [target, skipForks, skipArchived, maxRepos, orgScan]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setState({ step: 'idle', progress: null, message: '', result: null, error: null });
  }, []);

  return (
    <PageContainer>
      <PageHero
        title="Score every repo in your"
        highlight="organisation."
        subtitle="One letter grade per repo. Rank by health, find the F-graded outliers, focus where it counts."
      />

      {state.step === 'idle' && (
        <div className="mb-8 max-w-4xl mx-auto space-y-4">
          <div>
            <label htmlFor="org-target" className="block text-sm font-medium text-text-secondary mb-1.5">
              Organization or Username
            </label>
            <input
              id="org-target"
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="e.g. facebook"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleScan();
              }}
              className="w-full px-4 py-3 rounded-xl bg-surface-alt border border-border text-text placeholder-text-muted focus:outline-none focus:border-border-bright focus:ring-1 focus:ring-border-bright transition-colors disabled:opacity-50"
            />
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-text-secondary">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={skipForks} onChange={(e) => setSkipForks(e.target.checked)} />
              Skip forks
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={skipArchived}
                onChange={(e) => setSkipArchived(e.target.checked)}
              />
              Skip archived
            </label>
            <div className="flex items-center gap-1.5">
              <span>Max repos:</span>
              <input
                type="number"
                value={maxRepos || ''}
                onChange={(e) => setMaxRepos(Number(e.target.value) || 0)}
                placeholder="all"
                className="w-16 px-2 py-1 rounded bg-surface-alt border border-border text-text-secondary"
              />
            </div>
          </div>

          <div className="flex justify-center">
            <PrimaryButton onClick={handleScan} disabled={!target.trim()}>
              Scan Organization
            </PrimaryButton>
          </div>
        </div>
      )}

      {state.step === 'loading' && (
        <>
          <LoadingPanel message={state.message} />
          {state.progress && state.progress.total > 0 && (
            <div className="max-w-4xl mx-auto -mt-8 mb-8">
              <div className="h-2 rounded-full bg-surface-alt overflow-hidden border border-border">
                <div
                  className="h-full bg-neon transition-all duration-300"
                  style={{ width: `${(state.progress.completed / state.progress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-text-muted mt-1.5 text-center">
                {state.progress.completed} / {state.progress.total} repos
              </p>
            </div>
          )}
        </>
      )}

      {state.step === 'error' && state.error && (
        <ErrorPanel
          title="Scan failed"
          message={state.error}
          action={<SecondaryButton onClick={handleReset}>Try again</SecondaryButton>}
        />
      )}

      {state.step === 'done' && state.result && (
        <OrgScanView
          items={state.result.items}
          summary={state.result.summary}
          actions={<SecondaryButton onClick={handleReset}>New Scan</SecondaryButton>}
        />
      )}
    </PageContainer>
  );
}
