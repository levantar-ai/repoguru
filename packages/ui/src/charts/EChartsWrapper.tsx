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
  /** Required-in-spirit. The accessible name read out by screen
   *  readers — describe what the chart visualises ("Commits per month
   *  over the last 5 years"). Falls back to a generic label if
   *  omitted, but every consumer should pass a real description for
   *  WCAG 1.1.1 / 1.3.1 compliance. */
  ariaLabel?: string;
  /** Optional sr-only table rows — `[header, value]` pairs that get
   *  rendered as a hidden `<table>` so AT users can read the data
   *  even though the canvas is opaque. */
  dataTable?: { caption?: string; rows: Array<{ label: string; value: string | number }> };
}

const FALLBACK_ARIA_LABEL = 'Data visualisation';

/**
 * Authoritative ECharts host. Every chart in @repoguru/ui renders into
 * this — the modular import surface keeps bundle size small and the
 * registered `repoguru` theme makes every chart look the same.
 *
 * Accessibility: ECharts renders to <canvas> which is opaque to AT,
 * so we always wrap the canvas in an `role="img"` element with a
 * non-empty `aria-label`, and we force-enable echarts' built-in
 * `aria` config (which uses series + axis names to generate spoken
 * descriptions) plus `decal` patterns (redundant non-colour cues for
 * Deutan/Protan colour-blindness). Consumers can additionally pass a
 * `dataTable` for an sr-only structured summary.
 */
export function EChartsWrapper({
  option,
  height = '400px',
  className = '',
  onReady,
  ariaLabel,
  dataTable,
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
      // Inject ECharts a11y options non-destructively. If the consumer
      // already supplies aria settings, theirs win.
      const merged = {
        aria: { show: true, decal: { show: true }, ...((option.aria as object) ?? {}) },
        ...option,
      };
      chartRef.current.setOption(merged, { notMerge: true });
    }
  }, [option, ready]);

  const a11yLabel = ariaLabel || FALLBACK_ARIA_LABEL;

  return (
    <div
      className={`relative ${className}`}
      role="img"
      aria-label={a11yLabel}
    >
      {!ready && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-surface-alt rounded-xl"
          style={{ height }}
        >
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <svg className="h-4 w-4 animate-spin text-neon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
      {dataTable && (
        <table className="sr-only">
          {dataTable.caption && <caption>{dataTable.caption}</caption>}
          <thead>
            <tr><th scope="col">Label</th><th scope="col">Value</th></tr>
          </thead>
          <tbody>
            {dataTable.rows.map((r, i) => (
              <tr key={i}><th scope="row">{r.label}</th><td>{r.value}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
