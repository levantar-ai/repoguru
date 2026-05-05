export function Spinner({
  size = 'md',
  label = 'Loading',
}: {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}) {
  const sizeClass = { sm: 'h-5 w-5', md: 'h-8 w-8', lg: 'h-12 w-12' }[size];

  return (
    <output aria-label={label}>
      <svg
        className={`animate-spin ${sizeClass} text-neon`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-20"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-80"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </output>
  );
}
