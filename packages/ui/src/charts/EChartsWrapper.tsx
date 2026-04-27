import { useRef, useEffect, useState } from 'react';

// Tree-shaken ECharts imports.
import * as echarts from 'echarts/core';
import {
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  HeatmapChart,
  TreemapChart,
  RadarChart,
} from 'echarts/charts';
import {
  CalendarComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
  VisualMapComponent,
  TitleComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

import { echartsTheme } from './echartsTheme.js';

type EChartsInstance = ReturnType<typeof echarts.init>;

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  HeatmapChart,
  TreemapChart,
  RadarChart,
  CalendarComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
  VisualMapComponent,
  TitleComponent,
  CanvasRenderer,
]);

echarts.registerTheme('repoguru', echartsTheme);

export interface EChartsWrapperProps {
  option: Record<string, unknown>;
  height?: string;
  className?: string;
  onReady?: (chart: EChartsInstance) => void;
}

/**
 * Authoritative ECharts host. Every chart in @repoguru/ui renders into
 * this — the modular import surface keeps bundle size small and the
 * registered `repoguru` theme makes every chart look the same.
 */
export function EChartsWrapper({
  option,
  height = '400px',
  className = '',
  onReady,
}: EChartsWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsInstance | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = echarts.init(containerRef.current, 'repoguru', { renderer: 'canvas' });
    chartRef.current = chart;
    setReady(true);
    if (onReady) onReady(chart);

    const observer = new ResizeObserver(() => {
      chart.resize();
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (chartRef.current && ready) {
      chartRef.current.setOption(option, { notMerge: true });
    }
  }, [option, ready]);

  return (
    <div className={`relative ${className}`}>
      {!ready && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-surface-alt rounded-xl"
          style={{ height }}
        >
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <svg className="h-4 w-4 animate-spin text-neon" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Loading chart...
          </div>
        </div>
      )}
      <div ref={containerRef} style={{ height, width: '100%' }} />
    </div>
  );
}
