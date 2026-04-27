import type { ContributorFriendliness } from '../../types';
import { GRADE_COLORS } from '../../utils/constants';
import { scoreToGrade } from '../../utils/formatters';

interface Props {
  data: ContributorFriendliness;
}

export function ContributorScore({ data }: Props) {
  const grade = scoreToGrade(data.score);
  const color = GRADE_COLORS[grade];
  const radius = 36;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (data.score / 100) * circumference;
  const viewBox = (radius + strokeWidth) * 2;
  const center = viewBox / 2;

  const passedCount = data.readinessChecklist.filter((c) => c.passed).length;
  const totalCount = data.readinessChecklist.length;
  let ratingLabel: string;
  if (data.score >= 80) {
    ratingLabel = 'Excellent';
  } else if (data.score >= 60) {
    ratingLabel = 'Good';
  } else if (data.score >= 40) {
    ratingLabel = 'Fair';
  } else {
    ratingLabel = 'Needs Work';
  }

  return (
    <div className="rounded-xl border border-border bg-surface-alt p-6">
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-5">
        Contributor Friendliness
      </h3>

      <div className="flex items-start gap-6">
        {/* Circular gauge */}
        <div
          className="shrink-0 relative flex items-center justify-center"
          style={{ width: viewBox, height: viewBox }}
          aria-label={`Contributor friendliness score: ${data.score} out of 100, rated ${ratingLabel}`}
        >
          <svg
            className="absolute inset-0 -rotate-90"
            viewBox={`0 0 ${viewBox} ${viewBox}`}
            aria-hidden="true"
          >
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-border"
            />
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-700 ease-out"
              style={{ filter: `drop-shadow(0 0 6px ${color}50)` }}
            />
          </svg>
          <div className="text-center" aria-hidden="true">
            <div className="text-xl font-bold" style={{ color }}>
              {data.score}
            </div>
          </div>
        </div>

        {/* Score summary */}
        <div className="min-w-0">
          <div className="text-lg font-bold text-text mb-1">{ratingLabel}</div>
          <p className="text-sm text-text-muted">
            {passedCount} of {totalCount} readiness checks pass
          </p>
        </div>
      </div>

      {/* Readiness checklist */}
      <ul className="mt-5 space-y-2" aria-label="Contributor readiness checklist">
        {data.readinessChecklist.map((item) => (
          <li
            key={item.label}
            className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-surface-hover transition-colors"
          >
            {item.passed ? (
              <svg
                className="h-4 w-4 text-grade-a shrink-0 mt-0.5"
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
                className="h-4 w-4 text-grade-f/50 shrink-0 mt-0.5"
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
            <div className="min-w-0">
              <div
                className={`text-sm font-medium ${item.passed ? 'text-text' : 'text-text-muted'}`}
              >
                <span className="sr-only">{item.passed ? 'Passed:' : 'Missing:'}</span>
                {item.label}
              </div>
              <div className="text-xs text-text-muted mt-0.5">{item.description}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
