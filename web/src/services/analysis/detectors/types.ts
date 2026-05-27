import type { FileContent, TreeEntry } from '../../../types';

/** Common input bundle passed to every detector. Detectors take what
 *  they need and ignore the rest. Both engines (full + light) populate
 *  `files` and `tree`; the light engine passes an empty `files` array. */
export interface DetectorInput {
  files: FileContent[];
  tree: TreeEntry[];
  /** Pre-built Set of all blob paths for O(1) lookup. The analyzers
   *  build this once per repo and pass it to each detector. */
  treePaths: Set<string>;
}

/** A detector's result. `tools` is the list of products/configs we
 *  matched (in priority order — first match wins for naming). Callers
 *  use `found` for the signal, `tools` for the `details` string and
 *  for fact-checking what was actually detected. */
export interface DetectionResult {
  found: boolean;
  tools: string[];
}
