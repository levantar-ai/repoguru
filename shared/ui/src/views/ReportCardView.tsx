import { useMemo, type ReactNode } from 'react';
import { RadarChart } from '../charts/RadarChart.js';
import { InfoIcon } from '../chrome/SignalDocs.js';
import {
  type ReportCardData,
  type ReportCardCategory,
  GRADE_COLORS,
  scoreToGrade,
  gradeAdjective,
} from './reportCardTypes.js';

interface StrengthCard {
  category: ReportCardCategory;
  passedSignals: string[];
}
interface RiskCard {
  category: ReportCardCategory;
  missingSignals: string[];
}
interface NextStepCard {
  signal: string;
  category: ReportCardCategory;
}

/** Derive structured insight cards from the per-category data. Each card
 *  carries category context + evidence so the view can render polished
 *  cards (icon, score pill, chips) instead of opaque text lines. */
function deriveInsights(report: ReportCardData): {
  strengths: StrengthCard[];
  risks: RiskCard[];
  nextSteps: NextStepCard[];
} {
  const strengths: StrengthCard[] = [];
  const risks: RiskCard[] = [];
  const nextSteps: NextStepCard[] = [];

  for (const cat of report.categories) {
    const applicableSignals = cat.signals.filter((s) => !s.notApplicable);
    if (cat.score >= 80) {
      strengths.push({
        category: cat,
        passedSignals: applicableSignals.filter((s) => s.found).map((s) => s.name),
      });
    } else if (cat.score < 50) {
      risks.push({
        category: cat,
        missingSignals: applicableSignals.filter((s) => !s.found).map((s) => s.name),
      });
    }
  }

  // Next steps: top-weight failing category first, take its missing
  // (and applicable) signals as TODOs. Stop at 8 to keep it scannable.
  const failing = [...report.categories]
    .filter((c) => c.score < 80)
    .sort((a, b) => b.weight - a.weight);
  outer: for (const cat of failing) {
    for (const sig of cat.signals) {
      if (!sig.found && !sig.notApplicable) {
        nextSteps.push({ signal: sig.name, category: cat });
        if (nextSteps.length >= 8) break outer;
      }
    }
  }

  return { strengths, risks, nextSteps };
}

export interface ReportCardViewProps {
  report: ReportCardData;
  /** Optional action bar (e.g. "New Analysis", export buttons) shown in the header. */
  actions?: ReactNode;
}

/**
 * Authoritative report card view. Rendered identically by both apps:
 * the browser app passes its AnalysisReport projected into ReportCardData;
 * the desktop app projects its gRPC ScoreResponse the same way.
 *
 * Single scrollable page (no tabs). Read top-to-bottom:
 *   1. Header — repo identity + grade
 *   2. Insights — Strengths / Risks / Next Steps (derived from category data)
 *   3. Detail — per-category breakdown with signals
 *
 * The previous tabbed layout (Overview / Strengths / Risks / Next Steps)
 * was modal noise — all four panes summarised the same source data, so
 * forcing users to click between them to assemble the story was busywork.
 */
