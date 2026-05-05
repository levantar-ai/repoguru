import { useRef, useEffect, useState } from 'react';
import { Skeleton } from '../chrome/Skeleton.js';

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
        // Content-shaped skeleton instead of a centered spinner.
        // Three pulsing horizontal blocks at decreasing opacity vaguely
        // suggest "data viz coming" without committing to a specific
        // shape (the wrapper hosts bars / lines / radars / heatmaps).
        // Eliminates the brief layout-shift flash when the canvas
        // actually mounts.
        <div
          className="absolute inset-0 flex flex-col justify-end gap-2 p-4 bg-surface-alt/60 rounded-xl"
          style={{ height }}
        >
          <Skeleton className="h-3 w-2/5 opacity-30" />
          <Skeleton className="h-1/3 w-full opacity-25" />
          <Skeleton className="h-1/4 w-3/4 opacity-20" />
          <Skeleton className="h-1/5 w-1/2 opacity-15" />
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
