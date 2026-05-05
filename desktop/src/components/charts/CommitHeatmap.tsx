import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { ChartCard } from './ChartCard';

interface Props {
  weeklyActivity: Array<[string, number]>; // [monday_date, count]
}

const CELL_SIZE = 13;
const CELL_GAP = 2;
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

export function CommitHeatmap({ weeklyActivity }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || weeklyActivity.length === 0) return;

    const svgEl = svgRef.current;

    // Expand weekly data to daily buckets for a GitHub-style heatmap
    const dailyMap = new Map<string, number>();
    for (const [monday, count] of weeklyActivity) {
      const date = new Date(monday);
      // Spread count across the 7 days proportionally (simplified)
      const perDay = Math.ceil(count / 7);
      for (let d = 0; d < 7; d++) {
        const day = new Date(date);
        day.setDate(day.getDate() + d);
        const key = day.toISOString().slice(0, 10);
        dailyMap.set(key, (dailyMap.get(key) ?? 0) + (d === 0 ? count - perDay * 6 : perDay));
      }
    }

    // Get date range
    const dates = Array.from(dailyMap.keys()).sort();
    if (dates.length === 0) return;

    const startDate = new Date(dates[Math.max(0, dates.length - 365)]);
    const endDate = new Date(dates[dates.length - 1]);

    // Build day array
    const days: Array<{ date: Date; count: number }> = [];
    const cursor = new Date(startDate);
    // Align to Sunday
    cursor.setDate(cursor.getDate() - cursor.getDay());
    while (cursor <= endDate) {
      const key = cursor.toISOString().slice(0, 10);
      days.push({ date: new Date(cursor), count: Math.max(0, dailyMap.get(key) ?? 0) });
      cursor.setDate(cursor.getDate() + 1);
    }

    const maxCount = Math.max(...days.map((d) => d.count), 1);
    const colorScale = d3.scaleSequential()
      .domain([0, maxCount])
      .interpolator(d3.interpolateRgbBasis(['#1e293b', '#0e4429', '#006d32', '#26a641', '#39d353']));

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const numWeeks = Math.ceil(days.length / 7);
    const width = numWeeks * (CELL_SIZE + CELL_GAP) + 40;
    const height = 7 * (CELL_SIZE + CELL_GAP) + 30;
    svg.attr('width', '100%').attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g').attr('transform', 'translate(30, 20)');

    // Day labels
    DAY_LABELS.forEach((label, i) => {
      if (label) {
        g.append('text')
          .attr('x', -8)
          .attr('y', i * (CELL_SIZE + CELL_GAP) + CELL_SIZE - 2)
          .attr('text-anchor', 'end')
          .attr('fill', '#64748b')
          .attr('font-size', 9)
          .text(label);
      }
    });

    // Month labels
    const months = new Set<string>();
    days.forEach((d, i) => {
      if (d.date.getDay() === 0) {
        const month = d.date.toLocaleString('default', { month: 'short' });
        const weekIdx = Math.floor(i / 7);
        const key = `${d.date.getFullYear()}-${d.date.getMonth()}`;
        if (!months.has(key)) {
          months.add(key);
          g.append('text')
            .attr('x', weekIdx * (CELL_SIZE + CELL_GAP))
            .attr('y', -5)
            .attr('fill', '#64748b')
            .attr('font-size', 9)
            .text(month);
        }
      }
    });

    // Cells
    g.selectAll('rect')
      .data(days)
      .enter()
      .append('rect')
      .attr('x', (_, i) => Math.floor(i / 7) * (CELL_SIZE + CELL_GAP))
      .attr('y', (_, i) => (i % 7) * (CELL_SIZE + CELL_GAP))
      .attr('width', CELL_SIZE)
      .attr('height', CELL_SIZE)
      .attr('rx', 2)
      .attr('fill', (d) => d.count > 0 ? colorScale(d.count) as string : '#1e293b')
      .append('title')
      .text((d) => `${d.date.toISOString().slice(0, 10)}: ${d.count} commits`);

    return () => {
      d3.select(svgEl).selectAll('*').remove();
    };
  }, [weeklyActivity]);

  return (
    <ChartCard title="Commit Heatmap" subtitle="Last 12 months of commit activity" className="col-span-full">
      <div className="overflow-x-auto">
        <svg ref={svgRef} />
      </div>
    </ChartCard>
  );
}
