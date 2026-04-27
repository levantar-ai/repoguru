// Shared view layer for both the in-browser app and the Electron desktop
// app. The in-browser repoguru is the authoritative reference: every
// chart here was lifted from `repoguru/src/components/git-stats/`. Both
// apps render the same React tree against the same `GitStatsAnalysis`
// (the legacy view contract — see `legacyTypes.ts`).

// Primitives
export { EChartsWrapper } from './charts/EChartsWrapper.js';
export type { EChartsWrapperProps } from './charts/EChartsWrapper.js';
export { CHART_COLORS, echartsTheme } from './charts/echartsTheme.js';
export { D3Container } from './charts/D3Container.js';
export type { D3ContainerProps } from './charts/D3Container.js';
export { RadarChart } from './charts/RadarChart.js';
export type { RadarChartProps } from './charts/RadarChart.js';
export type { GitStatsState, GitStatsStep } from './charts/legacyTypes.js';

// Pattern charts
export { CommitsByWeekdayChart } from './charts/CommitsByWeekdayChart.js';
export { CommitsByMonthChart } from './charts/CommitsByMonthChart.js';
export { CommitsByHourChart } from './charts/CommitsByHourChart.js';
export { CommitsByYearChart } from './charts/CommitsByYearChart.js';
export { LanguageBreakdownChart } from './charts/LanguageBreakdownChart.js';
export { BusFactorChart } from './charts/BusFactorChart.js';
export { HealthRadarChart } from './charts/HealthRadarChart.js';

// Lifted browser charts (named the same as in repoguru/src/components/git-stats/)
export { AuthorOfMonth } from './charts/AuthorOfMonth.js';
export { AuthorOfYear } from './charts/AuthorOfYear.js';
export { AuthorTimelines } from './charts/AuthorTimelines.js';
export { CodeFrequencyChart } from './charts/CodeFrequencyChart.js';
export { CodeOwnership } from './charts/CodeOwnership.js';
export { CommitHeatmap } from './charts/CommitHeatmap.js';
export { CommitMessageCloud } from './charts/CommitMessageCloud.js';
export { CommitPatterns } from './charts/CommitPatterns.js';
export { CommitsByDomain } from './charts/CommitsByDomain.js';
export { CommitsByExtension } from './charts/CommitsByExtension.js';
export { CommitSizeHistogram } from './charts/CommitSizeHistogram.js';
export { ContributorBreakdown } from './charts/ContributorBreakdown.js';
export { ContributorNetwork } from './charts/ContributorNetwork.js';
export { CumulativeFiles } from './charts/CumulativeFiles.js';
export { ExecutiveSummary } from './charts/ExecutiveSummary.js';
export { FileChurnTable } from './charts/FileChurnTable.js';
export { FileCoupling } from './charts/FileCoupling.js';
export { FileOperationsChart } from './charts/FileOperationsChart.js';
export { GitStatsProgress } from './charts/GitStatsProgress.js';
export { HotspotBubble } from './charts/HotspotBubble.js';
export { HotspotTreemap } from './charts/HotspotTreemap.js';
export { LinesByExtTime } from './charts/LinesByExtTime.js';
export { LinesStatsTable } from './charts/LinesStatsTable.js';
export { LOCOverTime } from './charts/LOCOverTime.js';
export { PunchCard } from './charts/PunchCard.js';
export { RepoGrowthTimeline } from './charts/RepoGrowthTimeline.js';
export { SequentialCouplingTable } from './charts/SequentialCouplingTable.js';
export { StatsOverviewCards } from './charts/StatsOverviewCards.js';
export { TagHistory } from './charts/TagHistory.js';
export { TimezoneChart } from './charts/TimezoneChart.js';
export { TopActivePeriods } from './charts/TopActivePeriods.js';

// Page-level view
export { GitStatsView } from './views/GitStatsView.js';
export type { GitStatsViewProps } from './views/GitStatsView.js';
