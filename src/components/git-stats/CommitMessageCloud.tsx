import { useCallback } from 'react';
import * as d3 from 'd3';
import cloud from 'd3-cloud';
import { D3Container } from './D3Container';

interface WordInput {
  text: string;
  size: number;
  count: number;
}

interface PlacedWord extends cloud.Word {
  text: string;
  size: number;
  count: number;
}

interface Props {
  wordFrequency: { word: string; count: number }[];
}

export function CommitMessageCloud({ wordFrequency }: Props) {
  const render = useCallback(
    (svg: SVGSVGElement, width: number, height: number) => {
      const sel = d3.select(svg);
      sel.selectAll('*').remove();

      if (wordFrequency.length === 0) return;

      const maxCount = Math.max(...wordFrequency.map((w) => w.count));
      const words = wordFrequency.slice(0, 60);

      const fontScale = d3
        .scaleLinear()
        .domain([1, maxCount])
        .range([12, Math.min(60, width / 8)]);

      const colorScale = d3.scaleOrdinal([
        '#38bdf8',
        '#34d399',
        '#a3e635',
        '#fbbf24',
        '#fb923c',
        '#f87171',
        '#a78bfa',
        '#f472b6',
      ]);

      const layout = cloud<WordInput>()
        .size([width, height])
        .words(
          words.map((w) => ({
            text: w.word,
            size: fontScale(w.count),
            count: w.count,
          })),
        )
        .padding(4)
        .rotate(() => (crypto.getRandomValues(new Uint32Array(1))[0] / 0xffffffff > 0.7 ? 90 : 0))
        .fontSize((d) => d.size ?? 0)
        .on('end', (placedWords) => {
          const g = sel.append('g').attr('transform', `translate(${width / 2},${height / 2})`);

          g.selectAll('text')
            .data(placedWords as PlacedWord[])
            .enter()
            .append('text')
            .style('font-size', (d) => `${d.size}px`)
            .style('font-family', "'Inter', system-ui, sans-serif")
            .style('font-weight', '600')
            .style('fill', (_d, i) => colorScale(i.toString()))
            .style('opacity', '0.85')
            .attr('text-anchor', 'middle')
            .attr('transform', (d) => `translate(${d.x},${d.y})rotate(${d.rotate})`)
            .text((d) => d.text ?? '');
        });

      layout.start();
    },
    [wordFrequency],
  );

  if (wordFrequency.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-sm text-text-muted">
        No word data available
      </div>
    );
  }

  return <D3Container render={render} height={300} />;
}
