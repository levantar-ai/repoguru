import type { DetectorInput, DetectionResult } from './types';

/** CODEOWNERS is a near-universal convention — GitHub, GitLab, Gitea
 *  and Bitbucket all accept it, usually at one of these paths. */
const CODEOWNERS_PATHS = [
  'CODEOWNERS',
  '.github/CODEOWNERS',
  'docs/CODEOWNERS',
  '.gitlab/CODEOWNERS',
  '.bitbucket/CODEOWNERS',
];

export function detectCodeOwnership(input: DetectorInput): DetectionResult {
  const found: string[] = [];
  for (const p of CODEOWNERS_PATHS) {
    if (input.treePaths.has(p)) found.push(p);
  }
  return { found: found.length > 0, tools: found };
}
