import type { CategoryResult, FileContent, TreeEntry, Signal } from '../../types';
import { CATEGORY_WEIGHTS } from '../../utils/constants';

export function analyzeSecurity(files: FileContent[], tree: TreeEntry[]): CategoryResult {
  const signals: Signal[] = [];
  const fileMap = new Map(files.map((f) => [f.path, f]));
  const treePaths = new Set(tree.map((e) => e.path));

  // SECURITY.md
  signals.push({
    name: 'SECURITY.md',
    found: fileMap.has('SECURITY.md') || treePaths.has('SECURITY.md'),
  });

  // CODEOWNERS
  const hasCODEOWNERS =
    fileMap.has('CODEOWNERS') ||
    fileMap.has('.github/CODEOWNERS') ||
    treePaths.has('CODEOWNERS') ||
    treePaths.has('.github/CODEOWNERS');
  signals.push({ name: 'CODEOWNERS', found: hasCODEOWNERS });

  // Dependabot config
  const hasDependabot =
    fileMap.has('.github/dependabot.yml') || fileMap.has('.github/dependabot.yaml');
  signals.push({ name: 'Dependabot configured', found: hasDependabot });

  // CodeQL / security scanning
  const hasCodeQL = files.some(
    (f) =>
      f.path.includes('codeql') ||
      f.content.includes('codeql-analysis') ||
      f.content.includes('CodeQL'),
  );
  signals.push({ name: 'CodeQL / security scanning', found: hasCodeQL });

  // Branch protection signals (presence of workflows with PR triggers)
  const hasPRWorkflow = files.some(
    (f) =>
      f.path.startsWith('.github/workflows/') &&
      (f.content.includes('pull_request') || f.content.includes('pull-request')),
  );
  signals.push({ name: 'PR-triggered workflows', found: hasPRWorkflow });

  // Secret scanning (check for .gitignore patterns)
  const gitignore = tree.some((e) => e.path === '.gitignore');
  signals.push({ name: '.gitignore present', found: gitignore });

  // No obvious secrets in repo (check for common secret file patterns)
  const suspiciousFiles = tree.some(
    (e) =>
      e.type === 'blob' &&
      (e.path.endsWith('.env') || /credentials/i.test(e.path) || /secret/i.test(e.path)),
  );
  signals.push({ name: 'No exposed secret files', found: !suspiciousFiles });

  let score = 0;
  if (fileMap.has('SECURITY.md') || treePaths.has('SECURITY.md')) score += 20;
  if (hasCODEOWNERS) score += 15;
  if (hasDependabot) score += 20;
  if (hasCodeQL) score += 15;
  if (hasPRWorkflow) score += 10;
  if (gitignore) score += 10;
  if (!suspiciousFiles) score += 10;

  return {
    key: 'security',
    label: 'Security',
    score: Math.min(100, score),
    weight: CATEGORY_WEIGHTS.security,
    signals,
  };
}
