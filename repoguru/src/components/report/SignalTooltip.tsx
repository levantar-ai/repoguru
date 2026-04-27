import { useState, useRef, useEffect } from 'react';

interface Education {
  why: string;
  howToFix: string;
  fixUrl?: string;
}

interface Props {
  signal: string;
  education?: Education | null;
  children: React.ReactNode;
}

export function SignalTooltip({ signal, education, children }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!education) {
    return <>{children}</>;
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="cursor-help"
      >
        {children}
      </button>

      {open && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72">
          {/* Card */}
          <div className="rounded-lg border border-border bg-surface-alt p-4 shadow-lg neon-glow">
            <h4 className="text-sm font-bold text-neon mb-2">{signal}</h4>

            <div className="mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1">
                Why this matters
              </p>
              <p className="text-sm text-text-secondary leading-relaxed">{education.why}</p>
            </div>

            <div className="mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1">
                How to fix
              </p>
              <p className="text-sm text-text-secondary leading-relaxed">{education.howToFix}</p>
            </div>

            {education.fixUrl && (
              <a
                href={education.fixUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-neon hover:text-neon-dim transition-colors mt-1"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                Create on GitHub
              </a>
            )}
          </div>

          {/* Triangle pointer */}
          <div className="flex justify-center -mt-[1px]">
            <div
              className="w-3 h-3 rotate-45 border-r border-b border-border bg-surface-alt"
              style={{ marginTop: '-6px' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
