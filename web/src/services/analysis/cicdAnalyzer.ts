import type { CategoryResult, FileContent, TreeEntry, Signal } from '../../types';
import { WORKFLOW_DIR } from '../../utils/constants';
import { detectProjectType, naReasonFor } from './projectType';

export function analyzeCicd(files: FileContent[], tree: TreeEntry[]): CategoryResult {
  const signals: Signal[] = [];
  const { type } = detectProjectType(files, tree);

  // ── Universal CI/CD signals (apply to every project type) ──

  const workflows = files.filter((f) => f.path.startsWith(WORKFLOW_DIR));
  const workflowPaths = tree.filter((e) => e.type === 'blob' && e.path.startsWith(WORKFLOW_DIR));
  signals.push({
    name: 'GitHub Actions workflows',
    found: workflowPaths.length > 0,
    details: `${workflowPaths.length} workflow file(s)`,
  });

  const hasCi = workflows.some(
    (f) =>
      (f.content.includes('push') || f.content.includes('pull_request')) &&
      (f.content.includes('test') || f.content.includes('build') || f.content.includes('ci')),
  );
  signals.push({ name: 'CI workflow (test/build)', found: hasCi });

  const hasDeploy = workflows.some(
    (f) =>
      f.path.toLowerCase().includes('deploy') ||
      f.path.toLowerCase().includes('release') ||
      f.content.includes('deploy') ||
      f.content.includes('publish'),
  );
  signals.push({ name: 'Deploy / release workflow', found: hasDeploy });

  const hasPRTrigger = workflows.some((f) => f.content.includes('pull_request'));
  signals.push({ name: 'PR-triggered checks', found: hasPRTrigger });

  // ── Project-type-aware signals ──
  // Dockerfile / Docker Compose are deployment-environment concerns, not
  // CI/CD per se. They only matter for server-class projects (or unknown,
  // where we still surface them as "missing" because we can't rule out
  // server use). For libraries, CLIs, frontends, docs sites they're
  // irrelevant — marking N/A means the view hides them AND scoring
  // re-normalises so their absence isn't penalised.

  const dockerApplicable = type === 'server' || type === 'unknown';
  const hasDocker = tree.some(
    (e) => e.type === 'blob' && (e.path === 'Dockerfile' || e.path.endsWith('/Dockerfile')),
  );
  signals.push({
    name: 'Dockerfile',
    found: hasDocker,
    notApplicable: !dockerApplicable,
    notApplicableReason: dockerApplicable
      ? undefined
      : naReasonFor(type, `containerisation only matters for server apps`),
  });

  const hasCompose = tree.some(
    (e) =>
      e.type === 'blob' && (e.path === 'docker-compose.yml' || e.path === 'docker-compose.yaml'),
  );
  signals.push({
    name: 'Docker Compose',
    found: hasCompose,
    notApplicable: !dockerApplicable,
    notApplicableReason: dockerApplicable
      ? undefined
      : naReasonFor(type, `compose orchestrates multi-service local dev`),
  });

  // Makefile — universal "nice to have" for cross-language builds. Keep
  // shown for everyone (very low weight); some languages (Go, C/C++)
  // genuinely benefit, but we don't autodetect that yet.
  const hasMakefile = tree.some((e) => e.type === 'blob' && e.path === 'Makefile');
  signals.push({ name: 'Makefile', found: hasMakefile });

  // ── Scoring (re-normalised over APPLICABLE signals only) ──
  // Each signal's weight is fixed; if a signal is N/A its weight is
  // dropped and the achieved score is rescaled against the remaining
  // applicable budget. Net effect: a library missing Dockerfile gets
  // the same score it would have got if Dockerfile didn't exist as a
  // signal — instead of a 10-point penalty.
  const weights: Record<string, number> = {
    'GitHub Actions workflows': 25,
    'CI workflow (test/build)': 25,
    'Deploy / release workflow': 15,
    'PR-triggered checks': 15,
    Dockerfile: 10,
    'Docker Compose': 5,
    Makefile: 5,
  };
  let achieved = 0;
  let applicable = 0;
  for (const sig of signals) {
    if (sig.notApplicable) continue;
    const w = weights[sig.name] ?? 0;
    applicable += w;
    if (sig.found) achieved += w;
  }
  const score = applicable === 0 ? 0 : Math.round((achieved / applicable) * 100);

  return {
    key: 'cicd',
    label: 'CI/CD',
    score: Math.min(100, score),
    weight: 0.15,
    signals,
  };
}
