import type { ReactNode } from 'react';
import type { GitStatsAnalysis } from '../charts/legacyTypes.js';

import { SectionLayout, type SectionDef } from '../chrome/SectionLayout.js';
import {
  OverviewIcon,
  ActivityIcon,
  HealthIcon,
  CodeIcon,
  ContributorsIcon,
  FilesIcon,
  HotspotsIcon,
  PatternsIcon,
  DistributionIcon,
} from '../chrome/SectionIcons.js';

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
 * The post-analysis dashboard. Both apps render this. The repo header is
 * always visible; the body's ~30 charts are grouped into 9 sections that
 * the user switches between via the section nav rail rather than scrolling
 * through the whole page.
 */
export function GitStatsView({ analysis, actions }: GitStatsViewProps) {
  const sections: SectionDef[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <OverviewIcon />,
      content: (
        <div className="space-y-6">
          <ExecutiveSummary
            radarMetrics={analysis.radarMetrics}
            totalCommits={analysis.totalCommits}
            contributors={analysis.contributors.length}
            busFactor={analysis.busFactor.busFactor}
            repoAgeDays={analysis.repoAgeDays}
          />
          <StatsOverviewCards analysis={analysis} />
        </div>
      ),
    },
    {
      id: 'activity',
      label: 'Activity',
      icon: <ActivityIcon />,
      content: (
        <div className="space-y-6">
          {analysis.commitActivity && analysis.commitActivity.length > 0 && (
            <ChartSection title="Commit Activity (Last 52 Weeks)">
              <CommitHeatmap commitActivity={analysis.commitActivity} />
            </ChartSection>
          )}
          {analysis.repoGrowth.length > 0 && (
            <ChartSection title="Repository Growth">
              <RepoGrowthTimeline repoGrowth={analysis.repoGrowth} />
            </ChartSection>
          )}
          {analysis.topActivePeriods.length > 0 && (
            <ChartSection title="Most Active Periods">
              <TopActivePeriods topActivePeriods={analysis.topActivePeriods} />
            </ChartSection>
          )}
          {analysis.tagHistory.length > 0 && (
            <ChartSection title="Tag / Release History">
              <TagHistory tagHistory={analysis.tagHistory} />
            </ChartSection>
          )}
        </div>
      ),
    },
    {
      id: 'health',
      label: 'Health',
      icon: <HealthIcon />,
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {analysis.radarMetrics.length > 0 && (
            <ChartSection title="Repository Health">
              <HealthRadarChart metrics={analysis.radarMetrics} />
            </ChartSection>
          )}
          <ChartSection title="Bus Factor (Lorenz Curve)">
            <BusFactorChart busFactor={analysis.busFactor} />
          </ChartSection>
        </div>
      ),
    },
    {
      id: 'code',
      label: 'Code',
      icon: <CodeIcon />,
      content: (
        <div className="space-y-6">
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
          {analysis.locOverTime.length > 0 && (
            <ChartSection title="Lines of Code Over Time">
              <LOCOverTime locOverTime={analysis.locOverTime} />
            </ChartSection>
          )}
          {analysis.linesByExtTime && (
            <ChartSection title="Lines Changed by Language Over Time">
              <LinesByExtTime linesByExtTime={analysis.linesByExtTime} />
            </ChartSection>
          )}
          {analysis.linesStatsSummary.length > 0 && (
            <ChartSection title="Lines Changed Statistics">
              <LinesStatsTable linesStatsSummary={analysis.linesStatsSummary} />
            </ChartSection>
          )}
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
        </div>
      ),
    },
    {
      id: 'contributors',
      label: 'Contributors',
      icon: <ContributorsIcon />,
      content: (
        <div className="space-y-6">
          {analysis.contributors.length > 0 && (
            <ChartSection title="Contributors">
              <ContributorBreakdown contributors={analysis.contributors} />
            </ChartSection>
          )}
          {analysis.authorTimelines.length > 0 && (
            <ChartSection title="Author Activity Over Time">
              <AuthorTimelines authorTimelines={analysis.authorTimelines} />
            </ChartSection>
          )}
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
          {analysis.codeOwnership.length > 0 && (
            <ChartSection title="Code Ownership">
              <CodeOwnership codeOwnership={analysis.codeOwnership} />
            </ChartSection>
          )}
          {analysis.contributorNodes.length > 0 && (
            <ChartSection title="Contributor Network">
              <ContributorNetwork
                nodes={analysis.contributorNodes}
                edges={analysis.contributorEdges}
              />
            </ChartSection>
          )}
        </div>
      ),
    },
    {
      id: 'files',
      label: 'Files',
      icon: <FilesIcon />,
      content: (
        <div className="space-y-6">
          <ChartSection title="File Churn (Most Changed Files)">
            <FileChurnTable fileChurn={analysis.fileChurn} />
          </ChartSection>
          {analysis.fileCoupling.length > 0 && (
            <ChartSection title="File Coupling (Co-changed Files)">
              <FileCoupling fileCoupling={analysis.fileCoupling} />
            </ChartSection>
          )}
          {analysis.sequentialCoupling.length > 0 && (
            <ChartSection title="Change Cascades (Sequential Coupling)">
              <SequentialCouplingTable sequentialCoupling={analysis.sequentialCoupling} />
            </ChartSection>
          )}
        </div>
      ),
    },
    {
      id: 'hotspots',
      label: 'Hotspots',
      icon: <HotspotsIcon />,
      content:
        analysis.hotspots.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartSection title="Hotspot Map">
              <HotspotBubble hotspots={analysis.hotspots} />
            </ChartSection>
            <ChartSection title="Hotspot Treemap">
              <HotspotTreemap hotspots={analysis.hotspots} />
            </ChartSection>
          </div>
        ) : (
          <EmptySection label="No hotspots detected for this repository." />
        ),
    },
    {
      id: 'patterns',
      label: 'Patterns',
      icon: <PatternsIcon />,
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartSection title="Commit Patterns">
              <CommitPatterns commitMessages={analysis.commitMessages} />
            </ChartSection>
            <ChartSection title="Commit Message Word Cloud">
              <CommitMessageCloud wordFrequency={analysis.commitMessages.wordFrequency} />
            </ChartSection>
          </div>
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
        </div>
      ),
    },
    {
      id: 'distribution',
      label: 'Distribution',
      icon: <DistributionIcon />,
      content: (
        <div className="space-y-6">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {analysis.commitsByMonth.some((c) => c > 0) && (
              <ChartSection title="Commits by Month">
                <CommitsByMonthChart commitsByMonth={analysis.commitsByMonth} />
              </ChartSection>
            )}
            {analysis.commitsByYear.length > 0 && (
              <ChartSection title="Commits by Year">
                <CommitsByYearChart commitsByYear={analysis.commitsByYear} />
              </ChartSection>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {analysis.commitsByExtension.length > 0 && (
              <ChartSection title="Commits by File Extension">
                <CommitsByExtension commitsByExtension={analysis.commitsByExtension} />
              </ChartSection>
            )}
            {analysis.commitsByDomain.length > 0 && (
              <ChartSection title="Commits by Email Domain">
                <CommitsByDomain commitsByDomain={analysis.commitsByDomain} />
              </ChartSection>
            )}
          </div>
          {analysis.timezoneData.length > 0 && (
            <ChartSection title="Contributor Timezones">
              <TimezoneChart timezoneData={analysis.timezoneData} />
            </ChartSection>
          )}
        </div>
      ),
    },
  ];

  return (
    <SectionLayout
      sections={sections}
      header={
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-text">
            <span className="text-neon">
              {analysis.owner}/{analysis.repo}
            </span>
          </h2>
          {actions}
        </div>
      }
    />
  );
}

function EmptySection({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-alt p-10 text-center text-text-muted text-sm">
      {label}
    </div>
  );
}