export function ReportCardView({ report, actions }: ReportCardViewProps) {
  const insights = useMemo(() => deriveInsights(report), [report]);
  const radarData = report.categories.map((c) => ({
    label: c.label,
    value: c.score,
    max: 100,
  }));

  return (
    <article
      className="w-full px-6 lg:px-10 2xl:px-16 py-8"
      aria-label={`Report card for ${report.repo.owner}/${report.repo.repo}`}
    >
      <ReportCardHeader report={report} actions={actions} />
      {report.repoInfo?.archived && (
        <div className="mt-4 text-sm">
          <span className="text-grade-c font-semibold" role="alert">
            This repository is archived.
          </span>
        </div>
      )}
      {report.treeOnly && (
        <div
          role="status"
          className="mt-4 flex items-start gap-3 rounded-lg border border-grade-c/30 bg-grade-c/5 p-3 text-sm"
        >
          <svg
            className="h-4 w-4 mt-0.5 shrink-0 text-grade-c"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v4m0 4h.01M4.93 19h14.14a2 2 0 001.74-3l-7.07-12a2 2 0 00-3.48 0l-7.07 12a2 2 0 001.74 3z"
            />
          </svg>
          <div className="text-text-secondary">
            <span className="text-text font-semibold">Partial analysis.</span> The in-browser clone
            failed for this repository — likely too large or a network timeout. Some checks that
            need to read file contents (workflows, manifests) are skipped and marked below. Re-run
            the analysis to retry the clone.
          </div>
        </div>
      )}

      {/* ── Hero: grade + insights ──
       *  Layout responds to viewport width:
       *    mobile  → stacked: grade, then insights stacked.
       *    lg      → grade column left, insights stacked right.
       *    xl+     → grade column left, insights as 3 columns
       *              side-by-side — uses the full landscape.
       */}
      <section
        aria-label="Summary"
        className="mt-8 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8 lg:gap-10"
      >
        <div className="flex flex-col items-center gap-4">
          <LetterGrade grade={report.grade} score={report.overallScore} />
          <div className="text-center inline-flex items-center justify-center gap-1.5">
            <GradeStatusBadge grade={report.grade} />
            <span className="text-sm font-medium" style={{ color: GRADE_COLORS[report.grade] }}>
              {gradeAdjective(report.grade)}
            </span>
          </div>
          <div className="hidden lg:block">
            <RadarChart data={radarData} size={220} />
          </div>
        </div>
        <div className="min-w-0 grid gap-4 grid-cols-1 xl:grid-cols-3">
          <InsightsColumn
            title="Strengths"
            variant="green"
            count={insights.strengths.length}
            emptyLabel="No categories scored ≥80 yet."
          >
            {insights.strengths.map((s) => (
              <StrengthCardEl key={s.category.key} card={s} />
            ))}
          </InsightsColumn>
          <InsightsColumn
            title="Risks"
            variant="yellow"
            count={insights.risks.length}
            emptyLabel="No categories scored <50. Well done."
          >
            {insights.risks.map((r) => (
              <RiskCardEl key={r.category.key} card={r} />
            ))}
          </InsightsColumn>
          <InsightsColumn
            title="Next steps"
            variant="blue"
            count={insights.nextSteps.length}
            emptyLabel="Nothing obvious to add."
          >
            {insights.nextSteps.map((n, i) => (
              <NextStepCardEl key={`${n.category.key}-${i}`} card={n} index={i + 1} />
            ))}
          </InsightsColumn>
        </div>
      </section>

      {/* Mobile-only radar — kept compact + centered so the polar
          labels don't overflow at 320–390px viewport widths. The
          chart's own labels sit ~25-30px outside its radius, so the
          containing block needs at least size+60 of room. */}
      <div className="lg:hidden flex justify-center mt-8 overflow-hidden">
        <RadarChart data={radarData} size={220} />
      </div>

      {/* ── Detail: per-category breakdown ── */}
      <section aria-labelledby="detail-heading" className="mt-12">
        <h2 id="detail-heading" className="text-lg font-semibold text-text mb-5">
          Category breakdown
        </h2>
        <CategoryScores categories={report.categories} />
      </section>
    </article>
  );
}

// ───────────────────────── header ─────────────────────────

