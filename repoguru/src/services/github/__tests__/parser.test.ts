import { describe, it, expect } from 'vitest';
import { parseRepoUrl } from '../parser';

describe('parseRepoUrl', () => {
  // ── Full HTTPS URLs ──

  it('parses a full HTTPS GitHub URL', () => {
    const result = parseRepoUrl('https://github.com/facebook/react');
    expect(result).toEqual({ owner: 'facebook', repo: 'react' });
  });

  it('parses an HTTP GitHub URL (no TLS)', () => {
    const result = parseRepoUrl('http://github.com/vuejs/vue');
    expect(result).toEqual({ owner: 'vuejs', repo: 'vue' });
  });

  // ── .git suffix ──

  it('strips .git suffix from repo name', () => {
    const result = parseRepoUrl('https://github.com/foo/bar.git');
    expect(result).toEqual({ owner: 'foo', repo: 'bar' });
  });

  // ── URL with branch (tree path) ──

  it('extracts branch from /tree/<branch> path', () => {
    const result = parseRepoUrl('https://github.com/foo/bar/tree/develop');
    expect(result).toEqual({ owner: 'foo', repo: 'bar', branch: 'develop' });
  });

  it('extracts branch with .git suffix and /tree/', () => {
    const result = parseRepoUrl('https://github.com/foo/bar.git/tree/main');
    // The regex captures 'bar.git' for rawRepo (because /tree/ starts a new segment),
    // and the .git is stripped afterward.
    expect(result).toEqual({ owner: 'foo', repo: 'bar', branch: 'main' });
  });

  // ── No protocol ──

  it('parses a URL without protocol prefix', () => {
    const result = parseRepoUrl('github.com/foo/bar');
    expect(result).toEqual({ owner: 'foo', repo: 'bar' });
  });

  it('parses a no-protocol URL with /tree/ branch', () => {
    const result = parseRepoUrl('github.com/foo/bar/tree/feature-x');
    expect(result).toEqual({ owner: 'foo', repo: 'bar', branch: 'feature-x' });
  });

  // ── Shorthand owner/repo ──

  it('parses shorthand owner/repo notation', () => {
    const result = parseRepoUrl('foo/bar');
    expect(result).toEqual({ owner: 'foo', repo: 'bar' });
  });

  it('parses shorthand with dots and hyphens in names', () => {
    const result = parseRepoUrl('my-org/my.repo_v2');
    expect(result).toEqual({ owner: 'my-org', repo: 'my.repo_v2' });
  });

  // ── Edge cases: empty / invalid ──

  it('returns null for an empty string', () => {
    expect(parseRepoUrl('')).toBeNull();
  });

  it('returns null for whitespace-only input', () => {
    expect(parseRepoUrl('   ')).toBeNull();
  });

  it('returns null for a single word (no slash)', () => {
    expect(parseRepoUrl('not-a-url')).toBeNull();
  });

  it('returns null for a random URL that is not GitHub', () => {
    expect(parseRepoUrl('https://gitlab.com/foo/bar')).toBeNull();
  });

  // ── Trailing slash ──

  it('handles a trailing slash on the URL', () => {
    const result = parseRepoUrl('https://github.com/foo/bar/');
    expect(result).toEqual({ owner: 'foo', repo: 'bar' });
  });

  it('handles multiple trailing slashes', () => {
    const result = parseRepoUrl('https://github.com/foo/bar///');
    expect(result).toEqual({ owner: 'foo', repo: 'bar' });
  });

  // ── Whitespace trimming ──

  it('trims leading and trailing whitespace', () => {
    const result = parseRepoUrl('  https://github.com/foo/bar  ');
    expect(result).toEqual({ owner: 'foo', repo: 'bar' });
  });

  it('trims whitespace from shorthand input', () => {
    const result = parseRepoUrl('  foo/bar  ');
    expect(result).toEqual({ owner: 'foo', repo: 'bar' });
  });

  // ── branch is undefined when not present ──

  it('does not include branch key when no branch is present', () => {
    const result = parseRepoUrl('https://github.com/owner/repo');
    expect(result).not.toBeNull();
    expect(result!.branch).toBeUndefined();
  });
});
