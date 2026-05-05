import { describe, it, expect } from 'vitest';
import { computeAddedStats, computeRemovedStats, computeModifiedStats } from '../extractors';

// ── Mock WalkerEntry ──

function mockEntry(content: Uint8Array | null): { content(): Promise<Uint8Array | null> } {
  return { content: async () => content };
}

// ── Helper to build Uint8Array from string ──

function toBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// ── computeAddedStats ──

describe('computeAddedStats', () => {
  it('returns 0 additions when entry is null', async () => {
    const result = await computeAddedStats(null);
    expect(result).toEqual({ additions: 0, deletions: 0 });
  });

  it('returns 0 additions when entry content is null', async () => {
    const entry = mockEntry(null);
    const result = await computeAddedStats(entry as never);
    expect(result).toEqual({ additions: 0, deletions: 0 });
  });

  it('returns 0 additions for empty content', async () => {
    const entry = mockEntry(new Uint8Array(0));
    const result = await computeAddedStats(entry as never);
    expect(result).toEqual({ additions: 0, deletions: 0 });
  });

  it('counts lines for single-line content without trailing newline', async () => {
    const entry = mockEntry(toBytes('hello'));
    const result = await computeAddedStats(entry as never);
    expect(result).toEqual({ additions: 1, deletions: 0 });
  });

  it('counts lines for single-line content with trailing newline', async () => {
    const entry = mockEntry(toBytes('hello\n'));
    const result = await computeAddedStats(entry as never);
    expect(result).toEqual({ additions: 1, deletions: 0 });
  });

  it('counts lines for multi-line content', async () => {
    const entry = mockEntry(toBytes('line1\nline2\nline3\n'));
    const result = await computeAddedStats(entry as never);
    expect(result).toEqual({ additions: 3, deletions: 0 });
  });

  it('counts lines for multi-line content without trailing newline', async () => {
    const entry = mockEntry(toBytes('line1\nline2\nline3'));
    const result = await computeAddedStats(entry as never);
    expect(result).toEqual({ additions: 3, deletions: 0 });
  });

  it('returns 0 additions for binary content (contains null byte)', async () => {
    const binary = new Uint8Array([72, 101, 108, 0, 111, 10]);
    const entry = mockEntry(binary);
    const result = await computeAddedStats(entry as never);
    expect(result).toEqual({ additions: 0, deletions: 0 });
  });

  it('always returns deletions as 0', async () => {
    const entry = mockEntry(toBytes('a\nb\nc\n'));
    const result = await computeAddedStats(entry as never);
    expect(result.deletions).toBe(0);
  });
});

// ── computeRemovedStats ──

describe('computeRemovedStats', () => {
  it('returns 0 deletions when entry is null', async () => {
    const result = await computeRemovedStats(null);
    expect(result).toEqual({ additions: 0, deletions: 0 });
  });

  it('returns 0 deletions when entry content is null', async () => {
    const entry = mockEntry(null);
    const result = await computeRemovedStats(entry as never);
    expect(result).toEqual({ additions: 0, deletions: 0 });
  });

  it('returns 0 deletions for empty content', async () => {
    const entry = mockEntry(new Uint8Array(0));
    const result = await computeRemovedStats(entry as never);
    expect(result).toEqual({ additions: 0, deletions: 0 });
  });

  it('counts lines as deletions for single-line content', async () => {
    const entry = mockEntry(toBytes('hello'));
    const result = await computeRemovedStats(entry as never);
    expect(result).toEqual({ additions: 0, deletions: 1 });
  });

  it('counts lines as deletions for multi-line content', async () => {
    const entry = mockEntry(toBytes('line1\nline2\nline3\n'));
    const result = await computeRemovedStats(entry as never);
    expect(result).toEqual({ additions: 0, deletions: 3 });
  });

  it('returns 0 deletions for binary content', async () => {
    const binary = new Uint8Array([72, 101, 108, 0, 111, 10]);
    const entry = mockEntry(binary);
    const result = await computeRemovedStats(entry as never);
    expect(result).toEqual({ additions: 0, deletions: 0 });
  });

  it('always returns additions as 0', async () => {
    const entry = mockEntry(toBytes('a\nb\nc\n'));
    const result = await computeRemovedStats(entry as never);
    expect(result.additions).toBe(0);
  });
});

