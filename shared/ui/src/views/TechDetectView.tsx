import type { ReactNode } from 'react';
import type { TechDetectResult } from '@repoguru/core';
import { TechDetectResults } from '../tech-detect/TechDetectResults.js';
import { SectionLayout, type SectionDef } from '../chrome/SectionLayout.js';
import {
  OverviewIcon,
  HotspotsIcon,
  CodeIcon,
  HealthIcon,
  FilesIcon,
} from '../chrome/SectionIcons.js';

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
 *
 * Same SectionLayout pattern as Report Card and Git Stats — the report
 * is split into Overview / Cloud / Stack / Quality / Dependencies and
 * the user switches between them via the rail rather than scrolling
 * through one giant page.
 */
export function TechDetectView({ result, actions }: TechDetectViewProps) {
  const hasCloud = result.aws.length > 0 || result.azure.length > 0 || result.gcp.length > 0;
  const hasStack = result.frameworks.length > 0 || result.databases.length > 0;
  const hasQuality = result.cicd.length > 0 || result.testing.length > 0;
  const hasDependencies =
    result.node.length > 0 ||
    result.python.length > 0 ||
    result.go.length > 0 ||
    result.java.length > 0 ||
    result.php.length > 0 ||
    result.rust.length > 0 ||
    result.ruby.length > 0;

  // Sections only get added when there's content — keeps the rail
  // honest. Overview is always shown (executive summary + langs).
  const sections: SectionDef[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <OverviewIcon />,
      content: <TechDetectResults result={result} section="overview" />,
    },
  ];
  if (hasCloud) {
    sections.push({
      id: 'cloud',
      label: 'Cloud',
      icon: <HotspotsIcon />,
      content: <TechDetectResults result={result} section="cloud" />,
    });
  }
  if (hasStack) {
    sections.push({
      id: 'stack',
      label: 'Stack',
      icon: <CodeIcon />,
      content: <TechDetectResults result={result} section="stack" />,
    });
  }
  if (hasQuality) {
    sections.push({
      id: 'quality',
      label: 'Quality',
      icon: <HealthIcon />,
      content: <TechDetectResults result={result} section="quality" />,
    });
  }
  if (hasDependencies) {
    sections.push({
      id: 'dependencies',
      label: 'Dependencies',
      icon: <FilesIcon />,
      content: <TechDetectResults result={result} section="dependencies" />,
    });
  }

  return (
    <SectionLayout
      sections={sections}
      header={actions ? <div className="flex items-center justify-end">{actions}</div> : undefined}
    />
  );
}
