import { type ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

// Tailwind classes here use CSS variables defined by the host app's theme
// (--color-border, --color-surface-raised, --color-text, --color-text-muted).
// Both existing apps already define them; @repoguru/ui doesn't ship its own
// Tailwind config.
export function ChartCard({
  title,
  subtitle,
  children,
  className = '',
}: ChartCardProps) {
  return (
    <div
      className={`rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-5 ${className}`}
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
