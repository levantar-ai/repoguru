import type { CategoryResult, FileContent, TreeEntry, Signal } from '../../types';
import { CATEGORY_WEIGHTS } from '../../utils/constants';

const BINARY_EXTENSIONS = new Set(['.exe', '.dll', '.jar', '.so', '.class', '.pyc']);

export function analyzeOpenssf(files: FileContent[], tree: TreeEntry[]): CategoryResult {
  const signals: Signal[] = [];
  const fileMap = new Map(files.map((f) => [f.path, f]));
  const treePaths = new Set(tree.map((e) => e.path));

  const workflowFiles = files.filter((f) => f.path.startsWith('.github/workflows/'));
  const allWorkflowContent = workflowFiles.map((f) => f.content).join('\n');

  // 1. Token permissions (15 pts)
  const hasTokenPermissions = workflowFiles.some((f) => f.content.includes('permissions:'));
  signals.push({ name: 'Token permissions', found: hasTokenPermissions });

  // 2. Pinned dependencies (15 pts) — actions use @<sha> not @v1 tags
  const actionUses = allWorkflowContent.match(/uses:\s*\S+/g) ?? [];
  const hasPinnedDeps =
    actionUses.length > 0 &&
    actionUses.every((u) => {
      const ref = u.split('@')[1];
      // SHA refs are 40 hex chars
      return ref && /^[0-9a-f]{40}$/i.test(ref.trim());
    });
  signals.push({
    name: 'Pinned dependencies',
    found: hasPinnedDeps,
    details: hasPinnedDeps ? 'Actions pinned to SHA' : `${actionUses.length} action ref(s) found`,
  });

  // 3. No dangerous workflow patterns (10 pts)
  const hasDangerousPattern = workflowFiles.some((f) => {
    const hasPRT = f.content.includes('pull_request_target');
    const hasCheckout =
      f.content.includes('actions/checkout') &&
      (f.content.includes('github.event.pull_request.head.ref') ||
        f.content.includes('github.event.pull_request.head.sha'));
    return hasPRT && hasCheckout;
  });
  signals.push({ name: 'No dangerous workflow patterns', found: !hasDangerousPattern });

  // 4. No binary artifacts (10 pts)
  const hasBinaryArtifacts = tree.some(
    (e) =>
      e.type === 'blob' &&
      BINARY_EXTENSIONS.has(e.path.slice(e.path.lastIndexOf('.')).toLowerCase()),
  );
  signals.push({ name: 'No binary artifacts', found: !hasBinaryArtifacts });

  // 5. SLSA / signed releases (10 pts)
  const slsaPatterns = ['slsa', 'provenance', 'sigstore', 'cosign'];
  const hasSlsa = workflowFiles.some((f) =>
    slsaPatterns.some((p) => f.content.toLowerCase().includes(p)),
  );
  signals.push({ name: 'SLSA / signed releases', found: hasSlsa });

  // 6. Fuzzing (10 pts)
  const hasFuzzing =
    tree.some(
      (e) => e.path.toLowerCase().includes('fuzz') || e.path.toLowerCase().includes('oss-fuzz'),
    ) || files.some((f) => f.content.toLowerCase().includes('oss-fuzz'));
  signals.push({ name: 'Fuzzing', found: hasFuzzing });

  // 7. SBOM generation (10 pts)
  const sbomPatterns = ['cyclonedx', 'spdx', 'sbom', 'syft'];
  const hasSbom = workflowFiles.some((f) =>
    sbomPatterns.some((p) => f.content.toLowerCase().includes(p)),
  );
  signals.push({ name: 'SBOM generation', found: hasSbom });

  // 8. Dependency update tool (10 pts) — Dependabot or Renovate
  const hasDependabot =
    fileMap.has('.github/dependabot.yml') || fileMap.has('.github/dependabot.yaml');
  const hasRenovate =
    treePaths.has('.renovaterc') ||
    treePaths.has('.renovaterc.json') ||
    treePaths.has('renovate.json');
  const hasDepUpdateTool = hasDependabot || hasRenovate;
  signals.push({
    name: 'Dependency update tool',
    found: hasDepUpdateTool,
    details: hasDependabot ? 'Dependabot' : hasRenovate ? 'Renovate' : undefined,
  });

  // 9. Security policy (5 pts)
  const hasSecurityPolicy = fileMap.has('SECURITY.md') || treePaths.has('SECURITY.md');
  signals.push({ name: 'Security policy', found: hasSecurityPolicy });

  // 10. License detected (5 pts)
  const hasLicense =
    treePaths.has('LICENSE') ||
    treePaths.has('LICENSE.md') ||
    treePaths.has('LICENSE.txt') ||
    treePaths.has('LICENCE') ||
    treePaths.has('COPYING');
  signals.push({ name: 'License detected', found: hasLicense });

  // Scoring
  let score = 0;
  if (hasTokenPermissions) score += 15;
  if (hasPinnedDeps) score += 15;
  if (!hasDangerousPattern) score += 10;
  if (!hasBinaryArtifacts) score += 10;
  if (hasSlsa) score += 10;
  if (hasFuzzing) score += 10;
  if (hasSbom) score += 10;
  if (hasDepUpdateTool) score += 10;
  if (hasSecurityPolicy) score += 5;
  if (hasLicense) score += 5;

  return {
    key: 'openssf',
    label: 'OpenSSF',
    score: Math.min(100, score),
    weight: CATEGORY_WEIGHTS.openssf,
    signals,
  };
}
