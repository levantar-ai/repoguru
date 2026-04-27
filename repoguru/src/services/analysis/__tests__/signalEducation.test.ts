import { describe, it, expect } from 'vitest';
import { SIGNAL_EDUCATION, getFixUrl } from '../signalEducation';

describe('SIGNAL_EDUCATION', () => {
  it('is a non-empty record', () => {
    expect(Object.keys(SIGNAL_EDUCATION).length).toBeGreaterThan(0);
  });

  it('each entry has required fields', () => {
    for (const [key, entry] of Object.entries(SIGNAL_EDUCATION)) {
      expect(entry.name).toBe(key);
      expect(entry.category).toBeTruthy();
      expect(entry.why).toBeTruthy();
      expect(entry.howToFix).toBeTruthy();
    }
  });

  it('contains documentation category signals', () => {
    expect(SIGNAL_EDUCATION['README exists']).toBeDefined();
    expect(SIGNAL_EDUCATION['README exists'].category).toBe('documentation');
  });

  it('contains security category signals', () => {
    expect(SIGNAL_EDUCATION['SECURITY.md']).toBeDefined();
    expect(SIGNAL_EDUCATION['SECURITY.md'].category).toBe('security');
  });
});

describe('getFixUrl', () => {
  it('returns a URL with owner/repo/branch substituted', () => {
    const url = getFixUrl('myowner', 'myrepo', 'main', 'README exists');
    expect(url).toBeDefined();
    expect(url).toContain('myowner');
    expect(url).toContain('myrepo');
    expect(url).toContain('main');
  });

  it('returns undefined for unknown signal name', () => {
    const url = getFixUrl('o', 'r', 'b', 'nonexistent-signal');
    expect(url).toBeUndefined();
  });

  it('returns undefined for signal without fixUrl', () => {
    // Find a signal that doesn't have a fixUrl
    const noFixUrl = Object.entries(SIGNAL_EDUCATION).find(([, e]) => !e.fixUrl);
    if (noFixUrl) {
      const url = getFixUrl('o', 'r', 'b', noFixUrl[0]);
      expect(url).toBeUndefined();
    }
  });

  it('encodes special characters in owner/repo/branch', () => {
    const url = getFixUrl('my owner', 'my repo', 'feat/branch', 'README exists');
    if (url) {
      expect(url).toContain('my%20owner');
      expect(url).toContain('my%20repo');
      expect(url).toContain('feat%2Fbranch');
    }
  });
});
