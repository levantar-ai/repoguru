import { useMemo, useState } from 'react';
import type { LanguageEntry } from '../../types/gitStats';
import { EChartsWrapper } from './EChartsWrapper';
import { CHART_COLORS } from '../../utils/echartsTheme';

interface Props {
  languages: LanguageEntry[];
}

export function LanguageBreakdown({ languages }: Props) {
  const [view, setView] = useState<'donut' | 'treemap'>('donut');

  const donutOption = useMemo(() => {
    const data = languages.slice(0, 15).map((lang) => ({
      name: lang.name,
      value: lang.bytes,
    }));

    return {
      tooltip: {
        trigger: 'item' as const,
        formatter: (params: { name: string; value: number; percent: number }) => {
          const bytes = params.value;
          let size: string;
          if (bytes > 1024 * 1024) {
            size = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
          } else if (bytes > 1024) {
            size = `${(bytes / 1024).toFixed(1)} KB`;
          } else {
            size = `${bytes} B`;
          }
          return `<b>${params.name}</b><br/>${size} (${params.percent}%)`;
        },
      },
      series: [
        {
          type: 'pie',
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
          data,
        },
      ],
    };
  }, [languages]);

  const treemapOption = useMemo(() => {
    const data = languages.map((lang, i) => ({
      name: lang.name,
      value: lang.bytes,
      itemStyle: {
        color: CHART_COLORS[i % CHART_COLORS.length],
      },
    }));

    return {
      tooltip: {
        formatter: (params: { name: string; value: number }) => {
          const bytes = params.value;
          const pct = languages.find((l) => l.name === params.name)?.percentage || 0;
          const size =
            bytes > 1024 * 1024
              ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
              : `${(bytes / 1024).toFixed(1)} KB`;
          return `<b>${params.name}</b><br/>${size} (${pct}%)`;
        },
      },
      series: [
        {
          type: 'treemap',
          data,
          roam: false,
          nodeClick: false,
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
  }, [languages]);

  if (languages.length === 0) return null;

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
      <EChartsWrapper option={view === 'donut' ? donutOption : treemapOption} height="350px" />
    </div>
  );
}
