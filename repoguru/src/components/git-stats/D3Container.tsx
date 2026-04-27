import { useRef, useEffect, useState } from 'react';

interface Props {
  render: (svg: SVGSVGElement, width: number, height: number) => (() => void) | void;
  height?: number;
  className?: string;
}

export function D3Container({ render, height = 400, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(0);

  // Observe container width
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  // Run render function when dimensions change
  useEffect(() => {
    if (!svgRef.current || width === 0) return;
    const cleanup = render(svgRef.current, width, height);
    return () => {
      if (cleanup) cleanup();
    };
  }, [render, width, height]);

  return (
    <div ref={containerRef} className={className}>
      <svg ref={svgRef} width={width} height={height} style={{ overflow: 'visible' }} />
    </div>
  );
}
