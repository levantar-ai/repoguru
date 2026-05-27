import type { DetectorInput, DetectionResult } from './types';

/** Funding signals come from many places. Config files are the most
 *  reliable, but a sponsor link in the README counts too. */
const FUNDING_CONFIG_FILES: Array<{ tool: string; paths: string[] }> = [
  { tool: 'GitHub Sponsors / FUNDING.yml', paths: ['.github/FUNDING.yml', '.github/FUNDING.yaml'] },
  { tool: 'Open Collective config', paths: ['.opencollective', '.opencollective.json'] },
  { tool: 'tidelift.yml', paths: ['.tidelift.yml'] },
];

const FUNDING_URL_PATTERNS: Array<{ tool: string; pattern: RegExp }> = [
  { tool: 'GitHub Sponsors link', pattern: /github\.com\/sponsors\//i },
  { tool: 'Open Collective link', pattern: /opencollective\.com\//i },
  { tool: 'Patreon link', pattern: /patreon\.com\//i },
  { tool: 'Liberapay link', pattern: /liberapay\.com\//i },
  { tool: 'Ko-fi link', pattern: /ko-fi\.com\//i },
  { tool: 'Buy Me a Coffee link', pattern: /buymeacoffee\.com\//i },
  { tool: 'Tidelift link', pattern: /tidelift\.com\//i },
  { tool: 'Polar link', pattern: /polar\.sh\//i },
];

export function detectFunding(input: DetectorInput): DetectionResult {
  const tools = new Set<string>();

  for (const { tool, paths } of FUNDING_CONFIG_FILES) {
    if (paths.some((p) => input.treePaths.has(p))) tools.add(tool);
  }

  // README sponsor links (full engine only — needs content).
  const readme = input.files.find((f) => /^readme\.(md|rst|adoc)$/i.test(f.path));
  if (readme) {
    for (const { tool, pattern } of FUNDING_URL_PATTERNS) {
      if (pattern.test(readme.content)) tools.add(tool);
    }
  }

  // package.json#funding (npm convention).
  const pkg = input.files.find((f) => f.path === 'package.json');
  if (pkg && /"funding"\s*:/.test(pkg.content)) {
    tools.add('package.json funding field');
  }

  return { found: tools.size > 0, tools: Array.from(tools) };
}
