import type { CategoryResult, FileContent, TreeEntry, Signal } from '../../types';
import { detectFunding } from './detectors/funding';

/** Case-insensitive lookup across a Set of paths. */
function hasPathInsensitive(paths: Set<string>, ...candidates: string[]): boolean {
  const lower = new Set(candidates.map((c) => c.toLowerCase()));
  for (const p of paths) {
    if (lower.has(p.toLowerCase())) return true;
  }
  return false;
}

export function analyzeCommunity(files: FileContent[], tree: TreeEntry[]): CategoryResult {
  const signals: Signal[] = [];
  const treePaths = new Set(tree.filter((e) => e.type === 'blob').map((e) => e.path));
  const input = { files, tree, treePaths };

  // Issue templates — GitHub uses .github/ISSUE_TEMPLATE/, GitLab uses
  // .gitlab/issue_templates/, Gitea uses .gitea/ISSUE_TEMPLATE/.
  const issueTemplates = tree.filter(
    (e) =>
      e.type === 'blob' &&
      (e.path.toLowerCase().startsWith('.github/issue_template/') ||
        e.path.toLowerCase().startsWith('.gitlab/issue_templates/') ||
        e.path.toLowerCase().startsWith('.gitea/issue_template/')),
  );
  signals.push({
    name: 'Issue templates',
    found: issueTemplates.length > 0,
    details: issueTemplates.length > 0 ? `${issueTemplates.length} template(s)` : undefined,
  });

  // Merge/PR template — same outcome across forges.
  const hasMRTemplate = hasPathInsensitive(
    treePaths,
    '.github/PULL_REQUEST_TEMPLATE.md',
    'PULL_REQUEST_TEMPLATE.md',
    'docs/PULL_REQUEST_TEMPLATE.md',
    '.gitlab/merge_request_templates/Default.md',
    '.gitea/PULL_REQUEST_TEMPLATE.md',
  );
  signals.push({ name: 'Change-request template', found: hasMRTemplate });

  const hasCOC = hasPathInsensitive(
    treePaths,
    'CODE_OF_CONDUCT.md',
    '.github/CODE_OF_CONDUCT.md',
    'docs/CODE_OF_CONDUCT.md',
  );
  signals.push({ name: 'Code of Conduct', found: hasCOC });

  const hasContributing = hasPathInsensitive(
    treePaths,
    'CONTRIBUTING.md',
    '.github/CONTRIBUTING.md',
    'docs/CONTRIBUTING.md',
  );
  signals.push({ name: 'Contributing guide', found: hasContributing });

  const funding = detectFunding(input);
  signals.push({
    name: 'Funding info',
    found: funding.found,
    details: funding.found ? funding.tools.join(', ') : undefined,
  });

  const hasSupport = hasPathInsensitive(
    treePaths,
    '.github/SUPPORT.md',
    'SUPPORT.md',
    'docs/SUPPORT.md',
  );
  signals.push({ name: 'Support channels', found: hasSupport });

  const weights: Record<string, number> = {
    'Issue templates': 20,
    'Change-request template': 20,
    'Code of Conduct': 20,
    'Contributing guide': 20,
    'Funding info': 10,
    'Support channels': 10,
  };
  let score = 0;
  for (const sig of signals) {
    if (sig.found) score += weights[sig.name] ?? 0;
  }

  return {
    key: 'community',
    label: 'Community',
    score: Math.min(100, score),
    weight: 0.1,
    signals,
  };
}
