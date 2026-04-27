import type { ReactNode } from 'react';
import type { GitStatsAnalysis } from '../charts/legacyTypes.js';

import { ExecutiveSummary } from '../charts/ExecutiveSummary.js';
import { StatsOverviewCards } from '../charts/StatsOverviewCards.js';
import { CommitHeatmap } from '../charts/CommitHeatmap.js';
import { HealthRadarChart } from '../charts/HealthRadarChart.js';
import { CodeFrequencyChart } from '../charts/CodeFrequencyChart.js';
import { LanguageBreakdownChart } from '../charts/LanguageBreakdownChart.js';
import { LOCOverTime } from '../charts/LOCOverTime.js';
import { CumulativeFiles } from '../charts/CumulativeFiles.js';
import { FileOperationsChart } from '../charts/FileOperationsChart.js';
import { LinesByExtTime } from '../charts/LinesByExtTime.js';
import { ContributorBreakdown } from '../charts/ContributorBreakdown.js';
import { AuthorTimelines } from '../charts/AuthorTimelines.js';
import { AuthorOfYear } from '../charts/AuthorOfYear.js';
import { AuthorOfMonth } from '../charts/AuthorOfMonth.js';
import { PunchCard } from '../charts/PunchCard.js';
import { CommitSizeHistogram } from '../charts/CommitSizeHistogram.js';
import { RepoGrowthTimeline } from '../charts/RepoGrowthTimeline.js';
import { BusFactorChart } from '../charts/BusFactorChart.js';
import { CommitPatterns } from '../charts/CommitPatterns.js';
import { CommitMessageCloud } from '../charts/CommitMessageCloud.js';
import { FileChurnTable } from '../charts/FileChurnTable.js';
import { CommitsByWeekdayChart } from '../charts/CommitsByWeekdayChart.js';
import { CommitsByHourChart } from '../charts/CommitsByHourChart.js';
import { CommitsByMonthChart } from '../charts/CommitsByMonthChart.js';
import { CommitsByDomain } from '../charts/CommitsByDomain.js';
import { CommitsByYearChart } from '../charts/CommitsByYearChart.js';
import { CommitsByExtension } from '../charts/CommitsByExtension.js';
import { TimezoneChart } from '../charts/TimezoneChart.js';
import { HotspotBubble } from '../charts/HotspotBubble.js';
import { HotspotTreemap } from '../charts/HotspotTreemap.js';
import { CodeOwnership } from '../charts/CodeOwnership.js';
import { FileCoupling } from '../charts/FileCoupling.js';
import { SequentialCouplingTable } from '../charts/SequentialCouplingTable.js';
import { ContributorNetwork } from '../charts/ContributorNetwork.js';
import { TagHistory } from '../charts/TagHistory.js';
import { LinesStatsTable } from '../charts/LinesStatsTable.js';
import { TopActivePeriods } from '../charts/TopActivePeriods.js';

function ChartSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface-alt p-6">
      <h3 className="text-base font-semibold text-text mb-4">{title}</h3>
      {children}
    </section>
  );
}

export interface GitStatsViewProps {
  /** The full analysis result. Both adapters produce this shape. */
  analysis: GitStatsAnalysis;
  /** Optional renderer for an action bar above the dashboard (e.g. "New analysis"). */
  actions?: ReactNode;
}

/**
 * The post-analysis dashboard — every chart laid out exactly as the
 * in-browser `GitStatsPage` arranges them. Both apps render this.
 */
