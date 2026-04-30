import type { ReactNode } from 'react';
import { RadarChart } from '../charts/RadarChart.js';
import { SectionLayout, type SectionDef } from '../chrome/SectionLayout.js';
import {
  OverviewIcon,
  StrengthsIcon,
  RisksIcon,
  NextStepsIcon,
} from '../chrome/SectionIcons.js';
import {
  type ReportCardData,
  type ReportCardCategory,
  GRADE_COLORS,
  scoreToGrade,
  gradeAdjective,
} from './reportCardTypes.js';

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
 * Header (repo name, stats, action bar) stays visible always; the body
 * is split into Overview / Strengths / Risks / Next Steps and switched
 * via the section nav rather than scrolled.
 */
export function ReportCardView({ report, actions }: ReportCardViewProps) {
  const sections: SectionDef[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <OverviewIcon />,
      content: <OverviewSection report={report} />,
    },
    {
      id: 'strengths',
      label: 'Strengths',
      icon: <StrengthsIcon />,
      content: <InsightsList title="Strengths" items={report.strengths} variant="green" />,
    },
    {
      id: 'risks',
      label: 'Risks',
      icon: <RisksIcon />,
      content: <InsightsList title="Risks" items={report.risks} variant="yellow" />,
    },
    {
      id: 'next-steps',
      label: 'Next Steps',
      icon: <NextStepsIcon />,
      content: <InsightsList title="Next Steps" items={report.nextSteps} variant="blue" />,
    },
  ];

  return (
    <article
      className="w-full"
      aria-label={`Report card for ${report.repo.owner}/${report.repo.repo}`}
    >
      <SectionLayout
        sections={sections}
        header={
          <>
            <ReportCardHeader report={report} actions={actions} />
            {report.repoInfo?.archived && (
              <div className="mt-4 text-sm">
                <span className="text-grade-c font-semibold" role="alert">
                  This repository is archived.
                </span>
              </div>
            )}
          </>
        }
      />
    </article>
  );
}

// ───────────────────────── header ─────────────────────────

function ReportCardHeader({
  report,
  actions,
}: {
  report: ReportCardData;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl lg:text-4xl font-bold text-text">
          {report.repo.owner}/<span className="text-neon">{report.repo.repo}</span>
        </h1>
        {report.repoInfo?.description && (
          <p className="text-lg text-text-secondary mt-2 max-w-2xl">
            {report.repoInfo.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-text-muted">
          {report.repoInfo?.stars !== undefined && (
            <>
              <span>{formatNumber(report.repoInfo.stars)} stars</span>
              <span className="text-border" aria-hidden="true">|</span>
            </>
          )}
          {report.repoInfo?.forks !== undefined && (
            <>
              <span>{formatNumber(report.repoInfo.forks)} forks</span>
              <span className="text-border" aria-hidden="true">|</span>
            </>
          )}
          {report.repoInfo?.openIssues !== undefined && (
            <>
              <span>{formatNumber(report.repoInfo.openIssues)} issues</span>
              <span className="text-border" aria-hidden="true">|</span>
            </>
          )}
          <span>Analyzed {formatDate(report.analyzedAt)}</span>
        </div>
      </div>
      {actions}
    </div>
  );
}

// ───────────────────────── overview section ─────────────────────────

function OverviewSection({ report }: { report: ReportCardData }) {
  const radarData = report.categories.map((c) => ({
    label: c.label,
    value: c.score,
    max: 100,
  }));

  return (
    <section aria-labelledby="scores-heading">
      <h2 id="scores-heading" className="sr-only">
        Overall Score and Category Breakdown
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
        <div className="flex flex-col items-center gap-6 lg:pt-2">
          <LetterGrade grade={report.grade} score={report.overallScore} />
          <div className="hidden lg:block">
            <RadarChart data={radarData} size={220} />
          </div>
          <div className="text-center inline-flex items-center justify-center gap-1.5">
            <GradeStatusBadge grade={report.grade} />
            <span
              className="text-sm font-medium"
              style={{ color: GRADE_COLORS[report.grade] }}
            >
              {gradeAdjective(report.grade)}
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <CategoryScores categories={report.categories} />
        </div>
      </div>
      <div className="lg:hidden flex justify-center mt-10">
        <RadarChart data={radarData} size={280} />
      </div>
    </section>
  );
}

// ───────────────────────── primitives ─────────────────────────

/** Maps a letter grade to a non-colour cue so users with red/amber
 *  colour-blindness (Deutan/Protan) can distinguish F from D, A from B
 *  etc. The shapes are also redundantly meaningful for reduced-vision
 *  users where a 12px hue is hard to read. */
function gradeShape(grade: ReportCardData['grade']): { kind: 'check' | 'warn' | 'cross'; label: string } {
  if (grade === 'A' || grade === 'B') return { kind: 'check', label: 'Healthy' };
  if (grade === 'C') return { kind: 'warn', label: 'Needs attention' };
  return { kind: 'cross', label: 'Critical' };
}

function GradeStatusBadge({ grade, className = '' }: { grade: ReportCardData['grade']; className?: string }) {
  const shape = gradeShape(grade);
  const color = GRADE_COLORS[grade];
  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      style={{ color }}
      aria-label={shape.label}
    >
      {shape.kind === 'check' && (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {shape.kind === 'warn' && (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4M12 17h.01M4.93 19h14.14a2 2 0 001.74-3l-7.07-12a2 2 0 00-3.48 0l-7.07 12a2 2 0 001.74 3z" />
        </svg>
      )}
      {shape.kind === 'cross' && (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
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
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}
        />
      </svg>
      <div className="text-center" aria-hidden="true">
        <div
          className="text-6xl font-black"
          style={{ color, textShadow: `0 0 20px ${color}40` }}
        >
          {grade}
        </div>
        <div className="text-base text-text-secondary font-semibold mt-1">{score}/100</div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 ml-1">
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

function InsightsList({
  title,
  items,
  variant,
}: {
  title: string;
  items: string[];
  variant: 'green' | 'yellow' | 'blue';
}) {
  const colorClass = {
    green: 'text-grade-a border-grade-a/25 bg-grade-a/10',
    yellow: 'text-grade-c border-grade-c/25 bg-grade-c/10',
    blue: 'text-neon border-neon/25 bg-neon/10',
  }[variant];

  if (items.length === 0) {
    return (
      <section className={`rounded-xl border p-5 ${colorClass}`}>
        <h3 className="text-sm font-semibold uppercase tracking-wider mb-3">{title}</h3>
        <p className="text-sm text-text-muted">No items.</p>
      </section>
    );
  }

  return (
    <section className={`rounded-xl border p-5 ${colorClass}`}>
      <h3 className="text-sm font-semibold uppercase tracking-wider mb-3">{title}</h3>
      <ul className="space-y-2 text-sm text-text-secondary">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
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
