import type { ReactNode } from 'react';
import type { TechDetectResult } from '@repoguru/core';
import { TechDetectResults } from '../tech-detect/TechDetectResults.js';

export interface TechDetectViewProps {
  result: TechDetectResult;
  /** Optional action bar shown above the results (e.g. "New Scan"). */
  actions?: ReactNode;
}

/**
 * Authoritative tech-detection dashboard. Both apps render this same
 * tree against the canonical `TechDetectResult` shape (the in-browser
 * pipeline produces it directly; the desktop projects the CLI's
 * DetectTech RPC into the same shape).
 */
export function TechDetectView({ result, actions }: TechDetectViewProps) {
  return (
    <div className="space-y-6">
      {actions && <div className="flex items-center justify-end">{actions}</div>}
      <TechDetectResults result={result} />
    </div>
  );
}