export function GitStatsView({ analysis, actions }: GitStatsViewProps) {
  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-text">
          <span className="text-neon">
            {analysis.owner}/{analysis.repo}
          </span>
        </h2>
        {actions}
      </div>

      {/* Executive Summary */}
      <ExecutiveSummary
        radarMetrics={analysis.radarMetrics}
        totalCommits={analysis.totalCommits}
        contributors={analysis.contributors.length}
        busFactor={analysis.busFactor.busFactor}
        repoAgeDays={analysis.repoAgeDays}
      />

      <StatsOverviewCards analysis={analysis} />

      {/* Commit Heatmap */}
      {analysis.commitActivity && analysis.commitActivity.length > 0 && (
        <ChartSection title="Commit Activity (Last 52 Weeks)">
          <CommitHeatmap commitActivity={analysis.commitActivity} />
        </ChartSection>
      )}

      {/* Radar Health */}
      {analysis.radarMetrics.length > 0 && (
        <ChartSection title="Repository Health">
          <HealthRadarChart metrics={analysis.radarMetrics} />
        </ChartSection>
      )}

      {/* Code Frequency + Language */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {analysis.codeFrequency && analysis.codeFrequency.length > 0 && (
          <div className="lg:col-span-2">
            <ChartSection title="Code Frequency">
              <CodeFrequencyChart codeFrequency={analysis.codeFrequency} />
            </ChartSection>
          </div>
        )}
        {analysis.languages.length > 0 && (
          <ChartSection title="Languages">
            <LanguageBreakdownChart languages={analysis.languages} />
          </ChartSection>
        )}
      </div>

      {/* LOC Over Time */}
      {analysis.locOverTime.length > 0 && (
        <ChartSection title="Lines of Code Over Time">
          <LOCOverTime locOverTime={analysis.locOverTime} />
        </ChartSection>
      )}

      {/* Cumulative Files + File Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {analysis.cumulativeFiles.length > 0 && (
          <ChartSection title="Cumulative Files Over Time">
            <CumulativeFiles cumulativeFiles={analysis.cumulativeFiles} />
          </ChartSection>
        )}
        {analysis.fileOperations.length > 0 && (
          <ChartSection title="File Operations">
            <FileOperationsChart fileOperations={analysis.fileOperations} />
          </ChartSection>
        )}
      </div>

      {/* Lines by Extension Over Time */}
      {analysis.linesByExtTime && (
        <ChartSection title="Lines Changed by Language Over Time">
          <LinesByExtTime linesByExtTime={analysis.linesByExtTime} />
        </ChartSection>
      )}

      {/* Contributor Breakdown */}
      {analysis.contributors.length > 0 && (
        <ChartSection title="Contributors">
          <ContributorBreakdown contributors={analysis.contributors} />
        </ChartSection>
      )}

      {/* Author Timelines */}
      {analysis.authorTimelines.length > 0 && (
        <ChartSection title="Author Activity Over Time">
          <AuthorTimelines authorTimelines={analysis.authorTimelines} />
        </ChartSection>
      )}

      {/* Author of Year + Month */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {analysis.authorOfYear.length > 0 && (
          <ChartSection title="Author of the Year">
            <AuthorOfYear authorOfYear={analysis.authorOfYear} />
          </ChartSection>
        )}
        {analysis.authorOfMonth.length > 0 && (
          <ChartSection title="Author of the Month">
            <AuthorOfMonth authorOfMonth={analysis.authorOfMonth} />
          </ChartSection>
        )}
      </div>

      {/* Punch Card + Commit Size */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {analysis.punchCard.length > 0 && (
          <ChartSection title="Commit Punch Card">
            <PunchCard punchCard={analysis.punchCard} />
          </ChartSection>
        )}
        {analysis.commitSizeDistribution.buckets.some((b) => b.count > 0) && (
          <ChartSection title="Commit Size Distribution">
            <CommitSizeHistogram distribution={analysis.commitSizeDistribution} />
          </ChartSection>
        )}
      </div>

      {/* Repo Growth + Bus Factor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {analysis.repoGrowth.length > 0 && (
          <div className="lg:col-span-2">
            <ChartSection title="Repository Growth">
              <RepoGrowthTimeline repoGrowth={analysis.repoGrowth} />
            </ChartSection>
          </div>
        )}
        <ChartSection title="Bus Factor (Lorenz Curve)">
          <BusFactorChart busFactor={analysis.busFactor} />
        </ChartSection>
      </div>

      {/* Commit Patterns + Word Cloud */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSection title="Commit Patterns">
          <CommitPatterns commitMessages={analysis.commitMessages} />
        </ChartSection>
        <ChartSection title="Commit Message Word Cloud">
          <CommitMessageCloud wordFrequency={analysis.commitMessages.wordFrequency} />
        </ChartSection>
      </div>

      {/* File Churn */}
      <ChartSection title="File Churn (Most Changed Files)">
        <FileChurnTable fileChurn={analysis.fileChurn} />
      </ChartSection>

      {/* Commits by Weekday + Hour */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {analysis.commitsByWeekday.some((c) => c > 0) && (
          <ChartSection title="Commits by Day of Week">
            <CommitsByWeekdayChart commitsByWeekday={analysis.commitsByWeekday} />
          </ChartSection>
        )}
        {analysis.commitsByHour.some((c) => c > 0) && (
          <ChartSection title="Commits by Hour of Day">
            <CommitsByHourChart commitsByHour={analysis.commitsByHour} />
          </ChartSection>
        )}
      </div>

      {/* Commits by Month + Domain */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {analysis.commitsByMonth.some((c) => c > 0) && (
          <ChartSection title="Commits by Month">
            <CommitsByMonthChart commitsByMonth={analysis.commitsByMonth} />
          </ChartSection>
        )}
        {analysis.commitsByDomain.length > 0 && (
          <ChartSection title="Commits by Email Domain">
            <CommitsByDomain commitsByDomain={analysis.commitsByDomain} />
          </ChartSection>
        )}
      </div>

      {/* Commits by Year + Extension */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {analysis.commitsByYear.length > 0 && (
          <ChartSection title="Commits by Year">
            <CommitsByYearChart commitsByYear={analysis.commitsByYear} />
          </ChartSection>
        )}
        {analysis.commitsByExtension.length > 0 && (
          <ChartSection title="Commits by File Extension">
            <CommitsByExtension commitsByExtension={analysis.commitsByExtension} />
          </ChartSection>
        )}
      </div>

      {/* Timezone */}
      {analysis.timezoneData.length > 0 && (
        <ChartSection title="Contributor Timezones">
          <TimezoneChart timezoneData={analysis.timezoneData} />
        </ChartSection>
      )}

      {/* Hotspots */}
      {analysis.hotspots.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartSection title="Hotspot Map">
            <HotspotBubble hotspots={analysis.hotspots} />
          </ChartSection>
          <ChartSection title="Hotspot Treemap">
            <HotspotTreemap hotspots={analysis.hotspots} />
          </ChartSection>
        </div>
      )}

      {/* Code Ownership */}
      {analysis.codeOwnership.length > 0 && (
        <ChartSection title="Code Ownership">
          <CodeOwnership codeOwnership={analysis.codeOwnership} />
        </ChartSection>
      )}

      {/* File Coupling */}
      {analysis.fileCoupling.length > 0 && (
        <ChartSection title="File Coupling (Co-changed Files)">
          <FileCoupling fileCoupling={analysis.fileCoupling} />
        </ChartSection>
      )}

      {/* Sequential Coupling */}
      {analysis.sequentialCoupling.length > 0 && (
        <ChartSection title="Change Cascades (Sequential Coupling)">
          <SequentialCouplingTable sequentialCoupling={analysis.sequentialCoupling} />
        </ChartSection>
      )}

      {/* Contributor Network */}
      {analysis.contributorNodes.length > 0 && (
        <ChartSection title="Contributor Network">
          <ContributorNetwork
            nodes={analysis.contributorNodes}
            edges={analysis.contributorEdges}
          />
        </ChartSection>
      )}

      {/* Tag History */}
      {analysis.tagHistory.length > 0 && (
        <ChartSection title="Tag / Release History">
          <TagHistory tagHistory={analysis.tagHistory} />
        </ChartSection>
      )}

      {/* Lines Stats + Top Active Periods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {analysis.linesStatsSummary.length > 0 && (
          <ChartSection title="Lines Changed Statistics">
            <LinesStatsTable linesStatsSummary={analysis.linesStatsSummary} />
          </ChartSection>
        )}
        {analysis.topActivePeriods.length > 0 && (
          <ChartSection title="Most Active Periods">
            <TopActivePeriods topActivePeriods={analysis.topActivePeriods} />
          </ChartSection>
        )}
      </div>
    </div>
  );
}
