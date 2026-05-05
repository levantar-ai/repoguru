interface Entry {
  date: string;
  score: number;
}

interface Props {
  entries: Entry[];
  height?: number;
}

const GRADE_LINES = [
  { score: 85, label: 'A' },
  { score: 70, label: 'B' },
  { score: 55, label: 'C' },
  { score: 40, label: 'D' },
];

export function TrendChart({ entries, height = 200 }: Props) {
  if (entries.length === 0) return null;

  const paddingLeft = 36;
  const paddingRight = 20;
  const paddingTop = 16;
  const paddingBottom = 40;
  const width = 600;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  function scoreToY(score: number): number {
    return paddingTop + chartHeight - (score / 100) * chartHeight;
  }

  function indexToX(i: number): number {
    if (entries.length === 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (i / (entries.length - 1)) * chartWidth;
  }

  // Build accessible description
  const description = entries
    .map((e) => {
      const dateStr = new Date(e.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `${dateStr}: score ${e.score}`;
    })
    .join(', ');

  // Single data point
  if (entries.length === 1) {
    const x = indexToX(0);
    const y = scoreToY(entries[0].score);

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full select-none"
        preserveAspectRatio="xMidYMid meet"
        aria-label={`Score history chart: ${description}`}
      >
        <title>Score History</title>
        <desc>{description}</desc>

        {/* Grade threshold lines */}
        {GRADE_LINES.map((line) => (
          <line
            key={line.label}
            x1={paddingLeft}
            y1={scoreToY(line.score)}
            x2={width - paddingRight}
            y2={scoreToY(line.score)}
            stroke="var(--color-border)"
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.4}
          />
        ))}

        {/* Single dot */}
        <circle cx={x} cy={y} r={6} fill="#38bdf8" />
        <circle cx={x} cy={y} r={10} fill="none" stroke="#38bdf8" strokeWidth={2} opacity={0.3} />

        {/* Score label */}
        <text
          x={x}
          y={y - 16}
          textAnchor="middle"
          className="fill-neon"
          fontSize={14}
          fontWeight={700}
        >
          {entries[0].score}
        </text>

        {/* "First analysis" note */}
        <text x={x} y={height - 8} textAnchor="middle" className="fill-text-muted" fontSize={11}>
          First analysis
        </text>
      </svg>
    );
  }

  // Build line path
  const linePoints = entries.map((e, i) => `${indexToX(i)},${scoreToY(e.score)}`).join(' ');

  // Build area path
  const areaPath = [
    `M ${indexToX(0)},${scoreToY(entries[0].score)}`,
    ...entries.slice(1).map((e, i) => `L ${indexToX(i + 1)},${scoreToY(e.score)}`),
    `L ${indexToX(entries.length - 1)},${paddingTop + chartHeight}`,
    `L ${indexToX(0)},${paddingTop + chartHeight}`,
    'Z',
  ].join(' ');

  // Decide how many date labels to show (avoid overlap)
  const maxLabels = Math.min(entries.length, 8);
  const labelStep = Math.max(1, Math.floor(entries.length / maxLabels));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full select-none"
      preserveAspectRatio="xMidYMid meet"
      aria-label={`Score history chart showing ${entries.length} data points: ${description}`}
    >
      <title>Score History</title>
      <desc>{description}</desc>

      {/* Y-axis labels */}
      {[0, 25, 50, 75, 100].map((v) => (
        <text
          key={v}
          x={paddingLeft - 6}
          y={scoreToY(v)}
          textAnchor="end"
          dy="0.35em"
          className="fill-text-muted"
          fontSize={10}
        >
          {v}
        </text>
      ))}

      {/* Horizontal grid lines */}
      {[0, 25, 50, 75, 100].map((v) => (
        <line
          key={`grid-${v}`}
          x1={paddingLeft}
          y1={scoreToY(v)}
          x2={width - paddingRight}
          y2={scoreToY(v)}
          stroke="var(--color-border)"
          strokeWidth={1}
          opacity={0.2}
        />
      ))}

      {/* Grade threshold lines */}
      {GRADE_LINES.map((line) => (
        <g key={line.label}>
          <line
            x1={paddingLeft}
            y1={scoreToY(line.score)}
            x2={width - paddingRight}
            y2={scoreToY(line.score)}
            stroke="var(--color-border)"
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.4}
          />
          <text
            x={width - paddingRight + 4}
            y={scoreToY(line.score)}
            dy="0.35em"
            className="fill-text-muted"
            fontSize={9}
            fontWeight={600}
          >
            {line.label}
          </text>
        </g>
      ))}

      {/* Area fill */}
      <path d={areaPath} fill="rgba(56, 189, 248, 0.08)" />

      {/* Line */}
      <polyline
        points={linePoints}
        fill="none"
        stroke="#38bdf8"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Data dots */}
      {entries.map((e, i) => (
        <circle
          key={`dot-${e.date}`}
          cx={indexToX(i)}
          cy={scoreToY(e.score)}
          r={3.5}
          fill="#38bdf8"
          stroke="var(--color-surface)"
          strokeWidth={2}
        />
      ))}

      {/* X-axis date labels */}
      {entries.map((e, i) => {
        if (i % labelStep !== 0 && i !== entries.length - 1) return null;
        const dateStr = new Date(e.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        return (
          <text
            key={`date-${e.date}`}
            x={indexToX(i)}
            y={height - 8}
            textAnchor="middle"
            className="fill-text-muted"
            fontSize={10}
          >
            {dateStr}
          </text>
        );
      })}
    </svg>
  );
}
