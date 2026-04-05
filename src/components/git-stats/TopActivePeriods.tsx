import { useState, useMemo } from 'react';
import type { ActivePeriod } from '../../types/gitStats';

interface Props {
  readonly topActivePeriods: ActivePeriod[];
}

type SortKey = 'period' | 'commits' | 'insertions' | 'deletions';

function SortIcon({ active, dir }: Readonly<{ active: boolean; dir: 'asc' | 'desc' }>) {
  if (!active) return null;
  return (
    <svg
      className="h-3 w-3 text-neon ml-1 inline"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      {dir === 'desc' ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
      )}
    </svg>
  );
}

const RANK_BORDERS: Record<number, string> = {
  0: 'border-l-4 border-l-yellow-400',
  1: 'border-l-4 border-l-gray-300',
  2: 'border-l-4 border-l-amber-600',
};

export function TopActivePeriods({ topActivePeriods }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('commits');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const items = [...topActivePeriods];
    items.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return items;
  }, [topActivePeriods, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (topActivePeriods.length === 0) return null;

  const maxCommits = Math.max(...topActivePeriods.map((e) => e.commits), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-center py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider w-12">
              #
            </th>
            <th
              className="text-left py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors"
              onClick={() => toggleSort('period')}
            >
              Period <SortIcon active={sortKey === 'period'} dir={sortDir} />
            </th>
            <th
              className="text-right py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors w-24"
              onClick={() => toggleSort('commits')}
            >
              Commits <SortIcon active={sortKey === 'commits'} dir={sortDir} />
            </th>
            <th className="text-left py-3 px-3 w-40 hidden sm:table-cell" />
            <th
              className="text-right py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors w-24 hidden md:table-cell"
              onClick={() => toggleSort('insertions')}
            >
              Insertions <SortIcon active={sortKey === 'insertions'} dir={sortDir} />
            </th>
            <th
              className="text-right py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors w-24 hidden md:table-cell"
              onClick={() => toggleSort('deletions')}
            >
              Deletions <SortIcon active={sortKey === 'deletions'} dir={sortDir} />
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, i) => (
            <tr
              key={entry.period}
              className={`border-b border-border/50 hover:bg-surface-hover transition-colors ${RANK_BORDERS[i] ?? ''}`}
            >
              <td className="py-2.5 px-3 text-center tabular-nums text-text-muted font-semibold">
                {i + 1}
              </td>
              <td className="py-2.5 px-3 text-text font-medium">{entry.period}</td>
              <td className="py-2.5 px-3 text-right tabular-nums text-neon font-semibold">
                {entry.commits.toLocaleString()}
              </td>
              <td className="py-2.5 px-3 hidden sm:table-cell">
                <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
                  <div
                    className="h-full bg-neon/40 rounded-full"
                    style={{ width: `${(entry.commits / maxCommits) * 100}%` }}
                  />
                </div>
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-grade-a text-xs hidden md:table-cell">
                +{entry.insertions.toLocaleString()}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-grade-f text-xs hidden md:table-cell">
                -{entry.deletions.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
