import type { CategoryResult, FileContent, TreeEntry, Signal } from '../../types';
import { detectProjectType, naReasonFor } from './projectType';
import { detectCI, detectDeployAutomation, detectsPRTriggeredCI } from './detectors/ci';

export function analyzeCicd(files: FileContent[], tree: TreeEntry[]): CategoryResult {
  const signals: Signal[] = [];
  const { type } = detectProjectType(files, tree);
  const treePaths = new Set(tree.filter((e) => e.type === 'blob').map((e) => e.path));
  const input = { files, tree, treePaths };

  // ── Universal CI/CD signals (apply to every project type) ──

  const ci = detectCI(input);
  signals.push({
    name: 'Continuous integration',
    found: ci.found,
    details: ci.found ? ci.tools.join(', ') : undefined,
  });

  const deploy = detectDeployAutomation(input);
  signals.push({
    name: 'Deployment automation',
    found: deploy.found,
    details: deploy.found ? deploy.tools.join(', ') : undefined,
  });

  const prChecks = detectsPRTriggeredCI(input);
  signals.push({
    name: 'Pre-merge checks',
    found: prChecks.found,
    details: prChecks.found ? prChecks.tools.join(', ') : undefined,
  });

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
    name: 'Container image build',
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
    name: 'Multi-service local dev',
    found: hasCompose,
    notApplicable: !dockerApplicable,
    notApplicableReason: dockerApplicable
      ? undefined
      : naReasonFor(type, `compose orchestrates multi-service local dev`),
  });

  // Build script / task runner. Generic "nice to have" — Make is one
  // option, but `package.json` scripts, `Taskfile.yml`, `just`, etc.
  // count too. Low weight on every project.
  const hasBuildScript =
    treePaths.has('Makefile') ||
    treePaths.has('Taskfile.yml') ||
    treePaths.has('Taskfile.yaml') ||
    treePaths.has('justfile') ||
    treePaths.has('Justfile') ||
    treePaths.has('mage.go');
  signals.push({
    name: 'Build / task runner',
    found: hasBuildScript,
  });

  // ── Scoring (re-normalised over APPLICABLE signals only) ──
  const weights: Record<string, number> = {
    'Continuous integration': 35,
    'Deployment automation': 20,
    'Pre-merge checks': 20,
    'Container image build': 10,
    'Multi-service local dev': 5,
    'Build / task runner': 10,
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
