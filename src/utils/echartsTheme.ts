export const CHART_COLORS = [
  '#38bdf8',
  '#34d399',
  '#a3e635',
  '#fbbf24',
  '#fb923c',
  '#f87171',
  '#a78bfa',
  '#f472b6',
];

export const echartsTheme = {
  color: CHART_COLORS,
  backgroundColor: 'transparent',
  textStyle: {
    fontFamily: "'Inter', system-ui, sans-serif",
    color: '#94a3b8',
  },
  title: {
    textStyle: {
      color: '#f1f5f9',
      fontFamily: "'Inter', system-ui, sans-serif",
      fontWeight: 600,
      fontSize: 14,
    },
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#334155' } },
    axisTick: { lineStyle: { color: '#334155' } },
    axisLabel: { color: '#64748b', fontSize: 11 },
    splitLine: { lineStyle: { color: '#1e293b' } },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: '#334155' } },
    axisTick: { lineStyle: { color: '#334155' } },
    axisLabel: { color: '#64748b', fontSize: 11 },
    splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' as const } },
  },
  legend: {
    textStyle: { color: '#94a3b8', fontSize: 11 },
  },
  tooltip: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    textStyle: { color: '#f1f5f9', fontSize: 12 },
  },
  grid: {
    borderColor: '#334155',
  },
  dataZoom: [
    {
      type: 'inside' as const,
    },
    {
      type: 'slider' as const,
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      fillerColor: 'rgba(56, 189, 248, 0.1)',
      handleStyle: { color: '#38bdf8' },
      textStyle: { color: '#64748b' },
      dataBackground: {
        lineStyle: { color: '#334155' },
        areaStyle: { color: '#1e293b' },
      },
    },
  ],
};
