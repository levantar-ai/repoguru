import type { AnalysisReport } from '../../types';

/**
 * Component entry in the SBOM output.
 */
interface SbomComponent {
  type: 'library' | 'framework' | 'application' | 'device' | 'firmware';
  name: string;
  group?: string;
  version?: string;
  purl?: string;
  'bom-ref'?: string;
}

/**
 * CycloneDX-like SBOM structure.
 */
interface SbomDocument {
  bomFormat: string;
  specVersion: string;
  serialNumber: string;
  version: number;
  metadata: {
    timestamp: string;
    tools: { vendor: string; name: string; version: string }[];
    component: {
      type: string;
      name: string;
      version: string;
    };
  };
  components: SbomComponent[];
}

/**
 * Generates a CycloneDX-like SBOM JSON object from an analysis report.
 * Includes tech stack items and detected dependencies from the report.
 */
export function generateSbom(report: AnalysisReport): SbomDocument {
  const components: SbomComponent[] = [];

  // Add tech stack items as components
  for (const item of report.techStack) {
    const componentType = mapTechCategoryToComponentType(item.category);
    components.push({
      type: componentType,
      name: item.name,
      group: item.category,
      'bom-ref': `techstack-${sanitizeRef(item.name)}`,
    });
  }

  // Extract dependency names from signals
  const depSignal = findSignalInReport(report, 'Dependency manifest');
  if (depSignal?.details) {
    const manifests = depSignal.details.split(', ');
    for (const manifest of manifests) {
      // Add the manifest itself as a reference
      if (!components.some((c) => c.name === manifest)) {
        components.push({
          type: 'library',
          name: manifest,
          'bom-ref': `manifest-${sanitizeRef(manifest)}`,
        });
      }
    }
  }

  // Extract lockfile information
  const lockSignal = findSignalInReport(report, 'Lockfile present');
  if (lockSignal?.details) {
    const lockfiles = lockSignal.details.split(', ');
    for (const lockfile of lockfiles) {
      if (!components.some((c) => c.name === lockfile)) {
        components.push({
          type: 'library',
          name: lockfile,
          'bom-ref': `lockfile-${sanitizeRef(lockfile)}`,
        });
      }
    }
  }

  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${generateUUID()}`,
    version: 1,
    metadata: {
      timestamp: report.analyzedAt,
      tools: [
        {
          vendor: 'Repo Guru',
          name: 'Repo Guru Analyzer',
          version: '1.0.0',
        },
      ],
      component: {
        type: 'application',
        name: `${report.repo.owner}/${report.repo.repo}`,
        version: report.repo.branch || report.repoInfo.defaultBranch,
      },
    },
    components,
  };
}

/**
 * Returns the SBOM as a formatted JSON string.
 */
export function sbomToJson(report: AnalysisReport): string {
  return JSON.stringify(generateSbom(report), null, 2);
}

// ── Helpers ──

function mapTechCategoryToComponentType(
  category: 'language' | 'framework' | 'tool' | 'platform' | 'database',
): SbomComponent['type'] {
  switch (category) {
    case 'framework':
      return 'framework';
    case 'platform':
      return 'application';
    default:
      return 'library';
  }
}

function findSignalInReport(report: AnalysisReport, signalName: string) {
  for (const cat of report.categories) {
    const signal = cat.signals.find((s) => s.name === signalName);
    if (signal) return signal;
  }
  return undefined;
}

function sanitizeRef(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

/**
 * UUID v4 generator for SBOM serial numbers using crypto.randomUUID().
 */
function generateUUID(): string {
  return crypto.randomUUID();
}
