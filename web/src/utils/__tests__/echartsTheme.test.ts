import { describe, it, expect } from 'vitest';
import { CHART_COLORS, echartsTheme } from '../echartsTheme';

describe('CHART_COLORS', () => {
  it('is an array of 8 hex color strings', () => {
    expect(Array.isArray(CHART_COLORS)).toBe(true);
    expect(CHART_COLORS).toHaveLength(8);
  });

  it('contains only valid hex color strings', () => {
    for (const color of CHART_COLORS) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe('echartsTheme', () => {
  it('has expected top-level properties', () => {
    expect(echartsTheme).toHaveProperty('color');
    expect(echartsTheme).toHaveProperty('backgroundColor');
    expect(echartsTheme).toHaveProperty('textStyle');
    expect(echartsTheme).toHaveProperty('title');
    expect(echartsTheme).toHaveProperty('categoryAxis');
    expect(echartsTheme).toHaveProperty('valueAxis');
    expect(echartsTheme).toHaveProperty('legend');
    expect(echartsTheme).toHaveProperty('tooltip');
    expect(echartsTheme).toHaveProperty('grid');
    expect(echartsTheme).toHaveProperty('dataZoom');
  });

  it('uses CHART_COLORS as the color array', () => {
    expect(echartsTheme.color).toBe(CHART_COLORS);
  });

  it('has transparent background', () => {
    expect(echartsTheme.backgroundColor).toBe('transparent');
  });

  it('has textStyle with fontFamily and color', () => {
    expect(echartsTheme.textStyle).toBeDefined();
    expect(typeof echartsTheme.textStyle.fontFamily).toBe('string');
    expect(typeof echartsTheme.textStyle.color).toBe('string');
  });

  it('has title with textStyle configuration', () => {
    expect(echartsTheme.title).toBeDefined();
    expect(echartsTheme.title.textStyle).toBeDefined();
    expect(typeof echartsTheme.title.textStyle.color).toBe('string');
    expect(typeof echartsTheme.title.textStyle.fontWeight).toBe('number');
    expect(typeof echartsTheme.title.textStyle.fontSize).toBe('number');
  });

  it('has dataZoom with two entries (inside and slider)', () => {
    expect(Array.isArray(echartsTheme.dataZoom)).toBe(true);
    expect(echartsTheme.dataZoom).toHaveLength(2);
    expect(echartsTheme.dataZoom[0].type).toBe('inside');
    expect(echartsTheme.dataZoom[1].type).toBe('slider');
  });

  it('has slider dataZoom with styling properties', () => {
    const slider = echartsTheme.dataZoom[1];
    expect(slider.backgroundColor).toBeDefined();
    expect(slider.borderColor).toBeDefined();
    expect(slider.fillerColor).toBeDefined();
    expect(slider.handleStyle).toBeDefined();
    expect(slider.textStyle).toBeDefined();
    expect(slider.dataBackground).toBeDefined();
  });

  it('has tooltip with dark-themed styling', () => {
    expect(echartsTheme.tooltip.backgroundColor).toBeDefined();
    expect(echartsTheme.tooltip.borderColor).toBeDefined();
    expect(typeof echartsTheme.tooltip.borderWidth).toBe('number');
    expect(echartsTheme.tooltip.textStyle).toBeDefined();
  });

  it('has categoryAxis and valueAxis with axis styling', () => {
    expect(echartsTheme.categoryAxis.axisLine).toBeDefined();
    expect(echartsTheme.categoryAxis.axisTick).toBeDefined();
    expect(echartsTheme.categoryAxis.axisLabel).toBeDefined();
    expect(echartsTheme.categoryAxis.splitLine).toBeDefined();

    expect(echartsTheme.valueAxis.axisLine).toBeDefined();
    expect(echartsTheme.valueAxis.axisTick).toBeDefined();
    expect(echartsTheme.valueAxis.axisLabel).toBeDefined();
    expect(echartsTheme.valueAxis.splitLine).toBeDefined();
  });
});
