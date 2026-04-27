// Shared view layer for both the in-browser app and the Electron desktop
// app. The in-browser repoguru app is the authoritative reference for
// chart styling — every chart here renders into the same EChartsWrapper
// (registered `repoguru` theme) with gradient bars and rounded corners.
//
// Hosts wrap charts in their own card chrome (the browser uses
// <ChartSection>; the desktop uses its own panel) — these components
// render bare so they fit either pattern.

export { EChartsWrapper } from './charts/EChartsWrapper.js';
export type { EChartsWrapperProps } from './charts/EChartsWrapper.js';
export { CHART_COLORS, echartsTheme } from './charts/echartsTheme.js';
export { D3Container } from './charts/D3Container.js';
export type { D3ContainerProps } from './charts/D3Container.js';
export { RadarChart } from './charts/RadarChart.js';
export type { RadarChartProps } from './charts/RadarChart.js';

export { CommitsByWeekdayChart } from './charts/CommitsByWeekdayChart.js';
export type { CommitsByWeekdayChartProps } from './charts/CommitsByWeekdayChart.js';

export { CommitsByMonthChart } from './charts/CommitsByMonthChart.js';
export type { CommitsByMonthChartProps } from './charts/CommitsByMonthChart.js';

export { CommitsByHourChart } from './charts/CommitsByHourChart.js';
export type { CommitsByHourChartProps } from './charts/CommitsByHourChart.js';

export { CommitsByYearChart } from './charts/CommitsByYearChart.js';
export type { CommitsByYearChartProps } from './charts/CommitsByYearChart.js';

export { LanguageBreakdownChart } from './charts/LanguageBreakdownChart.js';
export type { LanguageBreakdownChartProps } from './charts/LanguageBreakdownChart.js';

export { BusFactorChart } from './charts/BusFactorChart.js';
export type { BusFactorChartProps } from './charts/BusFactorChart.js';

export { HealthRadarChart } from './charts/HealthRadarChart.js';
export type { HealthRadarChartProps } from './charts/HealthRadarChart.js';
