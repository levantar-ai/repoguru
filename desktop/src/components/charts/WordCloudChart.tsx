import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { ChartCard } from './ChartCard';

interface Props {
  words: Array<[string, number]>; // [word, frequency]
}

export function WordCloudChart({ words }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || words.length === 0) return;

    const svgEl = svgRef.current;
    const top = words.slice(0, 80);
    const maxFreq = Math.max(...top.map((w) => w[1]), 1);

    const width = 500;
    const height = 300;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', '100%').attr('viewBox', `0 0 ${width} ${height}`);

    const fontScale = d3.scaleLinear().domain([1, maxFreq]).range([10, 36]);
    const colors = ['#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#f472b6', '#facc15', '#22d3ee'];

    // Simple spiral placement (not a full force layout, but adequate)
    const g = svg.append('g').attr('transform', `translate(${width / 2}, ${height / 2})`);

    const placed: Array<{ x: number; y: number; w: number; h: number }> = [];

    top.forEach(([word, freq], i) => {
      const fontSize = fontScale(freq);

      // Spiral outward to find non-overlapping position
      let x = 0, y = 0;
      let placed_ok = false;
      for (let t = 0; t < 500 && !placed_ok; t++) {
        const angle = t * 0.15;
        const radius = t * 0.8;
        x = Math.cos(angle) * radius;
        y = Math.sin(angle) * radius;

        const estimatedW = word.length * fontSize * 0.6;
        const estimatedH = fontSize * 1.2;

        const overlaps = placed.some((p) =>
          Math.abs(x - p.x) < (estimatedW + p.w) / 2 &&
          Math.abs(y - p.y) < (estimatedH + p.h) / 2,
        );

        if (!overlaps && Math.abs(x) < width / 2 - 30 && Math.abs(y) < height / 2 - 20) {
          placed.push({ x, y, w: estimatedW, h: estimatedH });
          placed_ok = true;
        }
      }

      if (placed_ok) {
        g.append('text')
          .attr('x', x)
          .attr('y', y)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('fill', colors[i % colors.length])
          .attr('font-size', fontSize)
          .attr('font-weight', freq > maxFreq * 0.5 ? 'bold' : 'normal')
          .attr('opacity', 0.6 + 0.4 * (freq / maxFreq))
          .text(word);
      }
    });

    return () => {
      d3.select(svgEl).selectAll('*').remove();
    };
  }, [words]);

  return (
    <ChartCard title="Commit Message Words" subtitle="Most frequent words in commit messages">
      <svg ref={svgRef} />
    </ChartCard>
  );
}
