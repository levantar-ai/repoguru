import type { CategoryResult, FileContent, TreeEntry, Signal } from '../../types';
import { ISSUE_TEMPLATE_DIR, PR_TEMPLATE, PR_TEMPLATE_ALT } from '../../utils/constants';

/** Case-insensitive check if any candidate path exists in a Set of paths. */
function ciHasPath(paths: Set<string>, ...candidates: string[]): boolean {
  for (const c of candidates) {
    if (paths.has(c)) return true;
  }
  const lowerSet = new Set(candidates.map((c) => c.toLowerCase()));
  for (const p of paths) {
    if (lowerSet.has(p.toLowerCase())) return true;
  }
  return false;
}

/** Case-insensitive check if any candidate exists in a file map. */
function ciHasFile(fileMap: Map<string, unknown>, ...candidates: string[]): boolean {
  for (const c of candidates) {
    if (fileMap.has(c)) return true;
  }
  const lowerSet = new Set(candidates.map((c) => c.toLowerCase()));
  for (const p of fileMap.keys()) {
    if (lowerSet.has(p.toLowerCase())) return true;
  }
  return false;
}

export function analyzeCommunity(files: FileContent[], tree: TreeEntry[]): CategoryResult {
  const signals: Signal[] = [];
  const fileMap = new Map(files.map((f) => [f.path, f]));
  const treePaths = new Set(tree.map((e) => e.path));

  // Issue templates (case-insensitive on directory prefix)
  const issueTemplateDirLower = ISSUE_TEMPLATE_DIR.toLowerCase();
  const issueTemplates = tree.filter(
    (e) => e.type === 'blob' && e.path.toLowerCase().startsWith(issueTemplateDirLower),
  );
  signals.push({
    name: 'Issue templates',
    found: issueTemplates.length > 0,
    details: `${issueTemplates.length} template(s)`,
  });

  // PR template (case-insensitive)
  const hasPRTemplate = ciHasPath(
    treePaths,
    PR_TEMPLATE,
    PR_TEMPLATE_ALT,
    '.github/PULL_REQUEST_TEMPLATE.md',
    'PULL_REQUEST_TEMPLATE.md',
  );
  signals.push({ name: 'PR template', found: hasPRTemplate });

  // Code of Conduct (case-insensitive)
  const hasCOC =
    ciHasFile(fileMap, 'CODE_OF_CONDUCT.md', '.github/CODE_OF_CONDUCT.md') ||
    ciHasPath(treePaths, 'CODE_OF_CONDUCT.md', '.github/CODE_OF_CONDUCT.md');
  signals.push({ name: 'Code of Conduct', found: hasCOC });

  // CONTRIBUTING.md (case-insensitive)
  const hasContributing =
    ciHasFile(fileMap, 'CONTRIBUTING.md') || ciHasPath(treePaths, 'CONTRIBUTING.md');
  signals.push({ name: 'CONTRIBUTING.md', found: hasContributing });

  // FUNDING
  const hasFunding =
    ciHasFile(fileMap, '.github/FUNDING.yml') || ciHasPath(treePaths, '.github/FUNDING.yml');
  signals.push({ name: 'Funding configuration', found: hasFunding });

  // SUPPORT.md (case-insensitive)
  const hasSupport =
    ciHasFile(fileMap, '.github/SUPPORT.md', 'SUPPORT.md') ||
    ciHasPath(treePaths, '.github/SUPPORT.md', 'SUPPORT.md');
  signals.push({ name: 'SUPPORT.md', found: hasSupport });

  let score = 0;
  if (issueTemplates.length > 0) score += 20;
  if (hasPRTemplate) score += 20;
  if (hasCOC) score += 20;
  if (hasContributing) score += 20;
  if (hasFunding) score += 10;
  if (hasSupport) score += 10;

  return {
    key: 'community',
    label: 'Community',
    score: Math.min(100, score),
    weight: 0.1,
    signals,
  };
}
