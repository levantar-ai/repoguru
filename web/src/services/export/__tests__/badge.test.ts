import { describe, it, expect } from 'vitest';
import { generateBadgeSvg, getBadgeDataUrl, getBadgeMarkdown } from '../badge';
import type { BadgeConfig } from '../../../types';

function makeConfig(overrides: Partial<BadgeConfig> = {}): BadgeConfig {
  return {
    label: 'Repo Guru',
    grade: 'A',
    score: 92,
    style: 'flat',
    ...overrides,
  };
}

describe('generateBadgeSvg', () => {
  it('returns a valid SVG string (starts with <svg)', () => {
    const svg = generateBadgeSvg(makeConfig());
    expect(svg.trimStart()).toMatch(/^<svg\b/);
  });

  it('contains proper SVG namespace', () => {
    const svg = generateBadgeSvg(makeConfig());
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('contains the label text', () => {
    const svg = generateBadgeSvg(makeConfig({ label: 'MyBadge' }));
    expect(svg).toContain('MyBadge');
  });

  it('contains grade and score text in "grade (score)" format', () => {
    const svg = generateBadgeSvg(makeConfig({ grade: 'B', score: 75 }));
    expect(svg).toContain('B (75)');
  });

  it('contains the title element with label and value', () => {
    const svg = generateBadgeSvg(makeConfig({ label: 'Health', grade: 'A', score: 92 }));
    expect(svg).toContain('<title>Health: A (92)</title>');
  });

  it('contains aria-label for accessibility', () => {
    const svg = generateBadgeSvg(makeConfig({ label: 'Score', grade: 'C', score: 55 }));
    expect(svg).toContain('aria-label="Score: C (55)"');
  });

  // ── Color tests ──

  it('uses green (#22c55e) for grade A', () => {
    const svg = generateBadgeSvg(makeConfig({ grade: 'A' }));
    expect(svg).toContain('#22c55e');
  });

  it('uses lime (#84cc16) for grade B', () => {
    const svg = generateBadgeSvg(makeConfig({ grade: 'B' }));
    expect(svg).toContain('#84cc16');
  });

  it('uses yellow (#eab308) for grade C', () => {
    const svg = generateBadgeSvg(makeConfig({ grade: 'C' }));
    expect(svg).toContain('#eab308');
  });

  it('uses orange (#f97316) for grade D', () => {
    const svg = generateBadgeSvg(makeConfig({ grade: 'D' }));
    expect(svg).toContain('#f97316');
  });

  it('uses red (#ef4444) for grade F', () => {
    const svg = generateBadgeSvg(makeConfig({ grade: 'F' }));
    expect(svg).toContain('#ef4444');
  });

  // ── Style / border-radius tests ──

  it('uses rx="10" for pill style', () => {
    const svg = generateBadgeSvg(makeConfig({ style: 'pill' }));
    expect(svg).toContain('rx="10"');
  });

  it('uses rx="2" for flat-square style', () => {
    const svg = generateBadgeSvg(makeConfig({ style: 'flat-square' }));
    expect(svg).toContain('rx="2"');
  });

  it('uses rx="4" for default (flat) style', () => {
    const svg = generateBadgeSvg(makeConfig({ style: 'flat' }));
    expect(svg).toContain('rx="4"');
  });

  // ── Dimension tests ──

  it('calculates total width based on label and value lengths', () => {
    const config = makeConfig({ label: 'Test', grade: 'A', score: 90 });
    const svg = generateBadgeSvg(config);
    // labelWidth = 4*7+10 = 38, valueText = "A (90)" length=6, valueWidth = 6*7+10 = 52
    // totalWidth = 38+52 = 90
    expect(svg).toContain('width="90"');
  });

  it('has height of 20', () => {
    const svg = generateBadgeSvg(makeConfig());
    expect(svg).toContain('height="20"');
  });

  it('uses #555 fill for the label background', () => {
    const svg = generateBadgeSvg(makeConfig());
    expect(svg).toContain('fill="#555"');
  });

  it('uses Verdana font family', () => {
    const svg = generateBadgeSvg(makeConfig());
    expect(svg).toContain('font-family="Verdana,Geneva,sans-serif"');
  });
});

describe('getBadgeDataUrl', () => {
  it('returns a data URL with SVG MIME type and base64 encoding', () => {
    const dataUrl = getBadgeDataUrl(makeConfig());
    expect(dataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('encodes the SVG content as valid base64', () => {
    const dataUrl = getBadgeDataUrl(makeConfig());
    const base64Part = dataUrl.replace('data:image/svg+xml;base64,', '');
    const decoded = atob(base64Part);
    expect(decoded).toContain('<svg');
    expect(decoded).toContain('Repo Guru');
  });
});

describe('getBadgeMarkdown', () => {
  it('returns an image markdown tag without link when repoUrl is absent', () => {
    const md = getBadgeMarkdown(makeConfig());
    expect(md).toMatch(/^!\[Repo Guru\]\(data:image\/svg\+xml;base64,.+\)$/);
  });

  it('returns a linked image markdown tag when repoUrl is provided', () => {
    const md = getBadgeMarkdown(makeConfig(), 'https://github.com/foo/bar');
    expect(md).toMatch(
      /^\[!\[Repo Guru\]\(data:image\/svg\+xml;base64,.+\)\]\(https:\/\/github\.com\/foo\/bar\)$/,
    );
  });

  it('uses the label from config in the alt text', () => {
    const md = getBadgeMarkdown(makeConfig({ label: 'Health Score' }));
    expect(md).toContain('![Health Score]');
  });
});
