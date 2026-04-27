import { useMemo } from 'react';
import type { DetectedCicdTool } from '../../types/techDetect';
import { EChartsWrapper } from '../git-stats/EChartsWrapper';

const CATEGORY_LABELS: Record<string, string> = {
  ci: 'CI',
  container: 'Containers',
  orchestration: 'Orchestration',
  build: 'Build Tools',
  iac: 'Infrastructure as Code',
};

const CATEGORY_COLORS: Record<string, string> = {
  ci: '#3B82F6',
  container: '#8B5CF6',
  orchestration: '#F59E0B',
  build: '#10B981',
  iac: '#EF4444',
};

interface Props {
  cicd: DetectedCicdTool[];
}

export function CICDCoverageChart({ cicd }: Props) {
  const option = useMemo(() => {
    const categoryMap = new Map<string, Set<string>>();
    for (const tool of cicd) {
      const cat = tool.category;
      if (!categoryMap.has(cat)) categoryMap.set(cat, new Set());
      categoryMap.get(cat)!.add(tool.name);
    }

    const categories = [...categoryMap.entries()]
      .map(([cat, tools]) => ({
        label: CATEGORY_LABELS[cat] || cat,
        count: tools.size,
        color: CATEGORY_COLORS[cat] || '#6B7280',
        tools: [...tools],
      }))
      .sort((a, b) => b.count - a.count);

    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: Array<{ name: string; value: number }>) => {
          const p = params[0];
          const cat = categories.find((c) => c.label === p.name);
          const toolList = cat ? cat.tools.join(', ') : '';
          return `<b>${p.name}</b><br/>${p.value} tool${p.value !== 1 ? 's' : ''}<br/><span style="color:#999">${toolList}</span>`;
        },
      },
      grid: { left: 130, right: 30, top: 20, bottom: 20 },
      xAxis: {
        type: 'value' as const,
        minInterval: 1,
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      yAxis: {
        type: 'category' as const,
        data: categories.map((c) => c.label),
        axisLabel: { fontSize: 12 },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [
        {
          type: 'bar' as const,
          data: categories.map((c) => ({
            value: c.count,
            itemStyle: { color: c.color, borderRadius: [0, 4, 4, 0] },
          })),
          barMaxWidth: 24,
          label: {
            show: true,
            position: 'right' as const,
            fontSize: 11,
            color: '#9CA3AF',
          },
        },
      ],
    };
  }, [cicd]);

  if (cicd.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-surface-alt overflow-hidden">
      <div className="flex items-center gap-3 p-5 border-b border-border">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/10">
          <span className="text-xs font-bold text-blue-400">CI</span>
        </div>
        <h3 className="text-base font-semibold text-text flex-1">CI/CD Coverage</h3>
        <span className="shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400">
          {cicd.length} tool{cicd.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="p-4">
        <EChartsWrapper option={option} height="220px" />
      </div>
    </section>
  );
}
