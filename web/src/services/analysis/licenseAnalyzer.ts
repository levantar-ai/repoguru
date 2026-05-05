import type { CategoryResult, FileContent, TreeEntry, Signal, RepoInfo } from '../../types';

const PERMISSIVE_LICENSES = [
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'Unlicense',
  'CC0-1.0',
];
const COPYLEFT_LICENSES = ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'LGPL-2.1', 'LGPL-3.0', 'MPL-2.0'];

export function analyzeLicense(
  _files: FileContent[],
  tree: TreeEntry[],
  repoInfo: RepoInfo,
): CategoryResult {
  const signals: Signal[] = [];
  const treePaths = new Set(tree.map((e) => e.path));

  // License file exists
  const hasLicenseFile =
    treePaths.has('LICENSE') ||
    treePaths.has('LICENSE.md') ||
    treePaths.has('LICENSE.txt') ||
    treePaths.has('COPYING') ||
    treePaths.has('LICENCE');
  signals.push({ name: 'License file exists', found: hasLicenseFile });

  // License detected by GitHub
  const spdxId = repoInfo.license;
  const hasDetectedLicense = !!spdxId && spdxId !== 'NOASSERTION';
  signals.push({
    name: 'SPDX license detected',
    found: hasDetectedLicense,
    details: spdxId || undefined,
  });

  // Permissive license
  const isPermissive = !!spdxId && PERMISSIVE_LICENSES.includes(spdxId);
  signals.push({
    name: 'Permissive license',
    found: isPermissive,
    details: isPermissive ? spdxId! : undefined,
  });

  // Copyleft (not bad, but noted)
  const isCopyleft = !!spdxId && COPYLEFT_LICENSES.includes(spdxId);
  signals.push({
    name: 'Copyleft license',
    found: isCopyleft,
    details: isCopyleft ? spdxId! : undefined,
  });

  let score = 0;
  if (hasLicenseFile) score += 40;
  if (hasDetectedLicense) score += 30;
  if (isPermissive) score += 30;
  else if (isCopyleft) score += 20;
  else if (hasDetectedLicense) score += 10;

  return {
    key: 'license',
    label: 'License',
    score: Math.min(100, score),
    weight: 0.1,
    signals,
  };
}
