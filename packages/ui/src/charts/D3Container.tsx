import { useRef, useEffect, useState } from 'react';

export interface D3ContainerProps {
  /**
   * Render callback. Called whenever the container resizes. Return an
   * optional teardown function for any listeners/transitions you set up.
   */
  render: (svg: SVGSVGElement, width: number, height: number) => (() => void) | void;
  height?: number;
  className?: string;
}

/** Width-observing SVG host for D3 charts. */
export function D3Container({ render, height = 400, className = '' }: D3ContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(0);

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
