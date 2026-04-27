import { useState, useMemo } from 'react';
import type { LetterGrade } from '../../types';
import { GRADE_COLORS } from '../../utils/constants';
import { scoreToGrade, gradeColorClass } from '../../utils/formatters';

interface RepoRow {
  name: string;
  categories: Record<string, number>;
  overallScore: number;
  grade: string;
}

interface Props {
  repos: RepoRow[];
  categoryKeys: string[];
  categoryLabels: Record<string, string>;
  onRepoClick?: (name: string) => void;
}

type SortKey = 'name' | 'overall' | string;
type SortDir = 'asc' | 'desc';

function cellBgStyle(score: number): React.CSSProperties {
  const grade = scoreToGrade(score);
  const color = GRADE_COLORS[grade];
  return { backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` };
}

export function HeatmapGrid({ repos, categoryKeys, categoryLabels, onRepoClick }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('overall');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = useMemo(() => {
    const copy = [...repos];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      if (sortKey === 'name') {
        return dir * a.name.localeCompare(b.name);
      }
      if (sortKey === 'overall') {
        return dir * (a.overallScore - b.overallScore);
      }
      // Category sort
      const aVal = a.categories[sortKey] ?? 0;
      const bVal = b.categories[sortKey] ?? 0;
      return dir * (aVal - bVal);
    });
    return copy;
  }, [repos, sortKey, sortDir]);

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return (
      <span className="ml-1 text-neon-dim text-[10px]">
        {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
      </span>
    );
  };

  return (
    <section
      className="overflow-x-auto rounded-xl border border-border"
      aria-label="Repository scores heatmap"
    >
      <table className="w-full text-sm" aria-label="Repository category scores">
        <thead>
          <tr className="bg-surface-alt border-b border-border">
            <th
              className="text-left px-4 py-3 text-text-secondary font-semibold cursor-pointer hover:text-neon transition-colors select-none"
              onClick={() => handleSort('name')}
              aria-sort={(() => {
                if (sortKey !== 'name') return 'none';
                return sortDir === 'asc' ? 'ascending' : 'descending';
              })()}
              scope="col"
            >
              Repository{sortIndicator('name')}
            </th>
            {categoryKeys.map((key) => {
              let catSortValue: 'none' | 'ascending' | 'descending' = 'none';
              if (sortKey === key) {
                catSortValue = sortDir === 'asc' ? 'ascending' : 'descending';
              }
              return (
                <th
                  key={key}
                  className="text-center px-3 py-3 text-text-secondary font-semibold cursor-pointer hover:text-neon transition-colors select-none whitespace-nowrap"
                  onClick={() => handleSort(key)}
                  aria-sort={catSortValue}
                  scope="col"
                >
                  {categoryLabels[key] || key}
                  {sortIndicator(key)}
                </th>
              );
            })}
            <th
              className="text-center px-4 py-3 text-text-secondary font-semibold cursor-pointer hover:text-neon transition-colors select-none"
              onClick={() => handleSort('overall')}
              aria-sort={(() => {
                if (sortKey !== 'overall') return 'none';
                return sortDir === 'asc' ? 'ascending' : 'descending';
              })()}
              scope="col"
            >
              Grade{sortIndicator('overall')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((repo) => (
            <tr
              key={repo.name}
              className="border-b border-border last:border-b-0 hover:bg-surface-hover transition-colors"
            >
              <td className="px-4 py-3">
                {onRepoClick ? (
                  <button
                    onClick={() => onRepoClick(repo.name)}
                    className="text-neon hover:text-neon-dim font-medium transition-colors text-left"
                  >
                    {repo.name}
                  </button>
                ) : (
                  <span className="text-text font-medium">{repo.name}</span>
                )}
              </td>
              {categoryKeys.map((key) => {
                const score = repo.categories[key] ?? 0;
                const grade = scoreToGrade(score);
                return (
                  <td
                    key={key}
                    className="text-center px-3 py-3 font-medium"
                    style={cellBgStyle(score)}
                  >
                    <span className={gradeColorClass(grade)}>{score}</span>
                  </td>
                );
              })}
              <td className="text-center px-4 py-3">
                <span
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-base ${gradeColorClass(repo.grade as LetterGrade)}`}
                  style={{
                    backgroundColor: `color-mix(in srgb, ${GRADE_COLORS[repo.grade as LetterGrade]} 12%, transparent)`,
                  }}
                >
                  {repo.grade}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
