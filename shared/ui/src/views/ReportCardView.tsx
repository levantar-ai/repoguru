import { useMemo, type ReactNode } from 'react';
import { RadarChart } from '../charts/RadarChart.js';
import {
  type ReportCardData,
  type ReportCardCategory,
  GRADE_COLORS,
  scoreToGrade,
  gradeAdjective,
} from './reportCardTypes.js';

/** Derive Strengths / Risks / Next Steps from the per-category data when
 *  the upstream service hasn't supplied a hand-curated narrative. The
 *  category breakdown already has everything we need — failing to surface
 *  it left three empty panels on what should be the most useful view. */
function deriveInsights(report: ReportCardData) {
  const strengths: string[] = [...report.strengths];
  const risks: string[] = [...report.risks];
  const nextSteps: string[] = [...report.nextSteps];

  if (strengths.length === 0) {
    for (const cat of report.categories) {
      if (cat.score >= 80) {
        const wins = cat.signals.filter((s) => s.found).length;
        const total = cat.signals.length;
        strengths.push(`${cat.label} — strong (${cat.score}/100, ${wins}/${total} signals).`);
      }
    }
  }

  if (risks.length === 0) {
    for (const cat of report.categories) {
      if (cat.score < 50) {
        const missing = cat.signals.filter((s) => !s.found).map((s) => s.name);
        const missingPreview = missing.slice(0, 3).join(', ');
        const more = missing.length > 3 ? `, +${missing.length - 3} more` : '';
        risks.push(`${cat.label} — weak (${cat.score}/100). Missing: ${missingPreview}${more}.`);
      }
    }
  }

  if (nextSteps.length === 0) {
    // Pick the highest-weight category that scored < 80, and propose
    // its first three missing signals as concrete next steps. Repeat
    // until we have ~6 suggestions or run out.
    const sorted = [...report.categories]
      .filter((c) => c.score < 80)
      .sort((a, b) => b.weight - a.weight);
    outer: for (const cat of sorted) {
      for (const sig of cat.signals) {
        if (!sig.found) {
          nextSteps.push(`Add ${sig.name} (${cat.label}).`);
          if (nextSteps.length >= 6) break outer;
        }
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
          <InsightsBlock
            title="Strengths"
            items={insights.strengths}
            variant="green"
            emptyLabel="No strong categories yet."
          />
          <InsightsBlock
            title="Risks"
            items={insights.risks}
            variant="yellow"
            emptyLabel="No critical risks — well done."
          />
          <InsightsBlock
            title="Next steps"
            items={insights.nextSteps}
            variant="blue"
            emptyLabel="Nothing obvious left to add."
          />
        </div>
      </section>

      {/* Mobile-only radar (hidden alongside grade on lg+) */}
      <div className="lg:hidden flex justify-center mt-8">
        <RadarChart data={radarData} size={260} />
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
              {cat.signals.map((signal) => (
                <div key={signal.name} className="flex items-center gap-2 text-sm">
                  {signal.found ? <CheckIcon /> : <XIcon />}
                  <span className={signal.found ? 'text-text-secondary' : 'text-text-muted'}>
                    {signal.name}
                    {signal.details && (
                      <span className="text-text-muted ml-1">— {signal.details}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function InsightsBlock({
  title,
  items,
  variant,
  emptyLabel,
}: {
  title: string;
  items: string[];
  variant: 'green' | 'yellow' | 'blue';
  emptyLabel: string;
}) {
  const colorClass = {
    green: 'text-grade-a border-grade-a/25 bg-grade-a/10',
    yellow: 'text-grade-c border-grade-c/25 bg-grade-c/10',
    blue: 'text-neon border-neon/25 bg-neon/10',
  }[variant];

  return (
    <section className={`rounded-xl border p-4 ${colorClass}`}>
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-2 opacity-80">
        {title}
        {items.length > 0 && (
          <span className="ml-1.5 opacity-60 tabular-nums" aria-label={`${items.length} items`}>
            ({items.length})
          </span>
        )}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-text-muted">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1.5 text-sm text-text-secondary list-none p-0 m-0">
          {items.map((item, i) => (
            <li key={i} className="leading-snug">
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
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