function ReportCardHeader({ report, actions }: { report: ReportCardData; actions?: ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
      <div>
        {/* Owner/repo path is rendered uniformly — accenting just the
         *  leaf is a Linear/GitHub anti-pattern; owner is the namespace
         *  and the path is hierarchically equal at both halves. */}
        <h1 className="text-2xl lg:text-3xl font-semibold text-text">
          {report.repo.owner}/{report.repo.repo}
        </h1>
        {report.repoInfo?.description && (
          <p className="text-base text-text-secondary mt-2 max-w-2xl">
            {report.repoInfo.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-text-muted">
          {report.repoInfo?.stars !== undefined && (
            <>
              <span>{formatNumber(report.repoInfo.stars)} stars</span>
              <span className="text-border" aria-hidden="true">
                |
              </span>
            </>
          )}
          {report.repoInfo?.forks !== undefined && (
            <>
              <span>{formatNumber(report.repoInfo.forks)} forks</span>
              <span className="text-border" aria-hidden="true">
                |
              </span>
            </>
          )}
          {report.repoInfo?.openIssues !== undefined && (
            <>
              <span>{formatNumber(report.repoInfo.openIssues)} issues</span>
              <span className="text-border" aria-hidden="true">
                |
              </span>
            </>
          )}
          <span>Analyzed {formatDate(report.analyzedAt)}</span>
        </div>
      </div>
      {actions}
    </div>
  );
}

// ───────────────────────── primitives ─────────────────────────

/** Maps a letter grade to a non-colour cue so users with red/amber
 *  colour-blindness (Deutan/Protan) can distinguish F from D, A from B
 *  etc. The shapes are also redundantly meaningful for reduced-vision
 *  users where a 12px hue is hard to read. */
function gradeShape(grade: ReportCardData['grade']): {
  kind: 'check' | 'warn' | 'cross';
  label: string;
} {
  if (grade === 'A' || grade === 'B') return { kind: 'check', label: 'Healthy' };
  if (grade === 'C') return { kind: 'warn', label: 'Needs attention' };
  return { kind: 'cross', label: 'Critical' };
}

function GradeStatusBadge({
  grade,
  className = '',
}: {
  grade: ReportCardData['grade'];
  className?: string;
}) {
  const shape = gradeShape(grade);
  const color = GRADE_COLORS[grade];
  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      style={{ color }}
      aria-label={shape.label}
    >
      {shape.kind === 'check' && (
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {shape.kind === 'warn' && (
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v4M12 17h.01M4.93 19h14.14a2 2 0 001.74-3l-7.07-12a2 2 0 00-3.48 0l-7.07 12a2 2 0 001.74 3z"
          />
        </svg>
      )}
      {shape.kind === 'cross' && (
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
    </span>
  );
}

function LetterGrade({ grade, score }: { grade: ReportCardData['grade']; score: number }) {
  const color = GRADE_COLORS[grade];
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const viewBox = 176;
  const center = viewBox / 2;
  const shape = gradeShape(grade);

  return (
    <div
      className="relative h-44 w-44 flex items-center justify-center"
      aria-label={`Overall grade: ${grade}, score ${score} out of 100, ${shape.label}`}
    >
      <svg
        className="absolute inset-0 -rotate-90"
        viewBox={`0 0 ${viewBox} ${viewBox}`}
        aria-hidden="true"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={5}
          className="text-border"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          // Lighter ring shadow (was 60% alpha → punitive for an F).
          // The grade is diagnostic, not a verdict.
          className="transition-all duration-700 ease-out"
          style={{ filter: `drop-shadow(0 0 4px ${color}30)` }}
        />
      </svg>
      <div className="text-center" aria-hidden="true">
        {/* Score is more diagnostic than the letter — render it
         *  larger. The letter is the at-a-glance summary; the number
         *  is what tells you how far from the next grade you are. */}
        <div className="text-3xl font-bold tabular-nums" style={{ color }}>
          {score}
        </div>
        <div className="text-lg font-semibold mt-0.5" style={{ color }}>
          Grade {grade}
        </div>
      </div>
    </div>
  );
}

function CategoryScores({ categories }: { categories: ReportCardCategory[] }) {
  return (
    <ul className="space-y-6 list-none p-0" aria-label="Category scores">
      {categories.map((cat) => {
        const grade = scoreToGrade(cat.score);
        const color = GRADE_COLORS[grade];
        return (
          <li key={cat.key}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-text">{cat.label}</span>
                <span className="text-xs text-text-muted font-medium px-2 py-0.5 rounded bg-surface-alt border border-border">
                  {Math.round(cat.weight * 100)}% weight
                </span>
              </div>
              <span
                className="inline-flex items-center gap-1.5 text-lg font-bold"
                style={{ color, textShadow: `0 0 10px ${color}30` }}
              >
                <GradeStatusBadge grade={grade} />
                {cat.score}
              </span>
            </div>
            <div className="h-2.5 bg-surface-alt rounded-full overflow-hidden border border-border mb-3">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${cat.score}%`,
                  backgroundColor: color,
                  boxShadow: `0 0 10px ${color}40`,
                }}
                aria-hidden="true"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-x-6 gap-y-1.5 ml-1">
              {cat.signals
                .filter((s) => !s.notApplicable)
                .map((signal) => (
                  <div key={signal.name} className="flex items-start gap-2 text-sm">
                    <span className="shrink-0 mt-0.5">
                      {signal.found ? <CheckIcon /> : <XIcon />}
                    </span>
                    <span className={signal.found ? 'text-text-secondary' : 'text-text-muted'}>
                      {signal.name}
                      {signal.details && (
                        <span className="text-text-muted ml-1">— {signal.details}</span>
                      )}
                      <InfoIcon signalName={signal.name} />
                    </span>
                  </div>
                ))}
              {cat.signals.some((s) => s.notApplicable) && (
                <div
                  className="text-[11px] text-text-muted italic col-span-full mt-1"
                  title={cat.signals
                    .filter((s) => s.notApplicable)
                    .map((s) => `${s.name}: ${s.notApplicableReason ?? 'N/A'}`)
                    .join('\n')}
                >
                  {cat.signals.filter((s) => s.notApplicable).length} signal(s) not applicable for
                  this project type
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ─────────────────────────── insight cards ───────────────────────────

const COLUMN_STYLES = {
  green: {
    header: 'text-grade-a',
    dot: 'bg-grade-a',
    panel: 'border-grade-a/20 bg-grade-a/[0.04]',
  },
  yellow: {
    header: 'text-grade-c',
    dot: 'bg-grade-c',
    panel: 'border-grade-c/20 bg-grade-c/[0.04]',
  },
  blue: {
    header: 'text-neon',
    dot: 'bg-neon',
    panel: 'border-neon/20 bg-neon/[0.04]',
  },
} as const;

function InsightsColumn({
  title,
  variant,
  count,
  emptyLabel,
  children,
}: {
  title: string;
  variant: keyof typeof COLUMN_STYLES;
  count: number;
  emptyLabel: string;
  children: ReactNode;
}) {
  const s = COLUMN_STYLES[variant];
  return (
    <section
      className={`rounded-xl border ${s.panel} p-4 flex flex-col gap-3 min-h-[140px]`}
      aria-label={`${title} (${count})`}
    >
      <header className="flex items-center justify-between">
        <h3
          className={`text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2 ${s.header}`}
        >
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
          {title}
        </h3>
        <span className={`text-xs font-semibold tabular-nums ${s.header}/70`} aria-hidden="true">
          {count}
        </span>
      </header>
      {count === 0 ? (
        <p className="text-sm text-text-muted italic">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  );
}

function StrengthCardEl({ card }: { card: StrengthCard }) {
  return (
    <article className="rounded-lg bg-surface/40 border border-grade-a/15 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text truncate">{card.category.label}</div>
          <div className="text-[11px] text-text-muted mt-0.5">
            {card.passedSignals.length}/
            {card.category.signals.filter((s) => !s.notApplicable).length} signals pass
          </div>
        </div>
        <ScorePill score={card.category.score} />
      </div>
      {card.passedSignals.length > 0 && (
        <ul
          className="mt-2.5 flex flex-wrap gap-1 list-none p-0 m-0"
          aria-label={`Passing checks in ${card.category.label}`}
        >
          {card.passedSignals.slice(0, 4).map((name) => (
            <li key={name}>
              <SignalChip name={name} variant="green" found />
            </li>
          ))}
          {card.passedSignals.length > 4 && (
            <li className="text-[11px] px-1.5 py-0.5 text-text-muted">
              +{card.passedSignals.length - 4} more
            </li>
          )}
        </ul>
      )}
    </article>
  );
}

function RiskCardEl({ card }: { card: RiskCard }) {
  return (
    <article className="rounded-lg bg-surface/40 border border-grade-c/15 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text truncate">{card.category.label}</div>
          <div className="text-[11px] text-text-muted mt-0.5">
            {card.missingSignals.length} of{' '}
            {card.category.signals.filter((s) => !s.notApplicable).length} checks missing
          </div>
        </div>
        <ScorePill score={card.category.score} />
      </div>
      {card.missingSignals.length > 0 && (
        <ul
          className="mt-2.5 flex flex-wrap gap-1 list-none p-0 m-0"
          aria-label={`Missing checks in ${card.category.label}`}
        >
          {card.missingSignals.slice(0, 4).map((name) => (
            <li key={name}>
              <SignalChip name={name} variant="yellow" found={false} />
            </li>
          ))}
          {card.missingSignals.length > 4 && (
            <li className="text-[11px] px-1.5 py-0.5 text-text-muted">
              +{card.missingSignals.length - 4} more
            </li>
          )}
        </ul>
      )}
    </article>
  );
}

function NextStepCardEl({ card, index }: { card: NextStepCard; index: number }) {
  return (
    <article className="rounded-lg bg-surface/40 border border-neon/15 p-3 flex items-start gap-3">
      <span
        className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full bg-neon/15 text-neon text-xs font-semibold tabular-nums"
        aria-hidden="true"
      >
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-text inline-flex items-center gap-1.5">
          Add {card.signal}
          <InfoIcon signalName={card.signal} />
        </div>
        <div className="text-[11px] text-text-muted mt-0.5">{card.category.label}</div>
      </div>
    </article>
  );
}

/** Compact chip showing a signal check + its docs trigger. Whole chip is
 *  clickable when docs exist (info icon hugs the end inside the chip). */
function SignalChip({
  name,
  variant,
  found,
}: {
  name: string;
  variant: 'green' | 'yellow';
  found: boolean;
}) {
  const cls =
    variant === 'green'
      ? 'bg-grade-a/15 text-grade-a/90 border-grade-a/20'
      : 'bg-grade-c/10 text-grade-c/90 border-grade-c/20';
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border ${cls}`}
    >
      <span aria-hidden="true">{found ? '✓' : '✗'}</span>
      {name}
      <InfoIcon signalName={name} />
    </span>
  );
}

function ScorePill({ score }: { score: number }) {
  const grade = scoreToGrade(score);
  const color = GRADE_COLORS[grade];
  return (
    <span
      className="shrink-0 inline-flex items-center justify-center h-6 px-2 rounded-full border text-xs font-bold tabular-nums"
      style={{ color, borderColor: `${color}55`, backgroundColor: `${color}12` }}
      aria-label={`Score ${score} out of 100, grade ${grade}`}
    >
      {score}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-4 w-4 text-grade-a shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      className="h-4 w-4 text-grade-f/50 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.5}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

// ───────────────────────── helpers ─────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}
