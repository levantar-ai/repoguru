import { useMemo, useState } from 'react';
import type { PatternsSection } from '@repoguru/core';
import { EChartsWrapper } from './EChartsWrapper.js';
import { CHART_COLORS } from './echartsTheme.js';

export interface LanguageBreakdownChartProps {
  /** Canonical language breakdown — `{ language, percentage, fileCount?, totalLines?, bytes? }[]`. */
  data: PatternsSection['languageBreakdown'];
  height?: string;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

/** Pick the best size metric the adapter provides — bytes preferred, then totalLines, else percentage. */
function sizeFor(d: PatternsSection['languageBreakdown'][number]): number {
  if (d.bytes !== undefined && d.bytes > 0) return d.bytes;
  if (d.totalLines !== undefined && d.totalLines > 0) return d.totalLines;
  return d.percentage;
}

export function LanguageBreakdownChart({
  data,
  height = '350px',
}: LanguageBreakdownChartProps) {
  const [view, setView] = useState<'donut' | 'treemap'>('donut');

  const donutOption = useMemo(() => {
    const top = [...data].sort((a, b) => b.percentage - a.percentage).slice(0, 15);
    const series = top.map((lang) => ({
      name: lang.language,
      value: sizeFor(lang),
    }));

    return {
      tooltip: {
        trigger: 'item' as const,
        formatter: (params: { name: string; value: number; percent: number }) => {
          const lang = top.find((l) => l.language === params.name);
          const lines = [`<b>${params.name}</b>`];
          if (lang?.bytes !== undefined) {
            lines.push(`${formatBytes(lang.bytes)} (${params.percent}%)`);
          } else if (lang?.totalLines !== undefined) {
            lines.push(`${lang.totalLines.toLocaleString()} lines (${params.percent}%)`);
          } else {
            lines.push(`${params.percent}%`);
          }
          if (lang?.fileCount !== undefined) lines.push(`${lang.fileCount} files`);
          return lines.join('<br/>');
        },
      },
      series: [
        {
          type: 'pie' as const,
          radius: ['45%', '75%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderColor: '#0f172a',
            borderWidth: 2,
            borderRadius: 6,
          },
          label: {
            color: '#94a3b8',
            fontSize: 11,
            formatter: '{b}\n{d}%',
          },
          labelLine: {
            lineStyle: { color: '#475569' },
          },
          emphasis: {
            label: { fontSize: 13, fontWeight: 'bold' as const },
          },
          data: series,
        },
      ],
    };
  }, [data]);

  const treemapOption = useMemo(() => {
    const series = data.map((lang, i) => ({
      name: lang.language,
      value: sizeFor(lang),
      itemStyle: {
        color: CHART_COLORS[i % CHART_COLORS.length],
      },
    }));

    return {
      tooltip: {
        formatter: (params: { name: string; value: number }) => {
          const lang = data.find((l) => l.language === params.name);
          const lines = [`<b>${params.name}</b>`];
          if (lang?.bytes !== undefined) {
            lines.push(`${formatBytes(lang.bytes)} (${lang.percentage.toFixed(1)}%)`);
          } else if (lang?.totalLines !== undefined) {
            lines.push(`${lang.totalLines.toLocaleString()} lines (${lang.percentage.toFixed(1)}%)`);
          } else {
            lines.push(`${(lang?.percentage ?? 0).toFixed(1)}%`);
          }
          return lines.join('<br/>');
        },
      },
      series: [
        {
          type: 'treemap' as const,
          data: series,
          roam: false,
          nodeClick: false as const,
          breadcrumb: { show: false },
          label: {
            color: '#f1f5f9',
            fontSize: 12,
            fontWeight: 600,
            formatter: '{b}',
          },
          itemStyle: {
            borderColor: '#0f172a',
            borderWidth: 2,
            gapWidth: 2,
          },
        },
      ],
    };
  }, [data]);

  if (data.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-end gap-1 mb-2">
        <button
          onClick={() => setView('donut')}
          className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
            view === 'donut' ? 'bg-neon/15 text-neon' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Donut
        </button>
        <button
          onClick={() => setView('treemap')}
          className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
            view === 'treemap'
              ? 'bg-neon/15 text-neon'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Treemap
        </button>
      </div>
      <EChartsWrapper option={view === 'donut' ? donutOption : treemapOption} height={height} />
    </div>
  );
}
