import { useMemo, useState, type ReactNode } from 'react';
import { GRADE_COLORS, type Grade } from './reportCardTypes.js';
import { type OrgScanItem, type OrgScanSummary } from './orgScanTypes.js';

export interface OrgScanViewProps {
  items: OrgScanItem[];
  /** Optional summary card row (totals, average grade, distribution). */
  summary?: OrgScanSummary;
  /** Optional click handler for the repo name button — typically the host
   *  routes the user to a deeper analysis page. */
  onRepoClick?: (item: OrgScanItem) => void;
  /** Optional action bar shown above the table. */
  actions?: ReactNode;
}

type SortField = 'name' | 'grade' | 'overall' | string;
type SortDir = 'asc' | 'desc';

const GRADE_ORDER: Record<Grade, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };

/**
 * Authoritative org-scan results table. Both apps project their per-repo
 * results into `OrgScanItem[]` and render here:
 *   - browser app projects `LightAnalysisReport[]` (one entry per scanned
 *     repo) and supplies its filter/sort UI as host-local chrome above.
 *   - desktop app accumulates the streamed `RepoScore[]` from `ScanOrg`
 *     and supplies the running summary.
 *
 * The view owns the table's column-derivation, sort UX, and mobile card
 * fallback. Filtering and tagging stay host-local — the host filters
 * before passing `items`.
 */
