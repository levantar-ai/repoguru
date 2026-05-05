import type { CategoryResult } from '../../types';
import { GRADE_COLORS } from '../../utils/constants';
import { scoreToGrade } from '../../utils/formatters';

interface Props {
  categories: CategoryResult[];
}

export function CategoryScores({ categories }: Props) {
  return (
    <ul className="space-y-6 list-none p-0" aria-label="Category scores">
      {categories.map((cat) => {
        const grade = scoreToGrade(cat.score);
        const color = GRADE_COLORS[grade];

        return (
          <li key={cat.key}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-text">{cat.label}</span>
                <span className="text-xs text-text-muted font-medium px-2 py-0.5 rounded bg-surface-alt border border-border">
                  {Math.round(cat.weight * 100)}% weight
                </span>
              </div>
              <span
                className="text-lg font-bold"
                style={{ color, textShadow: `0 0 10px ${color}30` }}
              >
                {cat.score}
              </span>
            </div>
            <div className="h-2.5 bg-surface-alt rounded-full overflow-hidden border border-border mb-3">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${cat.score}%`,
                  backgroundColor: color,
                  boxShadow: `0 0 10px ${color}40`,
                }}
                aria-hidden="true"
              />
            </div>
            <progress
              className="sr-only"
              value={cat.score}
              max={100}
              aria-label={`${cat.label}: ${cat.score} out of 100`}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 ml-1">
              {cat.signals.map((signal) => (
                <div key={signal.name} className="flex items-center gap-2 text-sm">
                  {signal.found ? (
                    <svg
                      className="h-4 w-4 text-grade-a shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-4 w-4 text-grade-f/50 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  )}
                  <span className={signal.found ? 'text-text-secondary' : 'text-text-muted'}>
                    <span className="sr-only">{signal.found ? 'Present:' : 'Missing:'}</span>
                    {signal.name}
                    {signal.details && (
                      <span className="text-text-muted ml-1">— {signal.details}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
