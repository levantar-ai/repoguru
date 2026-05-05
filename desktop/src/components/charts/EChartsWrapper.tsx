import { useRef, useEffect } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, RadarChart, ScatterChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  RadarComponent,
  DataZoomComponent,
  ToolboxComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart, LineChart, PieChart, RadarChart, ScatterChart,
  TitleComponent, TooltipComponent, LegendComponent, GridComponent,
  RadarComponent, DataZoomComponent, ToolboxComponent,
  CanvasRenderer,
]);

// Register custom theme
echarts.registerTheme('repoguru', {
  backgroundColor: 'transparent',
  textStyle: { color: '#94a3b8' },
  title: { textStyle: { color: '#f1f5f9' }, subtextStyle: { color: '#94a3b8' } },
  legend: { textStyle: { color: '#94a3b8' } },
  tooltip: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    textStyle: { color: '#f1f5f9' },
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#334155' } },
    axisTick: { lineStyle: { color: '#334155' } },
    axisLabel: { color: '#94a3b8' },
    splitLine: { lineStyle: { color: '#1e293b' } },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: '#334155' } },
    axisTick: { lineStyle: { color: '#334155' } },
    axisLabel: { color: '#94a3b8' },
    splitLine: { lineStyle: { color: '#1e293b' } },
  },
  color: ['#38bdf8', '#34d399', '#a3e635', '#fbbf24', '#fb923c', '#f87171', '#a78bfa', '#f472b6'],
});

interface Props {
  option: echarts.EChartsCoreOption;
  height?: string;
  className?: string;
  onReady?: (chart: echarts.ECharts) => void;
}

export function EChartsWrapper({ option, height = '300px', className = '', onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current, 'repoguru');
    chartRef.current = chart;
    onReady?.(chart);

    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  return <div ref={containerRef} style={{ height }} className={className} />;
}
