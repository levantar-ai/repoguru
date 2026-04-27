import { useMemo } from 'react';
import type { TechDetectResult } from '../../types/techDetect';

interface Props {
  result: TechDetectResult;
}

interface Finding {
  label: string;
  value: string;
  present: boolean;
}

export function TechExecutiveSummary({ result }: Props) {
  const findings = useMemo<Finding[]>(() => {
    const langEntries = Object.entries(result.languages).sort(([, a], [, b]) => b - a);
    const langCount = langEntries.length;
    const primaryLang = langEntries.length > 0 ? langEntries[0][0] : null;

    const awsCount = new Set(result.aws.map((s) => s.service)).size;
    const azureCount = new Set(result.azure.map((s) => s.service)).size;
    const gcpCount = new Set(result.gcp.map((s) => s.service)).size;
    const cloudParts: string[] = [];
    if (awsCount > 0) cloudParts.push(`AWS (${awsCount})`);
    if (azureCount > 0) cloudParts.push(`Azure (${azureCount})`);
    if (gcpCount > 0) cloudParts.push(`GCP (${gcpCount})`);

    const hasCicd = result.cicd.length > 0;
    const hasTesting = result.testing.length > 0;

    const items: Finding[] = [];

    if (primaryLang) {
      items.push({
        label: 'Primary Language',
        value: `${primaryLang} (+${langCount - 1} more)`,
        present: true,
      });
    }

    items.push({
      label: 'Cloud Providers',
      value: cloudParts.length > 0 ? cloudParts.join(', ') : 'None detected',
      present: cloudParts.length > 0,
    });

    items.push({
      label: 'CI/CD',
      value: hasCicd
        ? result.cicd
            .slice(0, 3)
            .map((t) => t.name)
            .join(', ') + (result.cicd.length > 3 ? ` +${result.cicd.length - 3}` : '')
        : 'Not detected',
      present: hasCicd,
    });

    items.push({
      label: 'Testing & Quality',
      value: hasTesting
        ? result.testing
            .slice(0, 3)
            .map((t) => t.name)
            .join(', ') + (result.testing.length > 3 ? ` +${result.testing.length - 3}` : '')
        : 'Not detected',
      present: hasTesting,
    });

    return items;
  }, [result]);

  if (findings.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-surface-alt overflow-hidden">
      <div className="flex items-center gap-3 p-5 border-b border-border">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-neon/10">
          <svg
            className="h-5 w-5 text-neon"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5"
            />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-text">Executive Summary</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5">
        {findings.map((f) => (
          <div key={f.label} className="space-y-1.5">
            <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
              {f.label}
            </p>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
                f.present
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${f.present ? 'bg-emerald-400' : 'bg-amber-400'}`}
              />
              {f.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
