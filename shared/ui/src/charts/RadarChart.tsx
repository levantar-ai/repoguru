// Pure-SVG radar chart — no d3 or echarts dep. Same rendering used by
// the in-browser repoguru app's Repository Health card.

interface DataPoint {
  label: string;
  value: number;
  max?: number;
}

export interface RadarChartProps {
  data: DataPoint[];
  size?: number;
}

export function RadarChart({ data, size = 300 }: RadarChartProps) {
  if (data.length < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.35;
  const labelOffset = size * 0.44;
  const levels = [0.25, 0.5, 0.75, 1.0];
  const n = data.length;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  function polarToCartesian(angle: number, r: number): [number, number] {
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  const gridPolygons = levels.map((level) => {
    const points = Array.from({ length: n }, (_, i) => {
      const angle = startAngle + i * angleStep;
      const [x, y] = polarToCartesian(angle, radius * level);
      return `${x},${y}`;
    }).join(' ');
    return points;
  });

  const axisLines = Array.from({ length: n }, (_, i) => {
    const angle = startAngle + i * angleStep;
    const [x, y] = polarToCartesian(angle, radius);
    return { x, y };
  });

  const dataPoints = data.map((d, i) => {
    const max = d.max ?? 100;
    const ratio = Math.min(d.value / max, 1);
    const angle = startAngle + i * angleStep;
    const [x, y] = polarToCartesian(angle, radius * ratio);
    return { x, y };
  });
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  const labels = data.map((d, i) => {
    const angle = startAngle + i * angleStep;
    const [x, y] = polarToCartesian(angle, labelOffset);
    let anchor: 'start' | 'middle' | 'end' = 'middle';
    const normalizedX = Math.cos(angle);
    if (normalizedX < -0.1) anchor = 'end';
    else if (normalizedX > 0.1) anchor = 'start';

    let dy = '0.35em';
    const normalizedY = Math.sin(angle);
    if (normalizedY < -0.5) dy = '0em';
    else if (normalizedY > 0.5) dy = '0.7em';

    return { x, y, label: d.label, anchor, dy };
  });

  const description = data.map((d) => `${d.label}: ${d.value} of ${d.max ?? 100}`).join(', ');

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="select-none"
      aria-label={`Radar chart showing category scores: ${description}`}
    >
      <title>Category Score Radar Chart</title>
      <desc>{description}</desc>

      {gridPolygons.map((points, levelIdx) => (
        <polygon
          key={`grid-${levels[levelIdx] ?? levelIdx}`}
          points={points}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={1}
          opacity={0.5}
        />
      ))}

      {axisLines.map((end, axisIdx) => (
        <line
          key={`axis-${data[axisIdx]?.label ?? axisIdx}`}
          x1={cx}
          y1={cy}
          x2={end.x}
          y2={end.y}
          stroke="var(--color-border)"
          strokeWidth={1}
          opacity={0.3}
        />
      ))}

      <polygon
        points={dataPolygon}
        fill="rgba(56, 189, 248, 0.12)"
        stroke="#38bdf8"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {dataPoints.map((p, dotIdx) => (
        <circle
          key={`dot-${data[dotIdx]?.label ?? dotIdx}`}
          cx={p.x}
          cy={p.y}
          r={4}
          fill="#38bdf8"
          stroke="var(--color-surface)"
          strokeWidth={2}
        />
      ))}

      {labels.map((l) => (
        <text
          key={`label-${l.label}`}
          x={l.x}
          y={l.y}
          textAnchor={l.anchor}
          dy={l.dy}
          className="fill-text-secondary"
          fontSize={12}
          fontWeight={500}
        >
          {l.label}
        </text>
      ))}
    </svg>
  );
}
