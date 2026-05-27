import type { CategoryResult, FileContent, TreeEntry, Signal } from '../../types';
import { CATEGORY_WEIGHTS } from '../../utils/constants';
import { detectCI } from './detectors/ci';
import { detectDependencyUpdates } from './detectors/dependencyUpdates';

const BINARY_EXTENSIONS = new Set(['.exe', '.dll', '.jar', '.so', '.class', '.pyc']);

export function analyzeOpenssf(files: FileContent[], tree: TreeEntry[]): CategoryResult {
  const signals: Signal[] = [];
  const treePaths = new Set(tree.filter((e) => e.type === 'blob').map((e) => e.path));
  const input = { files, tree, treePaths };

  const workflowFiles = files.filter((f) => f.path.startsWith('.github/workflows/'));
  const allWorkflowContent = workflowFiles.map((f) => f.content).join('\n');

  // GitHub Actions-specific hardening signals — only applicable when
  // the repo actually uses GHA. For GitLab/Circle/Jenkins repos, the
  // equivalent concerns exist but live elsewhere; flagging them here
  // would be false-positive noise.
  const ci = detectCI(input);
  const usesGHA = ci.tools.includes('GitHub Actions');
  const ghaNAReason = usesGHA
    ? undefined
    : 'These hardening checks apply to GitHub Actions; this repo uses a different CI tool';

  const hasTokenPermissions = workflowFiles.some((f) => f.content.includes('permissions:'));
  signals.push({
    name: 'Hardened CI permissions',
    found: hasTokenPermissions,
    notApplicable: !usesGHA,
    notApplicableReason: ghaNAReason,
  });

  const actionUses = allWorkflowContent.match(/uses:\s*\S+/g) ?? [];
  const hasPinnedDeps =
    actionUses.length > 0 &&
    actionUses.every((u) => {
      const ref = u.split('@')[1];
      return ref && /^[0-9a-f]{40}$/i.test(ref.trim());
    });
  signals.push({
    name: 'Pinned CI dependencies',
    found: hasPinnedDeps,
    details: hasPinnedDeps ? 'Actions pinned to SHA' : `${actionUses.length} action ref(s) found`,
    notApplicable: !usesGHA,
    notApplicableReason: ghaNAReason,
  });

  const hasDangerousPattern = workflowFiles.some((f) => {
    const hasPRT = f.content.includes('pull_request_target');
    const hasCheckout =
      f.content.includes('actions/checkout') &&
      (f.content.includes('github.event.pull_request.head.ref') ||
        f.content.includes('github.event.pull_request.head.sha'));
    return hasPRT && hasCheckout;
  });
  signals.push({
    name: 'No untrusted-PR-checkout patterns',
    found: !hasDangerousPattern,
    notApplicable: !usesGHA,
    notApplicableReason: ghaNAReason,
  });

  const hasBinaryArtifacts = tree.some(
    (e) =>
      e.type === 'blob' &&
      BINARY_EXTENSIONS.has(e.path.slice(e.path.lastIndexOf('.')).toLowerCase()),
  );
  signals.push({ name: 'No binary artifacts in tree', found: !hasBinaryArtifacts });

  // Signed releases — multi-tool. SLSA provenance, Sigstore/cosign,
  // GPG-signed git tags, npm provenance, GoReleaser sigs.
  const signedReleaseTools: string[] = [];
  const hay = allWorkflowContent.toLowerCase();
  if (hay.includes('slsa') || hay.includes('slsa-framework')) signedReleaseTools.push('SLSA');
  if (hay.includes('sigstore') || hay.includes('cosign'))
    signedReleaseTools.push('Sigstore / cosign');
  if (hay.includes('--provenance') || hay.includes('npm provenance')) {
    signedReleaseTools.push('npm provenance');
  }
  if (hay.includes('gpg-sign') || hay.includes('gpg sign')) signedReleaseTools.push('GPG signing');
  signals.push({
    name: 'Signed releases',
    found: signedReleaseTools.length > 0,
    details: signedReleaseTools.length > 0 ? signedReleaseTools.join(', ') : undefined,
  });

  const fuzzTools: string[] = [];
  if (tree.some((e) => e.path.toLowerCase().includes('oss-fuzz'))) fuzzTools.push('OSS-Fuzz');
  if (
    tree.some((e) => e.type === 'blob' && (e.path.startsWith('fuzz/') || e.path.includes('/fuzz/')))
  ) {
    fuzzTools.push('cargo-fuzz / language-native fuzzing');
  }
  if (files.some((f) => /go-fuzz|libfuzzer|atheris|honggfuzz/i.test(f.content))) {
    fuzzTools.push('libFuzzer / go-fuzz / Atheris');
  }
  signals.push({
    name: 'Fuzzing',
    found: fuzzTools.length > 0,
    details: fuzzTools.length > 0 ? fuzzTools.join(', ') : undefined,
  });

  const sbomTools: string[] = [];
  if (hay.includes('cyclonedx')) sbomTools.push('CycloneDX');
  if (hay.includes('spdx')) sbomTools.push('SPDX');
  if (hay.includes('syft')) sbomTools.push('Syft');
  if (hay.includes('sbom') && sbomTools.length === 0) sbomTools.push('SBOM tooling');
  signals.push({
    name: 'Software bill of materials',
    found: sbomTools.length > 0,
    details: sbomTools.length > 0 ? sbomTools.join(', ') : undefined,
  });

  const depUpdates = detectDependencyUpdates(input);
  signals.push({
    name: 'Automated dependency updates',
    found: depUpdates.found,
    details: depUpdates.found ? depUpdates.tools.join(', ') : undefined,
  });

  signals.push({
    name: 'Security policy',
    found: treePaths.has('SECURITY.md') || treePaths.has('.github/SECURITY.md'),
  });

  const hasLicense =
    treePaths.has('LICENSE') ||
    treePaths.has('LICENSE.md') ||
    treePaths.has('LICENSE.txt') ||
    treePaths.has('LICENCE') ||
    treePaths.has('COPYING');
  signals.push({ name: 'License declared', found: hasLicense });

  // Re-normalised scoring over applicable weights only.
  const weights: Record<string, number> = {
    'Hardened CI permissions': 15,
    'Pinned CI dependencies': 15,
    'No untrusted-PR-checkout patterns': 10,
    'No binary artifacts in tree': 10,
    'Signed releases': 10,
    Fuzzing: 10,
    'Software bill of materials': 10,
    'Automated dependency updates': 10,
    'Security policy': 5,
    'License declared': 5,
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
    key: 'openssf',
    label: 'OpenSSF',
    score: Math.min(100, score),
    weight: CATEGORY_WEIGHTS.openssf,
    signals,
  };
}
