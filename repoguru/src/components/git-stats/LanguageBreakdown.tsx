import { useMemo, useState } from 'react';
import { LanguageBreakdownChart } from '@repoguru/ui';
import type { PatternsSection } from '@repoguru/core';
import { EChartsWrapper } from './EChartsWrapper';
import { CHART_COLORS } from '../../utils/echartsTheme';

interface Props {
  languages: PatternsSection['languageBreakdown'];
}

export function LanguageBreakdown({ languages }: Props) {
  const [view, setView] = useState<'donut' | 'treemap'>('donut');

  const treemapOption = useMemo(() => {
    const data = languages.map((lang, i) => ({
      name: lang.language,
      value: lang.bytes ?? 0,
      itemStyle: {
        color: CHART_COLORS[i % CHART_COLORS.length],
      },
    }));

    return {
      tooltip: {
        formatter: (params: { name: string; value: number }) => {
          const lang = languages.find((l) => l.language === params.name);
          const pct = lang?.percentage ?? 0;
          const bytes = params.value;
          const size =
            bytes >= 1024 * 1024
              ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
              : `${(bytes / 1024).toFixed(1)} KB`;
          return `<b>${params.name}</b><br/>${size} (${pct.toFixed(1)}%)`;
        },
      },
      series: [
        {
          type: 'treemap' as const,
          data,
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
      {view === 'donut' ? (
        <LanguageBreakdownChart data={languages} card={false} height={350} />
      ) : (
        <EChartsWrapper option={treemapOption} height="350px" />
      )}
    </div>
  );
}
