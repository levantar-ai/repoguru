import type { LetterGrade, BadgeConfig } from '../../types';

const GRADE_COLORS: Record<LetterGrade, string> = {
  A: '#22c55e',
  B: '#84cc16',
  C: '#eab308',
  D: '#f97316',
  F: '#ef4444',
};

export function generateBadgeSvg(config: BadgeConfig): string {
  const { style, label, grade, score } = config;
  const color = GRADE_COLORS[grade];
  const labelWidth = label.length * 7 + 10;
  const valueText = `${grade} (${score})`;
  const valueWidth = valueText.length * 7 + 10;
  const totalWidth = labelWidth + valueWidth;
  const flatSquareRadius = style === 'flat-square' ? 2 : 4;
  const radius = style === 'pill' ? 10 : flatSquareRadius;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${valueText}">
  <title>${label}: ${valueText}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${totalWidth}" height="20" rx="${radius}" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + valueWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${valueText}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${valueText}</text>
  </g>
</svg>`;
}

export function getBadgeDataUrl(config: BadgeConfig): string {
  const svg = generateBadgeSvg(config);
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function getBadgeMarkdown(config: BadgeConfig, repoUrl?: string): string {
  const dataUrl = getBadgeDataUrl(config);
  if (repoUrl) {
    return `[![${config.label}](${dataUrl})](${repoUrl})`;
  }
  return `![${config.label}](${dataUrl})`;
}
