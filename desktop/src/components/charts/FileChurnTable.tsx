import { useState } from 'react';
import { ChartCard } from './ChartCard';

interface Hotspot {
  path: string;
  commits: number;
  total_churn: number;
  distinct_authors: number;
}

interface Props {
  hotspots: Hotspot[];
}

export function FileChurnTable({ hotspots }: Props) {
  const [sortBy, setSortBy] = useState<'commits' | 'total_churn' | 'distinct_authors'>('commits');
  const [limit, setLimit] = useState(25);

  const sorted = hotspots.slice().sort((a, b) => b[sortBy] - a[sortBy]).slice(0, limit);
  const maxChurn = Math.max(...sorted.map((h) => h.total_churn), 1);

  return (
    <ChartCard title="File Hotspots" subtitle={`Top ${limit} most-changed files`} className="col-span-full">
      <div className="flex gap-2 mb-3">
        {(['commits', 'total_churn', 'distinct_authors'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              sortBy === key
                ? 'bg-sky-500/20 text-sky-400'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            {key === 'total_churn' ? 'Churn' : key === 'distinct_authors' ? 'Authors' : 'Commits'}
          </button>
        ))}
        <div className="flex-1" />
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="text-xs bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-[var(--color-text-secondary)]"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>Top {n}</option>
          ))}
        </select>
      </div>
      <div className="overflow-y-auto max-h-[500px]">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
              <th className="text-left py-2 font-medium">File</th>
              <th className="text-right py-2 font-medium w-20">Commits</th>
              <th className="text-right py-2 font-medium w-20">Churn</th>
              <th className="text-right py-2 font-medium w-20">Authors</th>
              <th className="py-2 w-32" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((h) => (
              <tr key={h.path} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors">
                <td className="py-1.5 text-[var(--color-text-secondary)] font-mono truncate max-w-[400px]" title={h.path}>
                  {h.path}
                </td>
                <td className="text-right py-1.5 text-[var(--color-text)]">{h.commits.toLocaleString()}</td>
                <td className="text-right py-1.5 text-[var(--color-text)]">{h.total_churn.toLocaleString()}</td>
                <td className="text-right py-1.5 text-[var(--color-text)]">{h.distinct_authors}</td>
                <td className="py-1.5 px-2">
                  <div className="w-full bg-[var(--color-surface)] rounded-full h-1.5">
                    <div
                      className="h-full rounded-full bg-sky-500/60"
                      style={{ width: `${(h.total_churn / maxChurn) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
