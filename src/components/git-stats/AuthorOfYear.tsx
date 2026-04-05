import { useState, useMemo } from 'react';
import type { AuthorOfPeriod } from '../../types/gitStats';

interface Props {
  readonly authorOfYear: AuthorOfPeriod[];
}

type SortKey = 'period' | 'authorName' | 'commits' | 'totalAuthors';

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

export function AuthorOfYear({ authorOfYear }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('period');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const items = [...authorOfYear];
    items.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return items;
  }, [authorOfYear, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (authorOfYear.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th
              className="text-left py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors"
              onClick={() => toggleSort('period')}
            >
              Year <SortIcon active={sortKey === 'period'} dir={sortDir} />
            </th>
            <th
              className="text-left py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors"
              onClick={() => toggleSort('authorName')}
            >
              Author <SortIcon active={sortKey === 'authorName'} dir={sortDir} />
            </th>
            <th
              className="text-right py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors w-24"
              onClick={() => toggleSort('commits')}
            >
              Commits <SortIcon active={sortKey === 'commits'} dir={sortDir} />
            </th>
            <th
              className="text-right py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors w-28"
              onClick={() => toggleSort('totalAuthors')}
            >
              Total Authors <SortIcon active={sortKey === 'totalAuthors'} dir={sortDir} />
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry) => (
            <tr
              key={`${entry.period}-${entry.authorName}`}
              className="border-b border-border/50 hover:bg-surface-hover transition-colors"
            >
              <td className="py-2.5 px-3 text-text font-medium">{entry.period}</td>
              <td className="py-2.5 px-3 text-text">{entry.authorName}</td>
              <td className="py-2.5 px-3 text-right tabular-nums text-neon font-semibold">
                {entry.commits.toLocaleString()}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-text-muted">
                {entry.totalAuthors.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
