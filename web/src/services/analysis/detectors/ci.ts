import type { DetectorInput, DetectionResult } from './types';

/** Detects a continuous-integration setup, regardless of which platform
 *  hosts it. Goal: a repo on GitLab with `.gitlab-ci.yml` should not be
 *  penalised for not having `.github/workflows/`. Order matters only
 *  for the `details` string — the first matched tool wins the label. */

interface CISignature {
  name: string;
  /** Match by exact tree path (case-sensitive — most CI configs are). */
  paths?: string[];
  /** Match when any tree path starts with this prefix (for dir-based
   *  configs like .github/workflows/ or .circleci/). */
  pathPrefixes?: string[];
}

const CI_SIGNATURES: CISignature[] = [
  { name: 'GitHub Actions', pathPrefixes: ['.github/workflows/'] },
  { name: 'GitLab CI', paths: ['.gitlab-ci.yml', '.gitlab-ci.yaml'] },
  { name: 'CircleCI', pathPrefixes: ['.circleci/'] },
  { name: 'Travis CI', paths: ['.travis.yml'] },
  { name: 'Jenkins', paths: ['Jenkinsfile', 'jenkinsfile'] },
  { name: 'Buildkite', pathPrefixes: ['.buildkite/'] },
  { name: 'Drone', paths: ['.drone.yml', '.drone.yaml'] },
  { name: 'Woodpecker', paths: ['.woodpecker.yml', '.woodpecker.yaml'] },
  { name: 'Azure Pipelines', paths: ['azure-pipelines.yml', 'azure-pipelines.yaml'] },
  { name: 'Bitbucket Pipelines', paths: ['bitbucket-pipelines.yml'] },
  { name: 'AppVeyor', paths: ['appveyor.yml', '.appveyor.yml'] },
  { name: 'TeamCity', pathPrefixes: ['.teamcity/'] },
];

export function detectCI(input: DetectorInput): DetectionResult {
  const tools: string[] = [];
  for (const sig of CI_SIGNATURES) {
    const hit =
      sig.paths?.some((p) => input.treePaths.has(p)) ||
      sig.pathPrefixes?.some((prefix) =>
        input.tree.some((e) => e.type === 'blob' && e.path.startsWith(prefix)),
      );
    if (hit) tools.push(sig.name);
  }
  return { found: tools.length > 0, tools };
}

/** Returns true if any CI config appears to wire up pre-merge / PR
 *  checks. Without file content (light engine) we can't be certain, so
 *  this is content-required — light callers should skip or fall back. */
export function detectsPRTriggeredCI(input: DetectorInput): DetectionResult {
  if (input.files.length === 0) return { found: false, tools: [] };
  const tools: string[] = [];

  // GitHub Actions: workflows with `pull_request:` trigger
  const ghWorkflows = input.files.filter((f) => f.path.startsWith('.github/workflows/'));
  if (ghWorkflows.some((f) => /\bpull_request(?:_target)?\b/.test(f.content))) {
    tools.push('GitHub Actions');
  }

  // GitLab CI: merge-request pipelines
  const gitlab = input.files.find(
    (f) => f.path === '.gitlab-ci.yml' || f.path === '.gitlab-ci.yaml',
  );
  if (gitlab && /merge_request|merge-request/.test(gitlab.content)) {
    tools.push('GitLab CI');
  }

  // CircleCI / Drone / Woodpecker — most configs run on every PR by
  // default unless the user excludes branches, so the *absence* of an
  // exclude is the signal we'd want. Out of scope for this pass; if
  // any of those are detected as the CI tool, we assume PR coverage.
  const ciResult = detectCI(input);
  for (const t of ciResult.tools) {
    if (
      (t === 'CircleCI' || t === 'Drone' || t === 'Woodpecker' || t === 'Buildkite') &&
      !tools.includes(t)
    ) {
      tools.push(t);
    }
  }

  return { found: tools.length > 0, tools };
}

/** Detects a deploy / release pipeline of any kind. Looks at CI
 *  filenames + content keywords across platforms. */
export function detectDeployAutomation(input: DetectorInput): DetectionResult {
  const tools: string[] = [];

  // Filename hints across platforms.
  const deployByName = input.tree.some(
    (e) =>
      e.type === 'blob' &&
      (e.path.startsWith('.github/workflows/') ||
        e.path.startsWith('.gitlab-ci') ||
        e.path.startsWith('.circleci/') ||
        e.path === 'Jenkinsfile' ||
        e.path === '.travis.yml' ||
        e.path.startsWith('.buildkite/')) &&
      /(deploy|release|publish|cd)\b/i.test(e.path),
  );
  if (deployByName) tools.push('CI workflow named for deploy/release');

  // Content hints (needs full engine).
  if (input.files.length > 0) {
    const contentHit = input.files.some(
      (f) =>
        (f.path.startsWith('.github/workflows/') ||
          f.path.startsWith('.gitlab-ci') ||
          f.path.startsWith('.circleci/') ||
          f.path === 'Jenkinsfile' ||
          f.path === '.travis.yml') &&
        /\b(deploy|publish|release|semantic-release|goreleaser|cargo publish|npm publish|aws s3 sync|wrangler|vercel deploy|netlify deploy|terraform apply)\b/i.test(
          f.content,
        ),
    );
    if (contentHit && !tools.includes('CI workflow with deploy step')) {
      tools.push('CI workflow with deploy step');
    }
  }

  // Standalone release tooling — often referenced from CI but worth
  // crediting if present even without a workflow.
  if (input.treePaths.has('.goreleaser.yml') || input.treePaths.has('.goreleaser.yaml')) {
    tools.push('GoReleaser');
  }
  if (input.treePaths.has('.releaserc') || input.treePaths.has('.releaserc.json')) {
    tools.push('semantic-release');
  }

  return { found: tools.length > 0, tools };
}
