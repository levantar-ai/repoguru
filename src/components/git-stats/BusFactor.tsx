import { useCallback } from 'react';
import * as d3 from 'd3';
import type { BusFactorData } from '../../types/gitStats';
import { D3Container } from './D3Container';

interface Props {
  busFactor: BusFactorData;
}

export function BusFactor({ busFactor }: Props) {
  const render = useCallback(
    (svg: SVGSVGElement, width: number, height: number) => {
      const sel = d3.select(svg);
      sel.selectAll('*').remove();

      const margin = { top: 20, right: 20, bottom: 40, left: 50 };
      const w = width - margin.left - margin.right;
      const h = height - margin.top - margin.bottom;

      const g = sel.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      const n = busFactor.cumulativeContributors.length;
      if (n === 0) return;

      // X scale: % of contributors
      const xScale = d3.scaleLinear().domain([0, 100]).range([0, w]);
      // Y scale: % of commits
      const yScale = d3.scaleLinear().domain([0, 100]).range([h, 0]);

      // Axes
      g.append('g')
        .attr('transform', `translate(0,${h})`)
        .call(
          d3
            .axisBottom(xScale)
            .ticks(5)
            .tickFormat((d) => `${d}%`),
        )
        .selectAll('text')
        .style('fill', '#64748b')
        .style('font-size', '10px');

      g.append('g')
        .call(
          d3
            .axisLeft(yScale)
            .ticks(5)
            .tickFormat((d) => `${d}%`),
        )
        .selectAll('text')
        .style('fill', '#64748b')
        .style('font-size', '10px');

      // Style axes
      g.selectAll('.domain').style('stroke', '#334155');
      g.selectAll('.tick line').style('stroke', '#334155');

      // Axis labels
      g.append('text')
        .attr('x', w / 2)
        .attr('y', h + 35)
        .attr('text-anchor', 'middle')
        .style('fill', '#64748b')
        .style('font-size', '11px')
        .text('% of Contributors');

      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -h / 2)
        .attr('y', -40)
        .attr('text-anchor', 'middle')
        .style('fill', '#64748b')
        .style('font-size', '11px')
        .text('% of Commits');

      // Perfect equality line (diagonal)
      g.append('line')
        .attr('x1', xScale(0))
        .attr('y1', yScale(0))
        .attr('x2', xScale(100))
        .attr('y2', yScale(100))
        .style('stroke', '#475569')
        .style('stroke-width', 1)
        .style('stroke-dasharray', '4,4');

      // Lorenz curve data points
      const points: [number, number][] = [[0, 0]];
      for (let i = 0; i < n; i++) {
        const xPct = ((i + 1) / n) * 100;
        const yPct = busFactor.cumulativeContributors[i].cumulativePercentage;
        points.push([xPct, yPct]);
      }

      // Area between equality line and curve (inequality area)
      const area = d3
        .area<[number, number]>()
        .x((d) => xScale(d[0]))
        .y0((d) => yScale(d[0])) // equality line
        .y1((d) => yScale(d[1]))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(points)
        .attr('d', area)
        .style('fill', 'rgba(56, 189, 248, 0.1)')
        .style('stroke', 'none');

      // Lorenz curve line
      const line = d3
        .line<[number, number]>()
        .x((d) => xScale(d[0]))
        .y((d) => yScale(d[1]))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(points)
        .attr('d', line)
        .style('fill', 'none')
        .style('stroke', '#38bdf8')
        .style('stroke-width', 2.5);

      // Bus factor threshold line at 50%
      g.append('line')
        .attr('x1', xScale(0))
        .attr('y1', yScale(50))
        .attr('x2', xScale(100))
        .attr('y2', yScale(50))
        .style('stroke', '#fbbf24')
        .style('stroke-width', 1)
        .style('stroke-dasharray', '6,3');

      g.append('text')
        .attr('x', w - 4)
        .attr('y', yScale(50) - 6)
        .attr('text-anchor', 'end')
        .style('fill', '#fbbf24')
        .style('font-size', '10px')
        .text('50% threshold');

      // Bus factor annotation
      const bfPct = (busFactor.busFactor / n) * 100;
      if (bfPct > 0 && bfPct <= 100) {
        g.append('line')
          .attr('x1', xScale(bfPct))
          .attr('y1', yScale(0))
          .attr('x2', xScale(bfPct))
          .attr('y2', yScale(50))
          .style('stroke', '#f87171')
          .style('stroke-width', 1.5)
          .style('stroke-dasharray', '4,2');

        g.append('text')
          .attr('x', xScale(bfPct))
          .attr('y', yScale(0) + 15)
          .attr('text-anchor', 'middle')
          .style('fill', '#f87171')
          .style('font-size', '10px')
          .style('font-weight', '600')
          .text(`Bus Factor: ${busFactor.busFactor}`);
      }

      // Dots on curve
      g.selectAll('circle')
        .data(points.slice(1))
        .enter()
        .append('circle')
        .attr('cx', (d) => xScale(d[0]))
        .attr('cy', (d) => yScale(d[1]))
        .attr('r', 3)
        .style('fill', '#38bdf8')
        .style('stroke', '#0f172a')
        .style('stroke-width', 1.5);
    },
    [busFactor],
  );

  if (busFactor.cumulativeContributors.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-sm text-text-muted">
        No contributor data available
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-3 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-neon inline-block" /> Lorenz Curve
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 inline-block" style={{ borderTop: '1px dashed #475569' }} />{' '}
          Perfect Equality
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 inline-block" style={{ borderTop: '1px dashed #fbbf24' }} />{' '}
          50% Threshold
        </span>
      </div>
      <D3Container render={render} height={350} />
    </div>
  );
}
