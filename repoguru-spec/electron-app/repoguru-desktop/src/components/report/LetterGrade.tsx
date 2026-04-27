import { useMemo } from 'react';

const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', F: '#ef4444',
};

const GRADE_GLOWS: Record<string, string> = {
  A: 'grade-glow-a', B: 'grade-glow-b', C: 'grade-glow-c',
  D: 'grade-glow-d', F: 'grade-glow-f',
};

interface Props {
  grade: string;
  score: number;
  size?: 'sm' | 'lg';
  animated?: boolean;
}

export function LetterGrade({ grade, score, size = 'lg', animated = false }: Props) {
  const dims = size === 'lg'
    ? { svgSize: 120, radius: 48, stroke: 6, fontSize: 36, scoreFontSize: 12 }
    : { svgSize: 48, radius: 18, stroke: 3, fontSize: 16, scoreFontSize: 0 };

  const { circumference, offset } = useMemo(() => {
    const c = 2 * Math.PI * dims.radius;
    return { circumference: c, offset: c - (score / 100) * c };
  }, [score, dims.radius]);

  const color = GRADE_COLORS[grade] || '#64748b';
  const glow = GRADE_GLOWS[grade] || '';

  return (
    <div className={`inline-flex flex-col items-center ${animated ? 'animate-grade-reveal' : ''} ${glow}`}>
      <svg width={dims.svgSize} height={dims.svgSize} viewBox={`0 0 ${dims.svgSize} ${dims.svgSize}`}>
        {/* Background circle */}
        <circle
          cx={dims.svgSize / 2}
          cy={dims.svgSize / 2}
          r={dims.radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={dims.stroke}
          className="text-gray-800"
        />
        {/* Score arc */}
        <circle
          cx={dims.svgSize / 2}
          cy={dims.svgSize / 2}
          r={dims.radius}
          fill="none"
          stroke={color}
          strokeWidth={dims.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${dims.svgSize / 2} ${dims.svgSize / 2})`}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
        {/* Grade letter */}
        <text
          x={dims.svgSize / 2}
          y={size === 'lg' ? dims.svgSize / 2 - 4 : dims.svgSize / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          fontSize={dims.fontSize}
          fontWeight="bold"
        >
          {grade}
        </text>
        {/* Score number (lg only) */}
        {size === 'lg' && (
          <text
            x={dims.svgSize / 2}
            y={dims.svgSize / 2 + 22}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#94a3b8"
            fontSize={dims.scoreFontSize}
          >
            {score}/100
          </text>
        )}
      </svg>
    </div>
  );
}
