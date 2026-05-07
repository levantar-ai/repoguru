import { useState, type ReactNode } from 'react';
import {
  type ReportCardData,
  type ReportCardCategory,
  type Grade,
  GRADE_COLORS,
  scoreToGrade,
} from './reportCardTypes.js';

export interface CompareDelta {
  /** Category key, matching `ReportCardCategory.key` in both reports. */
  category: string;
  scoreA: number;
  scoreB: number;
  /** scoreA - scoreB. */
  delta: number;
  winner: 'a' | 'b' | 'tie';
}

export interface CompareViewProps {
  reportA: ReportCardData;
  reportB: ReportCardData;
  /** Per-category deltas (CLI emits these directly; the browser computes them from the two reports). */
  deltas: CompareDelta[];
  /** Overall winner ('a' | 'b' | 'tie'). */
  winner: 'a' | 'b' | 'tie';
  /** reportA.overallScore - reportB.overallScore. */
  scoreDelta: number;
  /** Optional action bar shown above the comparison. */
  actions?: ReactNode;
  /** Optional sections rendered below the category breakdown (e.g. browser-only
   *  tech-stack and stats comparisons). */
  extras?: ReactNode;
}

/**
 * Authoritative side-by-side repo comparison. Both apps render this against
 * a pair of `ReportCardData` plus a `CompareDelta[]`:
 *   - browser app projects two `LightAnalysisReport`s into `ReportCardData`
 *     and computes deltas from them.
 *   - desktop app projects two `ScoreResponse`s via `scoreToReportCardData`
 *     and maps the CLI's `ComparisonDelta[]` straight into `CompareDelta[]`.
 */
export function CompareView({
  reportA,
  reportB,
  deltas,
  winner,
  scoreDelta,
  actions,
  extras,
}: CompareViewProps) {
  const nameA = `${reportA.repo.owner}/${reportA.repo.repo}`;
  const nameB = `${reportB.repo.owner}/${reportB.repo.repo}`;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="space-y-8">
      {actions && <div className="flex items-center justify-end">{actions}</div>}

      <header className="flex items-center justify-center gap-4 sm:gap-6 text-center">
        <h2 className="text-lg sm:text-xl font-bold text-text truncate max-w-[40%]">{nameA}</h2>
        <span className="text-text-muted text-sm font-medium shrink-0">vs</span>
        <h2 className="text-lg sm:text-xl font-bold text-text truncate max-w-[40%]">{nameB}</h2>
      </header>

      <div className="flex items-center justify-center gap-6 sm:gap-12">
        <GradeBadge
          grade={reportA.grade}
          score={reportA.overallScore}
          label={reportA.repo.repo}
          isWinner={winner === 'a'}
        />
        <div className="text-2xl text-text-muted font-light">vs</div>
        <GradeBadge
          grade={reportB.grade}
          score={reportB.overallScore}
          label={reportB.repo.repo}
          isWinner={winner === 'b'}
        />
      </div>

      <WinnerBanner nameA={nameA} nameB={nameB} winner={winner} scoreDelta={scoreDelta} />

      <section
        aria-labelledby="compare-categories"
        className="p-5 sm:p-6 rounded-2xl bg-surface-alt border border-border"
      >
        <h3 id="compare-categories" className="text-lg font-semibold text-text mb-5">
          Category Breakdown
        </h3>
        <div className="space-y-1">
          {deltas.map((d) => {
            const catA = reportA.categories.find((c) => c.key === d.category);
            const catB = reportB.categories.find((c) => c.key === d.category);
            if (!catA || !catB) return null;
            return (
              <CategoryRow
                key={d.category}
                label={catA.label || catB.label || d.category}
                delta={d}
                signalsA={catA}
                signalsB={catB}
                isExpanded={expanded.has(d.category)}
                onToggle={() => toggle(d.category)}
              />
            );
          })}
        </div>
      </section>

      {extras}
    </div>
  );
}

/** Helper: derive `CompareDelta[]` from two `ReportCardData`s.
 *  Used by the browser host where the pipeline produces two reports
 *  but no pre-baked delta array (the CLI emits its own). */
export function computeDeltasFromReports(a: ReportCardData, b: ReportCardData): CompareDelta[] {
  const result: CompareDelta[] = [];
  for (const catA of a.categories) {
    const catB = b.categories.find((c) => c.key === catA.key);
    if (!catB) continue;
    const delta = catA.score - catB.score;
    result.push({
      category: catA.key,
      scoreA: catA.score,
      scoreB: catB.score,
      delta,
      winner: delta > 0 ? 'a' : delta < 0 ? 'b' : 'tie',
    });
  }
  return result;
}

// ─────────────────────────── primitives ───────────────────────────

