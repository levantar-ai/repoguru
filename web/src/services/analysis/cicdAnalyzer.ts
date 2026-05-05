import type { CategoryResult, FileContent, TreeEntry, Signal } from '../../types';
import { WORKFLOW_DIR } from '../../utils/constants';

export function analyzeCicd(files: FileContent[], tree: TreeEntry[]): CategoryResult {
  const signals: Signal[] = [];

  // GitHub Actions workflows
  const workflows = files.filter((f) => f.path.startsWith(WORKFLOW_DIR));
  const workflowPaths = tree.filter((e) => e.type === 'blob' && e.path.startsWith(WORKFLOW_DIR));
  signals.push({
    name: 'GitHub Actions workflows',
    found: workflowPaths.length > 0,
    details: `${workflowPaths.length} workflow file(s)`,
  });

  // CI workflow (test / build on push/PR)
  const hasCi = workflows.some(
    (f) =>
      (f.content.includes('push') || f.content.includes('pull_request')) &&
      (f.content.includes('test') || f.content.includes('build') || f.content.includes('ci')),
  );
  signals.push({ name: 'CI workflow (test/build)', found: hasCi });

  // Deploy / release workflow
  const hasDeploy = workflows.some(
    (f) =>
      f.path.toLowerCase().includes('deploy') ||
      f.path.toLowerCase().includes('release') ||
      f.content.includes('deploy') ||
      f.content.includes('publish'),
  );
  signals.push({ name: 'Deploy / release workflow', found: hasDeploy });

  // PR-triggered checks
  const hasPRTrigger = workflows.some((f) => f.content.includes('pull_request'));
  signals.push({ name: 'PR-triggered checks', found: hasPRTrigger });

  // Dockerfile
  const hasDocker = tree.some(
    (e) => e.type === 'blob' && (e.path === 'Dockerfile' || e.path.endsWith('/Dockerfile')),
  );
  signals.push({ name: 'Dockerfile', found: hasDocker });

  // Docker Compose
  const hasCompose = tree.some(
    (e) =>
      e.type === 'blob' && (e.path === 'docker-compose.yml' || e.path === 'docker-compose.yaml'),
  );
  signals.push({ name: 'Docker Compose', found: hasCompose });

  // Makefile
  const hasMakefile = tree.some((e) => e.type === 'blob' && e.path === 'Makefile');
  signals.push({ name: 'Makefile', found: hasMakefile });

  let score = 0;
  if (workflowPaths.length > 0) score += 25;
  if (hasCi) score += 25;
  if (hasDeploy) score += 15;
  if (hasPRTrigger) score += 15;
  if (hasDocker) score += 10;
  if (hasCompose) score += 5;
  if (hasMakefile) score += 5;

  return {
    key: 'cicd',
    label: 'CI/CD',
    score: Math.min(100, score),
    weight: 0.15,
    signals,
  };
}
