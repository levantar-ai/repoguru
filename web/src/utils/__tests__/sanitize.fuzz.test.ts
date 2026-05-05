import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { sanitizeText, escapeHtml } from '../sanitize';

const NUM_RUNS = 10_000;

describe('sanitizeText — property-based fuzz', () => {
  it('never produces output containing <script', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = sanitizeText(input);
        expect(result.toLowerCase()).not.toContain('<script');
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('never produces output containing javascript:', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = sanitizeText(input);
        expect(result.toLowerCase()).not.toContain('javascript:');
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('never produces output containing on*= event handlers', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = sanitizeText(input);
        expect(result).not.toMatch(/on\w+\s*=/i);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('is idempotent (sanitize twice === sanitize once)', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const once = sanitizeText(input);
        const twice = sanitizeText(once);
        expect(twice).toBe(once);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('strips XSS fragments embedded in random strings', () => {
    const xssFragments = [
      '<script>alert(1)</script>',
      '<SCRIPT SRC=x>',
      'javascript:void(0)',
      'JAVASCRIPT:alert(1)',
      'onclick=alert(1)',
      'onerror = fetch()',
      'onload=import()',
    ];

    fc.assert(
      fc.property(
        fc.string(),
        fc.constantFrom(...xssFragments),
        fc.string(),
        (prefix, xss, suffix) => {
          const result = sanitizeText(prefix + xss + suffix);
          expect(result.toLowerCase()).not.toContain('<script');
          expect(result.toLowerCase()).not.toContain('javascript:');
          expect(result).not.toMatch(/on\w+\s*=/i);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('escapeHtml — property-based fuzz', () => {
  it('output never contains raw < or > (after stripping entities)', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = escapeHtml(input);
        const withoutEntities = result
          .replace(/&lt;/g, '')
          .replace(/&gt;/g, '')
          .replace(/&amp;/g, '')
          .replace(/&quot;/g, '')
          .replace(/&#039;/g, '');
        expect(withoutEntities).not.toContain('<');
        expect(withoutEntities).not.toContain('>');
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('is reversible (unescape undoes escape)', () => {
    const unescapeHtml = (s: string) =>
      s
        .replace(/&#039;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&');

    fc.assert(
      fc.property(fc.string(), (input) => {
        expect(unescapeHtml(escapeHtml(input))).toBe(input);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('output length >= input length', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        expect(escapeHtml(input).length).toBeGreaterThanOrEqual(input.length);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
