interface Props {
  title: string;
  items: string[];
  icon: 'check' | 'warning' | 'arrow';
  color: 'green' | 'yellow' | 'blue';
}

const icons = {
  check: (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  warning: (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
      />
    </svg>
  ),
  arrow: (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7l5 5m0 0l-5 5m5-5H6"
      />
    </svg>
  ),
};

const colorClasses = {
  green: 'text-grade-a',
  yellow: 'text-grade-c',
  blue: 'text-neon',
};

export function InsightsList({ title, items, icon, color }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="p-5 rounded-xl bg-surface-alt border border-border">
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
        {title}
      </h3>
      <ul className="space-y-2.5" aria-label={title}>
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-text leading-relaxed">
            <span className={`mt-0.5 ${colorClasses[color]}`}>{icons[icon]}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
