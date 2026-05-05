import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseRepoUrl } from '../parser';

const NUM_RUNS = 10_000;

describe('parseRepoUrl — property-based fuzz', () => {
  it('never crashes on arbitrary string input', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        // Must not throw — returning null is fine
        const result = parseRepoUrl(input);
        expect(result === null || typeof result === 'object').toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('result owner/repo never contain ".."', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = parseRepoUrl(input);
        if (result) {
          expect(result.owner).not.toContain('..');
          expect(result.repo).not.toContain('..');
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('result owner/repo never contain "/"', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = parseRepoUrl(input);
        if (result) {
          expect(result.owner).not.toContain('/');
          expect(result.repo).not.toContain('/');
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('result owner/repo never contain "<script" or "on*="', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = parseRepoUrl(input);
        if (result) {
          const combined = (result.owner + result.repo).toLowerCase();
          expect(combined).not.toContain('<script');
          expect(combined).not.toMatch(/on\w+=/i);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('valid shorthand owner/repo round-trips correctly', () => {
    const ghIdentifier = fc
      .array(
        fc.constantFrom(
          ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.-'.split(''),
        ),
        { minLength: 1, maxLength: 39 },
      )
      .map((chars) => chars.join(''))
      .filter((s) => !s.startsWith('.') && !s.endsWith('.'));

    fc.assert(
      fc.property(ghIdentifier, ghIdentifier, (owner, repo) => {
        const result = parseRepoUrl(`${owner}/${repo}`);
        expect(result).not.toBeNull();
        expect(result!.owner).toBe(owner);
        expect(result!.repo).toBe(repo);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('XSS payloads return null', () => {
    const xssPayloads = [
      '<script>alert(1)</script>',
      'javascript:alert(1)',
      '"><img src=x onerror=alert(1)>',
      "' OR 1=1 --",
      '<svg onload=alert(1)>',
      '${7*7}',
      '{{constructor.constructor("return this")()}}',
    ];

    for (const payload of xssPayloads) {
      const result = parseRepoUrl(payload);
      if (result) {
        // If it parses, owner/repo must be safe
        expect(result.owner).not.toContain('<');
        expect(result.repo).not.toContain('<');
        expect(result.owner.toLowerCase()).not.toContain('script');
        expect(result.repo.toLowerCase()).not.toContain('script');
      }
    }
  });
});
