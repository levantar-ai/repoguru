// Shared view layer for both the in-browser app and the Electron desktop
// app. The in-browser repoguru is the authoritative reference: every
// chart here was lifted from `repoguru/src/components/git-stats/`. Both
// apps render the same React tree against the same `GitStatsAnalysis`
// (the legacy view contract — see `legacyTypes.ts`).

// Service injection — hosts implement RepoGuruServices and wrap their
// app in <RepoGuruProvider services={...}>. Shared pages then call
// useRepoGuru() to get the host-injected processing engine. The same
// React component runs in every host; only the engine differs.
export { RepoGuruProvider, useRepoGuru } from './services/Provider.js';
export type {
  RepoGuruServices,
  RepoRef,
  CompareService,
  CompareRunOptions,
  CompareResult,
  ScoreService,
  ScoreRunOptions,
  ScoreResult,
  TechDetectService,
  PolicyService,
  PolicyPreset,
  PolicyEvaluateRequest,
  OrgScanService,
  OrgScanRequest,
  OrgScanProgress,
  OrgScanResult,
  RepoPickerProps,
  RepoSuggestion,
  RepoBrowseService,
} from './services/types.js';

// Lifted pages — both hosts mount the SAME component. VS Code-style
// shared codebase: the page never imports anything host-specific.
export { ComparePage } from './pages/ComparePage.js';
export { ReportCardPage } from './pages/ReportCardPage.js';
export type { ReportCardPageProps } from './pages/ReportCardPage.js';
export { TechDetectPage } from './pages/TechDetectPage.js';

// Page chrome — used by both apps so headers/inputs/buttons/status
// panels render identically across hosts. The in-browser app is the
// visual reference for these (SPEC §1).
export { PageContainer } from './chrome/PageContainer.js';
export type { PageContainerProps } from './chrome/PageContainer.js';
export { PageHero } from './chrome/PageHero.js';
export type { PageHeroProps } from './chrome/PageHero.js';
export { RepoInputField } from './chrome/RepoInputField.js';
export type { RepoInputFieldProps } from './chrome/RepoInputField.js';
export { RepoPicker } from './chrome/RepoPicker.js';
export { PrimaryButton, SecondaryButton } from './chrome/Buttons.js';
export { LoadingPanel, ErrorPanel } from './chrome/StatusPanels.js';
export type { LoadingPanelProps, ErrorPanelProps } from './chrome/StatusPanels.js';

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

// Page-level views
export { GitStatsView } from './views/GitStatsView.js';
export type { GitStatsViewProps } from './views/GitStatsView.js';
export { ReportCardView } from './views/ReportCardView.js';
export type { ReportCardViewProps } from './views/ReportCardView.js';
export { TechDetectView } from './views/TechDetectView.js';
export type { TechDetectViewProps } from './views/TechDetectView.js';
export { CompareView, computeDeltasFromReports } from './views/CompareView.js';
export type { CompareViewProps, CompareDelta } from './views/CompareView.js';
export { PolicyView } from './views/PolicyView.js';
export type { PolicyViewProps } from './views/PolicyView.js';
export type {
  PolicySeverity,
  PolicyEvalRule,
  PolicyEvalRuleResult,
  PolicyEvalResult,
} from './views/policyTypes.js';
export { OrgScanView } from './views/OrgScanView.js';
export type { OrgScanViewProps } from './views/OrgScanView.js';
export type {
  OrgScanItem,
  OrgScanCategoryScore,
  OrgScanSummary,
} from './views/orgScanTypes.js';
export {
  scoreToGrade,
  gradeAdjective,
  GRADE_COLORS,
} from './views/reportCardTypes.js';
export type {
  Grade,
  ReportCardCategory,
  ReportCardData,
  ReportCardRepoInfo,
  ReportCardSignal,
} from './views/reportCardTypes.js';
