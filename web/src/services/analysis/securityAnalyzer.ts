import type { CategoryResult, FileContent, TreeEntry, Signal } from '../../types';
import { CATEGORY_WEIGHTS } from '../../utils/constants';
import { detectCodeOwnership } from './detectors/codeOwnership';
import { detectDependencyUpdates } from './detectors/dependencyUpdates';
import { detectSAST } from './detectors/sast';

export function analyzeSecurity(files: FileContent[], tree: TreeEntry[]): CategoryResult {
  const signals: Signal[] = [];
  const treePaths = new Set(tree.filter((e) => e.type === 'blob').map((e) => e.path));
  const input = { files, tree, treePaths };

  signals.push({
    name: 'Security policy',
    found: treePaths.has('SECURITY.md') || treePaths.has('.github/SECURITY.md'),
  });

  const owners = detectCodeOwnership(input);
  signals.push({
    name: 'Code ownership',
    found: owners.found,
    details: owners.found ? owners.tools.join(', ') : undefined,
  });

  const depUpdates = detectDependencyUpdates(input);
  signals.push({
    name: 'Automated dependency updates',
    found: depUpdates.found,
    details: depUpdates.found ? depUpdates.tools.join(', ') : undefined,
  });

  const sast = detectSAST(input);
  signals.push({
    name: 'Static security analysis',
    found: sast.found,
    details: sast.found ? sast.tools.join(', ') : undefined,
  });

  signals.push({
    name: 'Source-control ignore file',
    found: treePaths.has('.gitignore') || treePaths.has('.hgignore'),
  });

  const suspiciousFiles = tree.some(
    (e) =>
      e.type === 'blob' &&
      (e.path.endsWith('.env') || /credentials/i.test(e.path) || /secret/i.test(e.path)),
  );
  signals.push({ name: 'No exposed secret files', found: !suspiciousFiles });

  const weights: Record<string, number> = {
    'Security policy': 20,
    'Code ownership': 15,
    'Automated dependency updates': 25,
    'Static security analysis': 20,
    'Source-control ignore file': 10,
    'No exposed secret files': 10,
  };
  let score = 0;
  for (const sig of signals) {
    if (sig.found) score += weights[sig.name] ?? 0;
  }

  return {
    key: 'security',
    label: 'Security',
    score: Math.min(100, score),
    weight: CATEGORY_WEIGHTS.security,
    signals,
  };
}
