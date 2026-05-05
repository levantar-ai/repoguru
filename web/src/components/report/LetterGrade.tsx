import type { LetterGrade as LetterGradeType } from '../../types';
import { GRADE_COLORS } from '../../utils/constants';

interface Props {
  grade: LetterGradeType;
  score: number;
  size?: 'sm' | 'lg';
}

export function LetterGrade({ grade, score, size = 'lg' }: Props) {
  const color = GRADE_COLORS[grade];
  const dimensions = size === 'lg' ? 'h-44 w-44' : 'h-24 w-24';
  const fontSize = size === 'lg' ? 'text-6xl' : 'text-3xl';
  const scoreSize = size === 'lg' ? 'text-base' : 'text-xs';
  const strokeWidth = size === 'lg' ? 5 : 4;
  const radius = size === 'lg' ? 80 : 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const viewBox = size === 'lg' ? 176 : 96;
  const center = viewBox / 2;

  return (
    <div
      className={`relative ${dimensions} flex items-center justify-center`}
      aria-label={`Overall grade: ${grade}, score ${score} out of 100`}
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
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}
        />
      </svg>
      <div className="text-center" aria-hidden="true">
        <div
          className={`${fontSize} font-black`}
          style={{ color, textShadow: `0 0 20px ${color}40` }}
        >
          {grade}
        </div>
        <div className={`${scoreSize} text-text-secondary font-semibold mt-1`}>{score}/100</div>
      </div>
    </div>
  );
}
