// Shared view layer for both the in-browser app and the Electron desktop
// app. Components here depend ONLY on @repoguru/core types — no fetching,
// no git, no gRPC. Hosts inject a RepoAnalyzer and feed the resulting data in.

export { ChartCard } from './charts/ChartCard.js';
export { baseOption, CHART_COLORS } from './charts/echartsTheme.js';

export { CommitsByWeekdayChart } from './charts/CommitsByWeekdayChart.js';
export type { CommitsByWeekdayChartProps } from './charts/CommitsByWeekdayChart.js';

export { CommitsByMonthChart } from './charts/CommitsByMonthChart.js';
export type { CommitsByMonthChartProps } from './charts/CommitsByMonthChart.js';

export { CommitsByHourChart } from './charts/CommitsByHourChart.js';
export type { CommitsByHourChartProps } from './charts/CommitsByHourChart.js';

export { CommitsByYearChart } from './charts/CommitsByYearChart.js';
export type { CommitsByYearChartProps } from './charts/CommitsByYearChart.js';

export { BusFactorChart } from './charts/BusFactorChart.js';
export type { BusFactorChartProps } from './charts/BusFactorChart.js';

export { HealthRadarChart } from './charts/HealthRadarChart.js';
export type { HealthRadarChartProps } from './charts/HealthRadarChart.js';