function GradeBadge({
  grade,
  score,
  label,
  isWinner,
}: {
  grade: Grade;
  score: number;
  label: string;
  isWinner: boolean;
}) {
  const color = GRADE_COLORS[grade];
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center border-2 transition-all ${
          isWinner ? 'border-neon/60 bg-neon/10' : 'border-border bg-surface-alt'
        }`}
        style={isWinner ? { boxShadow: `0 0 18px ${color}40` } : undefined}
        aria-label={`${label}: grade ${grade}, score ${score} out of 100`}
      >
        <span
          className="text-2xl sm:text-3xl font-bold"
          style={{ color, textShadow: `0 0 12px ${color}30` }}
        >
          {grade}
        </span>
        <span className="text-xs sm:text-sm font-medium" style={{ color }}>
          {score}/100
        </span>
      </div>
      <span className="text-xs text-text-muted truncate max-w-[100px] sm:max-w-[140px]">
        {label}
      </span>
    </div>
  );
}

function WinnerBanner({
  nameA,
  nameB,
  winner,
  scoreDelta,
}: {
  nameA: string;
  nameB: string;
  winner: 'a' | 'b' | 'tie';
  scoreDelta: number;
}) {
  if (winner === 'tie') {
    return (
      <div className="text-center py-3 px-6 rounded-xl bg-neon/10 border border-neon/25">
        <span className="text-neon font-bold text-lg">It's a tie!</span>
        <p className="text-sm text-text-secondary mt-1">Both repositories scored equally.</p>
      </div>
    );
  }
  const winnerName = winner === 'a' ? nameA : nameB;
  const margin = Math.abs(scoreDelta);
  return (
    <div className="text-center py-3 px-6 rounded-xl bg-neon/10 border border-neon/25">
      <span className="text-neon font-bold text-lg">{winnerName}</span>
      <span className="text-text-secondary text-lg"> wins by </span>
      <span className="text-neon font-bold text-lg">{margin}</span>
      <span className="text-text-secondary text-lg"> point{margin !== 1 ? 's' : ''}</span>
    </div>
  );
}

function CategoryRow({
  label,
  delta,
  signalsA,
  signalsB,
  isExpanded,
  onToggle,
}: {
  label: string;
  delta: CompareDelta;
  signalsA: ReportCardCategory;
  signalsB: ReportCardCategory;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const aWins = delta.winner === 'a';
  const bWins = delta.winner === 'b';
  const colorA = GRADE_COLORS[scoreToGrade(delta.scoreA)];
  const colorB = GRADE_COLORS[scoreToGrade(delta.scoreB)];

  // Signal-level diff: signals present-in-only-one of the two repos.
  const allNames = new Set([
    ...signalsA.signals.map((s) => s.name),
    ...signalsB.signals.map((s) => s.name),
  ]);
  const diffSignals: { name: string; foundA: boolean; foundB: boolean }[] = [];
  for (const name of allNames) {
    const foundA = signalsA.signals.find((s) => s.name === name)?.found ?? false;
    const foundB = signalsB.signals.find((s) => s.name === name)?.found ?? false;
    if (foundA !== foundB) diffSignals.push({ name, foundA, foundB });
  }

  return (
    <div className="rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3 hover:bg-surface-hover rounded-xl transition-colors"
        aria-expanded={isExpanded}
      >
        <span
          className="text-sm sm:text-base font-bold w-10 text-right shrink-0 tabular-nums"
          style={{ color: aWins ? '#22d3ee' : colorA }}
        >
          {delta.scoreA}
        </span>

        <div className="flex-1 flex items-center gap-0.5 min-w-0">
          <div className="flex-1 h-3 sm:h-4 rounded-l-full bg-surface-hover overflow-hidden flex justify-end">
            <div
              className="h-full rounded-l-full transition-all duration-500"
              style={{
                width: `${delta.scoreA}%`,
                backgroundColor: aWins ? '#22d3ee' : 'rgba(148,163,184,0.3)',
                boxShadow: aWins ? '0 0 8px rgba(34,211,238,0.45)' : undefined,
              }}
            />
          </div>
          <div className="flex-1 h-3 sm:h-4 rounded-r-full bg-surface-hover overflow-hidden flex justify-start">
            <div
              className="h-full rounded-r-full transition-all duration-500"
              style={{
                width: `${delta.scoreB}%`,
                backgroundColor: bWins ? '#22d3ee' : 'rgba(148,163,184,0.3)',
                boxShadow: bWins ? '0 0 8px rgba(34,211,238,0.45)' : undefined,
              }}
            />
          </div>
        </div>

        <span
          className="text-sm sm:text-base font-bold w-10 text-left shrink-0 tabular-nums"
          style={{ color: bWins ? '#22d3ee' : colorB }}
        >
          {delta.scoreB}
        </span>

        <svg
          className={`h-4 w-4 text-text-muted shrink-0 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div className="text-center -mt-1 mb-1">
        <span className="text-xs sm:text-sm text-text-secondary font-medium">{label}</span>
        {delta.delta !== 0 && (
          <span
            className="ml-2 text-xs font-semibold tabular-nums"
            style={{ color: delta.delta > 0 ? '#22d3ee' : '#f97316' }}
          >
            {delta.delta > 0 ? '+' : ''}
            {delta.delta}
          </span>
        )}
        {diffSignals.length > 0 && (
          <span className="ml-1.5 text-xs text-text-muted">
            ({diffSignals.length} diff{diffSignals.length !== 1 ? 's' : ''})
          </span>
        )}
      </div>

      {isExpanded && (
        <div className="mx-3 sm:mx-4 mb-3 p-3 sm:p-4 rounded-lg bg-surface-hover border border-border">
          {diffSignals.length > 0 ? (
            <>
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Signal Differences
              </h4>
              <div className="space-y-1.5">
                {diffSignals.map((sig) => (
                  <div key={sig.name} className="flex items-center text-sm gap-2">
                    <span className="w-5 text-center shrink-0">
                      {sig.foundA ? (
                        <span style={{ color: GRADE_COLORS.A }}>+</span>
                      ) : (
                        <span style={{ color: GRADE_COLORS.F }}>−</span>
                      )}
                    </span>
                    <span className="flex-1 text-text-secondary truncate">{sig.name}</span>
                    <span className="w-5 text-center shrink-0">
                      {sig.foundB ? (
                        <span style={{ color: GRADE_COLORS.A }}>+</span>
                      ) : (
                        <span style={{ color: GRADE_COLORS.F }}>−</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-text-muted mt-2 pt-2 border-t border-border">
                <span>Repo A</span>
                <span>Repo B</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-text-muted text-center">No signal differences in {label}.</p>
          )}
        </div>
      )}
    </div>
  );
}