export function OrgScanView({ items, summary, onRepoClick, actions }: OrgScanViewProps) {
  const [sortField, setSortField] = useState<SortField>('overall');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Derive the category column list from the first item — both apps emit a
  // canonical set, so this is sufficient.
  const columns = useMemo<OrgScanItem['categories']>(() => items[0]?.categories ?? [], [items]);

  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = `${a.repo.owner}/${a.repo.repo}`.localeCompare(`${b.repo.owner}/${b.repo.repo}`);
      } else if (sortField === 'grade') {
        cmp = GRADE_ORDER[a.grade] - GRADE_ORDER[b.grade];
      } else if (sortField === 'overall') {
        cmp = a.overallScore - b.overallScore;
      } else {
        const aCat = a.categories.find((c) => c.key === sortField)?.score ?? 0;
        const bCat = b.categories.find((c) => c.key === sortField)?.score ?? 0;
        cmp = aCat - bCat;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return arr;
  }, [items, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="space-y-6">
      {actions && <div className="flex items-center justify-end">{actions}</div>}

      {summary && <SummaryCards summary={summary} />}

      {/* Desktop table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-alt border-b border-border">
                <SortHeader
                  field="name"
                  label="Repository"
                  sortField={sortField}
                  sortDir={sortDir}
                  onToggleSort={toggleSort}
                  className="min-w-[180px] sticky left-0 bg-surface-alt z-10"
                />
                <SortHeader
                  field="grade"
                  label="Grade"
                  sortField={sortField}
                  sortDir={sortDir}
                  onToggleSort={toggleSort}
                />
                <SortHeader
                  field="overall"
                  label="Score"
                  sortField={sortField}
                  sortDir={sortDir}
                  onToggleSort={toggleSort}
                />
                {columns.map((col) => (
                  <SortHeader
                    key={col.key}
                    field={col.key}
                    label={col.label}
                    sortField={sortField}
                    sortDir={sortDir}
                    onToggleSort={toggleSort}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((item, idx) => (
                <tr
                  key={`${item.repo.owner}/${item.repo.repo}`}
                  className={`border-b border-border hover:bg-surface-hover transition-colors ${
                    idx % 2 === 0 ? '' : 'bg-surface-alt/30'
                  }`}
                >
                  <td className="py-3 px-3 sticky left-0 bg-inherit z-10">
                    {onRepoClick ? (
                      <button
                        onClick={() => onRepoClick(item)}
                        className="text-neon hover:underline font-medium text-left"
                        title={`Open ${item.repo.owner}/${item.repo.repo}`}
                      >
                        {item.repo.repo}
                      </button>
                    ) : (
                      <span className="font-medium">{item.repo.repo}</span>
                    )}
                    {item.language && (
                      <span className="ml-2 text-xs text-text-muted">{item.language}</span>
                    )}
                  </td>
                  <td
                    className="py-3 px-3 font-bold text-lg"
                    style={{ color: GRADE_COLORS[item.grade] }}
                  >
                    {item.grade}
                  </td>
                  <ScoreCell score={item.overallScore} />
                  {columns.map((col) => {
                    const score = item.categories.find((c) => c.key === col.key)?.score ?? 0;
                    return <ScoreCell key={col.key} score={score} />;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        <p className="text-xs text-text-muted">
          Scroll table horizontally to see all columns, or view repo cards below:
        </p>
        {sorted.map((item) => (
          <div
            key={`card-${item.repo.owner}/${item.repo.repo}`}
            className="p-4 rounded-xl bg-surface-alt border border-border"
          >
            <div className="flex items-center justify-between mb-3">
              {onRepoClick ? (
                <button
                  onClick={() => onRepoClick(item)}
                  className="text-neon hover:underline font-semibold text-left text-sm"
                >
                  {item.repo.repo}
                </button>
              ) : (
                <span className="font-semibold text-sm">{item.repo.repo}</span>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold" style={{ color: GRADE_COLORS[item.grade] }}>
                  {item.grade}
                </span>
                <span className="text-sm text-text-muted">{item.overallScore}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              {item.categories.map((cat) => (
                <div key={cat.key} className="flex justify-between">
                  <span className="text-text-muted">{cat.label}</span>
                  <span className={scoreTextClass(cat.score)}>{cat.score}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────── helpers ───────────────────────────

function SummaryCards({ summary }: { summary: OrgScanSummary }) {
  const dist = summary.gradeDistribution ?? {};
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="rounded-xl border border-border bg-surface-alt p-4 text-center">
        <div className="text-2xl font-bold text-text">{summary.totalRepos}</div>
        <div className="text-xs text-text-muted uppercase tracking-wider">Repositories</div>
      </div>
      <div className="rounded-xl border border-border bg-surface-alt p-4 text-center">
        <div className="text-2xl font-bold" style={{ color: GRADE_COLORS[summary.averageGrade] }}>
          {summary.averageGrade}
        </div>
        <div className="text-xs text-text-muted uppercase tracking-wider">
          Average Grade ({Math.round(summary.averageScore)})
        </div>
      </div>
      <div className="rounded-xl border border-border bg-surface-alt p-4">
        <div className="flex items-center justify-center gap-3">
          {(['A', 'B', 'C', 'D', 'F'] as Grade[]).map((g) => (
            <div key={g} className="text-center">
              <div className="text-sm font-bold" style={{ color: GRADE_COLORS[g] }}>
                {dist[g] ?? 0}
              </div>
              <div className="text-[10px] text-text-muted">{g}</div>
            </div>
          ))}
        </div>
        <div className="text-xs text-text-muted text-center mt-1 uppercase tracking-wider">
          Distribution
        </div>
      </div>
    </div>
  );
}

function SortHeader({
  field,
  label,
  className = '',
  sortField,
  sortDir,
  onToggleSort,
}: {
  field: SortField;
  label: string;
  className?: string;
  sortField: SortField;
  sortDir: SortDir;
  onToggleSort: (field: SortField) => void;
}) {
  return (
    <th
      className={`py-3 px-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary cursor-pointer select-none hover:text-neon transition-colors whitespace-nowrap ${className}`}
      onClick={() => onToggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortField === field && (
          <svg
            className="h-3 w-3 text-neon"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            {sortDir === 'desc' ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M19 9l-7 7-7-7"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 15l7-7 7 7"
              />
            )}
          </svg>
        )}
      </span>
    </th>
  );
}

function ScoreCell({ score }: { score: number }) {
  return (
    <td className={`py-3 px-3 font-medium ${scoreTextClass(score)}`}>
      <span
        className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${scoreBgClass(score)} ${scoreTextClass(score)}`}
      >
        {score}
      </span>
    </td>
  );
}

function scoreTextClass(score: number): string {
  if (score >= 85) return 'text-grade-a';
  if (score >= 70) return 'text-grade-b';
  if (score >= 55) return 'text-grade-c';
  if (score >= 40) return 'text-grade-d';
  return 'text-grade-f';
}

function scoreBgClass(score: number): string {
  if (score >= 85) return 'bg-grade-a/15';
  if (score >= 70) return 'bg-grade-b/15';
  if (score >= 55) return 'bg-grade-c/15';
  if (score >= 40) return 'bg-grade-d/15';
  return 'bg-grade-f/15';
}