// ── computeModifiedStats ──

describe('computeModifiedStats', () => {
  it('returns 0/0 when both contents are null', async () => {
    const parentEntry = mockEntry(null);
    const currentEntry = mockEntry(null);
    const result = await computeModifiedStats(parentEntry as never, currentEntry as never);
    expect(result).toEqual({ additions: 0, deletions: 0 });
  });

  it('returns 0/0 when old content is null', async () => {
    const parentEntry = mockEntry(null);
    const currentEntry = mockEntry(toBytes('hello\n'));
    const result = await computeModifiedStats(parentEntry as never, currentEntry as never);
    expect(result).toEqual({ additions: 0, deletions: 0 });
  });

  it('returns 0/0 when new content is null', async () => {
    const parentEntry = mockEntry(toBytes('hello\n'));
    const currentEntry = mockEntry(null);
    const result = await computeModifiedStats(parentEntry as never, currentEntry as never);
    expect(result).toEqual({ additions: 0, deletions: 0 });
  });

  it('returns 0/0 when both contents are identical', async () => {
    const content = toBytes('line1\nline2\n');
    const parentEntry = mockEntry(content);
    const currentEntry = mockEntry(content);
    const result = await computeModifiedStats(parentEntry as never, currentEntry as never);
    expect(result).toEqual({ additions: 0, deletions: 0 });
  });

  it('detects additions when new content has extra lines', async () => {
    const oldContent = toBytes('line1\nline2\n');
    const newContent = toBytes('line1\nline2\nline3\n');
    const parentEntry = mockEntry(oldContent);
    const currentEntry = mockEntry(newContent);
    const result = await computeModifiedStats(parentEntry as never, currentEntry as never);
    expect(result.additions).toBe(1);
    expect(result.deletions).toBe(0);
  });

  it('detects deletions when new content has fewer lines', async () => {
    const oldContent = toBytes('line1\nline2\nline3\n');
    const newContent = toBytes('line1\nline2\n');
    const parentEntry = mockEntry(oldContent);
    const currentEntry = mockEntry(newContent);
    const result = await computeModifiedStats(parentEntry as never, currentEntry as never);
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(1);
  });

  it('detects both additions and deletions when lines are changed', async () => {
    const oldContent = toBytes('line1\nline2\nline3\n');
    const newContent = toBytes('line1\nmodified\nline3\nnewline\n');
    const parentEntry = mockEntry(oldContent);
    const currentEntry = mockEntry(newContent);
    const result = await computeModifiedStats(parentEntry as never, currentEntry as never);
    // 'modified' and 'newline' are additions; 'line2' is a deletion
    expect(result.additions).toBe(2);
    expect(result.deletions).toBe(1);
  });

  it('returns 0/0 for binary old content', async () => {
    const binary = new Uint8Array([72, 101, 108, 0, 111, 10]);
    const text = toBytes('hello\n');
    const parentEntry = mockEntry(binary);
    const currentEntry = mockEntry(text);
    const result = await computeModifiedStats(parentEntry as never, currentEntry as never);
    expect(result).toEqual({ additions: 0, deletions: 0 });
  });

  it('returns 0/0 for binary new content', async () => {
    const text = toBytes('hello\n');
    const binary = new Uint8Array([72, 101, 108, 0, 111, 10]);
    const parentEntry = mockEntry(text);
    const currentEntry = mockEntry(binary);
    const result = await computeModifiedStats(parentEntry as never, currentEntry as never);
    expect(result).toEqual({ additions: 0, deletions: 0 });
  });

  it('handles completely different content', async () => {
    const oldContent = toBytes('aaa\nbbb\nccc\n');
    const newContent = toBytes('xxx\nyyy\nzzz\n');
    const parentEntry = mockEntry(oldContent);
    const currentEntry = mockEntry(newContent);
    const result = await computeModifiedStats(parentEntry as never, currentEntry as never);
    expect(result.additions).toBe(3);
    expect(result.deletions).toBe(3);
  });
});
