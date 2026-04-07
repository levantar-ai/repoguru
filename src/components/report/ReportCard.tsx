import type { AnalysisReport } from '../../types';
import { LetterGrade } from './LetterGrade';
import { CategoryScores } from './CategoryScores';
import { TechStack } from './TechStack';
import { InsightsList } from './InsightsList';
import { LlmInsightsPanel } from './LlmInsightsPanel';
import { EnhancedExport } from './EnhancedExport';
import { ContributorScore } from './ContributorScore';
import { FixItLinks } from './FixItLinks';
import { BadgeGenerator } from './BadgeGenerator';
import { RadarChart } from '../common/RadarChart';
import { TrendChart } from '../common/TrendChart';
import { MermaidDiagram } from '../common/MermaidDiagram';
import { formatDate, formatNumber } from '../../utils/formatters';
import { getRepoHistory } from '../../services/persistence/history';
import { trackEvent } from '../../utils/analytics';

interface Props {
  report: AnalysisReport;
  onNewAnalysis: () => void;
}

export function ReportCard({ report, onNewAnalysis }: Props) {
  // Build radar chart data from categories
  const radarData = report.categories.map((c) => ({
    label: c.label,
    value: c.score,
    max: 100,
  }));

  // Get history entries for trend chart
  const historyEntries = getRepoHistory(report.repo.owner, report.repo.repo);
  const trendData = historyEntries.map((e) => ({
    date: e.analyzedAt,
    score: e.overallScore,
  }));

  const branch = report.repo.branch || report.repoInfo.defaultBranch;

  return (
    <article
      className="w-full px-8 lg:px-12 xl:px-16 py-10"
      aria-label={`Report card for ${report.repo.owner}/${report.repo.repo}`}
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-text">
            {report.repo.owner}/<span className="text-neon">{report.repo.repo}</span>
          </h1>
          {report.repoInfo.description && (
            <p className="text-lg text-text-secondary mt-2 max-w-2xl">
              {report.repoInfo.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-text-muted">
            <span>{formatNumber(report.repoInfo.stars)} stars</span>
            <span className="text-border" aria-hidden="true">
              |
            </span>
            <span>{formatNumber(report.repoInfo.forks)} forks</span>
            <span className="text-border" aria-hidden="true">
              |
            </span>
            <span>{formatNumber(report.repoInfo.openIssues)} issues</span>
            <span className="text-border" aria-hidden="true">
              |
            </span>
            <span>Analyzed {formatDate(report.analyzedAt)}</span>
          </div>
        </div>
        <button
          onClick={() => {
            trackEvent('new_analysis', {
              tool: 'report-card',
              repo: `${report.repo.owner}/${report.repo.repo}`,
            });
            onNewAnalysis();
          }}
          className="no-print shrink-0 px-5 py-2.5 text-sm font-medium rounded-lg border border-border bg-surface-alt hover:bg-surface-hover hover:border-neon/30 transition-all duration-200"
        >
          New Analysis
        </button>
      </div>

      {/* Grade + Radar + Categories */}
      <section aria-labelledby="scores-heading" className="mb-10">
        <h2 id="scores-heading" className="sr-only">
          Overall Score and Category Breakdown
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
          <div className="flex flex-col items-center gap-6 lg:pt-2">
            <LetterGrade grade={report.grade} score={report.overallScore} />
            {/* Radar Chart below grade */}
            <div className="hidden lg:block">
              <RadarChart data={radarData} size={220} />
            </div>
          </div>
          <div className="min-w-0">
            <CategoryScores categories={report.categories} />
          </div>
        </div>
      </section>

      {/* Mobile Radar */}
      <div className="lg:hidden flex justify-center mb-10">
        <RadarChart data={radarData} size={280} />
      </div>

      {/* Trend Chart (only if we have history) */}
      {trendData.length > 1 && (
        <section
          className="mb-10 p-6 rounded-xl bg-surface-alt border border-border"
          aria-labelledby="trend-heading"
        >
          <h2
            id="trend-heading"
            className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4"
          >
            Score History
          </h2>
          <TrendChart entries={trendData} height={200} />
        </section>
      )}

      {/* Export & Badge Row */}
      <section
        className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 mb-10"
        aria-label="Export and badge options"
      >
        <EnhancedExport report={report} />
        <BadgeGenerator
          owner={report.repo.owner}
          repo={report.repo.repo}
          grade={report.grade}
          score={report.overallScore}
        />
      </section>

      {/* Tech Stack */}
      {report.techStack.length > 0 && (
        <section
          className="mb-10 p-6 rounded-xl bg-surface-alt border border-border"
          aria-labelledby="techstack-heading"
        >
          <h2 id="techstack-heading" className="sr-only">
            Tech Stack
          </h2>
          <TechStack items={report.techStack} />
        </section>
      )}

      {/* Insights Grid */}
      <section
        className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-10"
        aria-label="Analysis insights"
      >
        <InsightsList title="Strengths" items={report.strengths} icon="check" color="green" />
        <InsightsList title="Risks" items={report.risks} icon="warning" color="yellow" />
        <InsightsList title="Next Steps" items={report.nextSteps} icon="arrow" color="blue" />
      </section>

      {/* Contributor Friendliness */}
      {report.contributorScore && (
        <section className="mb-10" aria-label="Contributor friendliness">
          <ContributorScore data={report.contributorScore} />
        </section>
      )}

      {/* Quick Fix Links */}
      <section className="mb-10" aria-label="Quick fix actions">
        <FixItLinks
          report={report}
          owner={report.repo.owner}
          repo={report.repo.repo}
          branch={branch}
        />
      </section>

      {/* LLM Insights */}
      {report.llmInsights && (
        <section className="mb-10" aria-label="AI-generated insights">
          <LlmInsightsPanel insights={report.llmInsights} />
        </section>
      )}

      {/* Repo Structure Diagram */}
      <section className="mb-10" aria-labelledby="structure-heading">
        <h2
          id="structure-heading"
          className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4"
        >
          {'Repository Structure'}
          <span className="text-text-muted font-normal ml-2 normal-case tracking-normal">
            {report.treeEntryCount} entries
          </span>
        </h2>
        <div className="rounded-xl border border-border bg-surface-alt overflow-hidden">
          <MermaidDiagram chart={report.repoStructure} />
        </div>
      </section>

      {/* Footer metadata */}
      <footer className="text-sm text-text-muted border-t border-border pt-5 flex flex-wrap gap-x-4 gap-y-1">
        <span>
          {report.fileCount} files analyzed of {report.treeEntryCount} tree entries
        </span>
        {report.repoInfo.archived && (
          <span className="text-grade-c font-semibold" role="alert">
            This repository is archived.
          </span>
        )}
      </footer>
    </article>
  );
}
