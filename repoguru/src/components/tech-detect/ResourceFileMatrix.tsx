import { useState, useMemo } from 'react';
import type {
  DetectedAWSService,
  DetectedAzureService,
  DetectedGCPService,
} from '../../types/techDetect';

type Provider = 'all' | 'aws' | 'azure' | 'gcp';

interface Props {
  aws: DetectedAWSService[];
  azure: DetectedAzureService[];
  gcp: DetectedGCPService[];
}

interface MatrixEntry {
  service: string;
  provider: 'aws' | 'azure' | 'gcp';
  source: string;
}

const PROVIDER_COLORS: Record<string, { dot: string; bg: string; text: string; ring: string }> = {
  aws: {
    dot: 'bg-orange-400',
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    ring: 'ring-orange-500/30',
  },
  azure: {
    dot: 'bg-cyan-400',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    ring: 'ring-cyan-500/30',
  },
  gcp: {
    dot: 'bg-blue-400',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    ring: 'ring-blue-500/30',
  },
};

const PROVIDER_LABELS: Record<string, string> = {
  all: 'All',
  aws: 'AWS',
  azure: 'Azure',
  gcp: 'GCP',
};

export function ResourceFileMatrix({ aws, azure, gcp }: Props) {
  const [filter, setFilter] = useState<Provider>('all');

  const entries = useMemo<MatrixEntry[]>(() => {
    const all: MatrixEntry[] = [];
    for (const s of aws) all.push({ service: s.service, provider: 'aws', source: s.source });
    for (const s of azure) all.push({ service: s.service, provider: 'azure', source: s.source });
    for (const s of gcp) all.push({ service: s.service, provider: 'gcp', source: s.source });
    return all;
  }, [aws, azure, gcp]);

  const filtered = useMemo(
    () => (filter === 'all' ? entries : entries.filter((e) => e.provider === filter)),
    [entries, filter],
  );

  const { services, files, matrix } = useMemo(() => {
    const serviceSet = new Set<string>();
    const fileSet = new Set<string>();
    for (const e of filtered) {
      serviceSet.add(e.service);
      fileSet.add(e.source);
    }
    const serviceList = [...serviceSet].sort((a, b) => a.localeCompare(b));
    const fileList = [...fileSet].sort((a, b) => a.localeCompare(b));

    // Build lookup: service -> source -> provider
    const lookup = new Map<string, Map<string, string>>();
    for (const e of filtered) {
      if (!lookup.has(e.service)) lookup.set(e.service, new Map());
      lookup.get(e.service)!.set(e.source, e.provider);
    }

    return { services: serviceList, files: fileList, matrix: lookup };
  }, [filtered]);

  if (entries.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-surface-alt overflow-hidden">
      <div className="flex items-center gap-3 p-5 border-b border-border">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-indigo-500/10">
          <svg
            className="h-5 w-5 text-indigo-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M10.875 12c-.621 0-1.125.504-1.125 1.125M12 10.875c-.621 0-1.125.504-1.125 1.125m0 0v1.5c0 .621.504 1.125 1.125 1.125m-1.125-2.625c0 .621.504 1.125 1.125 1.125m0 0c.621 0 1.125.504 1.125 1.125m-1.125-1.125c-.621 0-1.125.504-1.125 1.125"
            />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-text flex-1">Resource / File Matrix</h3>
        <span className="shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400">
          {services.length} service{services.length !== 1 ? 's' : ''} / {files.length} file
          {files.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Provider filter buttons */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border/50">
        {(['all', 'aws', 'azure', 'gcp'] as Provider[]).map((p) => {
          const isActive = filter === p;
          const count =
            p === 'all' ? entries.length : entries.filter((e) => e.provider === p).length;
          if (p !== 'all' && count === 0) return null;
          return (
            <button
              key={p}
              onClick={() => setFilter(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                isActive
                  ? 'bg-neon/15 border-neon/30 text-neon'
                  : 'bg-surface-hover border-border text-text-muted hover:text-text-secondary hover:border-border-bright'
              }`}
            >
              {PROVIDER_LABELS[p]}
              <span className="ml-1.5 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Scrollable matrix table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50">
              <th className="sticky left-0 z-10 bg-surface-alt px-4 py-2.5 text-left font-medium text-text-muted min-w-[160px]">
                Service
              </th>
              {files.map((file) => (
                <th
                  key={file}
                  className="px-2 py-2.5 font-medium text-text-muted whitespace-nowrap"
                  title={file}
                >
                  <span className="inline-block max-w-[120px] truncate font-mono">{file}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {services.map((svc) => (
              <tr
                key={svc}
                className="border-b border-border/30 last:border-b-0 hover:bg-surface-hover transition-colors"
              >
                <td className="sticky left-0 z-10 bg-surface-alt px-4 py-2 font-medium text-text whitespace-nowrap">
                  {svc}
                </td>
                {files.map((file) => {
                  const provider = matrix.get(svc)?.get(file);
                  return (
                    <td key={file} className="px-2 py-2 text-center">
                      {provider ? (
                        <span
                          className={`inline-block h-3 w-3 rounded-full ${PROVIDER_COLORS[provider].dot} ring-2 ${PROVIDER_COLORS[provider].ring}`}
                          title={`${svc} in ${file} (${PROVIDER_LABELS[provider]})`}
                        />
                      ) : (
                        <span className="inline-block h-3 w-3 rounded-full bg-surface" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-5 py-3 border-t border-border/50 text-[11px] text-text-muted">
        {(['aws', 'azure', 'gcp'] as const).map((p) => {
          const count = entries.filter((e) => e.provider === p).length;
          if (count === 0) return null;
          const c = PROVIDER_COLORS[p];
          return (
            <span key={p} className="inline-flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
              <span className={c.text}>{PROVIDER_LABELS[p]}</span>
            </span>
          );
        })}
      </div>
    </section>
  );
}
