import type { DetectorInput, DetectionResult } from './types';

/** Detects an automated dependency-update workflow of any kind. The
 *  outcome here is "outdated deps get a PR / MR raised automatically",
 *  regardless of vendor. */
export function detectDependencyUpdates(input: DetectorInput): DetectionResult {
  const tools: string[] = [];

  // Dependabot — GitHub-hosted but readable from any forge.
  if (
    input.treePaths.has('.github/dependabot.yml') ||
    input.treePaths.has('.github/dependabot.yaml')
  ) {
    tools.push('Dependabot');
  }

  // Renovate — supports the broadest range of config locations.
  const renovateConfigs = [
    'renovate.json',
    'renovate.json5',
    '.renovaterc',
    '.renovaterc.json',
    '.renovaterc.json5',
    '.github/renovate.json',
    '.github/renovate.json5',
    '.gitlab/renovate.json',
  ];
  if (renovateConfigs.some((p) => input.treePaths.has(p))) {
    tools.push('Renovate');
  }
  // Renovate can also be configured via package.json.renovate
  const pkg = input.files.find((f) => f.path === 'package.json');
  if (pkg && /"renovate"\s*:/.test(pkg.content) && !tools.includes('Renovate')) {
    tools.push('Renovate');
  }

  // Snyk — when configured for auto-fix PRs.
  if (input.treePaths.has('.snyk')) {
    tools.push('Snyk');
  }

  // Mend / WhiteSource configuration.
  if (
    input.treePaths.has('.whitesource') ||
    input.treePaths.has('whitesource.yml') ||
    input.treePaths.has('.mend.yml')
  ) {
    tools.push('Mend');
  }

  // Scala Steward (Scala equivalent of Dependabot).
  if (input.treePaths.has('.scala-steward.conf')) {
    tools.push('Scala Steward');
  }

  // PyUp (Python).
  if (input.treePaths.has('.pyup.yml') || input.treePaths.has('pyup.yml')) {
    tools.push('PyUp');
  }

  return { found: tools.length > 0, tools };
}
