import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface Props {
  chart: string;
}

let mermaidInitialized = false;

export function MermaidDiagram({ chart }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'strict',
        flowchart: { curve: 'basis' },
        themeVariables: {
          primaryColor: '#1e293b',
          primaryTextColor: '#f1f5f9',
          primaryBorderColor: '#334155',
          lineColor: '#38bdf8',
          secondaryColor: '#0f172a',
          tertiaryColor: '#1e293b',
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: '14px',
        },
      });
      mermaidInitialized = true;
    }

    const render = async () => {
      if (!containerRef.current) return;
      try {
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, chart);
        containerRef.current.innerHTML = svg;
        setError(false);
      } catch {
        setError(true);
      }
    };

    render();
  }, [chart]);

  if (error) {
    return (
      <output className="block text-sm text-text-muted italic p-6">
        Unable to render repository structure diagram.
      </output>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full overflow-x-auto p-6 [&_svg]:max-w-full [&_svg]:h-auto"
      aria-label="Repository file structure diagram"
    />
  );
}
