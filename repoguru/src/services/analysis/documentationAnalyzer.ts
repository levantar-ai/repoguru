import type { CategoryResult, FileContent, TreeEntry, Signal } from '../../types';
import { CATEGORY_WEIGHTS } from '../../utils/constants';

/** Case-insensitive lookup in a file map. Returns the file content if found. */
function ciGet(
  fileMap: Map<string, FileContent>,
  ...candidates: string[]
): FileContent | undefined {
  // Try exact matches first
  for (const c of candidates) {
    const found = fileMap.get(c);
    if (found) return found;
  }
  // Fall back to case-insensitive scan
  const lowerSet = new Set(candidates.map((c) => c.toLowerCase()));
  for (const [path, file] of fileMap) {
    if (lowerSet.has(path.toLowerCase())) return file;
  }
  return undefined;
}

/** Case-insensitive check if any candidate path exists in the file map. */
function ciHas(fileMap: Map<string, FileContent>, ...candidates: string[]): boolean {
  return ciGet(fileMap, ...candidates) !== undefined;
}

/** Check if the found path uses non-standard casing (e.g. Readme.md instead of README.md). */
function casingNote(fileMap: Map<string, FileContent>, canonical: string): string | undefined {
  // Check if the canonical form exists
  if (fileMap.has(canonical)) return undefined;
  // Find the actual path
  const lower = canonical.toLowerCase();
  for (const path of fileMap.keys()) {
    if (path.toLowerCase() === lower && path !== canonical) {
      return `Found as "${path}" — standard convention is "${canonical}"`;
    }
  }
  return undefined;
}

export function analyzeDocumentation(files: FileContent[], tree: TreeEntry[]): CategoryResult {
  const signals: Signal[] = [];
  const fileMap = new Map(files.map((f) => [f.path, f]));

  // README exists (case-insensitive)
  const readme = ciGet(fileMap, 'README.md', 'readme.md', 'README.rst');
  const readmeCasingNote = readme
    ? (casingNote(fileMap, 'README.md') ?? casingNote(fileMap, 'README.rst'))
    : undefined;
  signals.push({
    name: 'README exists',
    found: !!readme,
    details: readmeCasingNote || undefined,
  });

  // README quality (length-based heuristic)
  const readmeLength = readme?.content.length ?? 0;
  const hasSubstantialReadme = readmeLength > 500;
  signals.push({
    name: 'Substantial README (>500 chars)',
    found: hasSubstantialReadme,
    details: readme ? `${readmeLength} characters` : undefined,
  });

  // README has sections (headers)
  const readmeHeaders = readme?.content.match(/^#{1,3}\s+/gm)?.length ?? 0;
  signals.push({
    name: 'README has sections',
    found: readmeHeaders >= 3,
    details: `${readmeHeaders} headers found`,
  });

  // README has code examples
  const hasCodeBlocks = /```[\s\S]*?```/.test(readme?.content ?? '');
  signals.push({ name: 'Code examples in README', found: hasCodeBlocks });

  // CONTRIBUTING.md (case-insensitive)
  const hasContributing = ciHas(fileMap, 'CONTRIBUTING.md');
  const contributingNote = hasContributing ? casingNote(fileMap, 'CONTRIBUTING.md') : undefined;
  signals.push({
    name: 'CONTRIBUTING.md',
    found: hasContributing,
    details: contributingNote || undefined,
  });

  // CHANGELOG or similar (case-insensitive)
  const hasChangelog = ciHas(fileMap, 'CHANGELOG.md', 'CHANGES.md', 'HISTORY.md');
  const changelogNote = hasChangelog
    ? (casingNote(fileMap, 'CHANGELOG.md') ??
      casingNote(fileMap, 'CHANGES.md') ??
      casingNote(fileMap, 'HISTORY.md'))
    : undefined;
  signals.push({
    name: 'CHANGELOG',
    found: hasChangelog,
    details: changelogNote || undefined,
  });

  // docs/ directory
  const hasDocs = tree.some(
    (e) => e.type === 'tree' && (e.path.toLowerCase() === 'docs' || e.path.toLowerCase() === 'doc'),
  );
  signals.push({ name: 'docs/ directory', found: hasDocs });

  // Calculate score
  let score = 0;
  if (readme) score += 25;
  if (hasSubstantialReadme) score += 20;
  if (readmeHeaders >= 3) score += 15;
  if (hasCodeBlocks) score += 10;
  if (hasContributing) score += 10;
  if (hasChangelog) score += 10;
  if (hasDocs) score += 10;

  return {
    key: 'documentation',
    label: 'Documentation',
    score: Math.min(100, score),
    weight: CATEGORY_WEIGHTS.documentation,
    signals,
  };
}
