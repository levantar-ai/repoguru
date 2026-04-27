import { describe, it, expect, vi, beforeEach } from 'vitest';
import { humanizeCloneError, formatHumanizedError, parseErrorWithTip } from '../humanizeError';

vi.mock('../browserDetect', () => ({
  detectBrowser: vi.fn(() => 'chrome'),
}));

import { detectBrowser } from '../browserDetect';
const mockDetectBrowser = vi.mocked(detectBrowser);

beforeEach(() => {
  mockDetectBrowser.mockReturnValue('chrome');
});

describe('humanizeCloneError', () => {
  describe('storage / quota errors', () => {
    it('recognizes "serialized value is too large"', () => {
      const result = humanizeCloneError('The serialized value is too large');
      expect(result.title).toContain('too large');
      expect(result.tip).toBeUndefined();
    });

    it('recognizes "QuotaExceededError"', () => {
      const result = humanizeCloneError('QuotaExceededError: storage full');
      expect(result.title).toContain('too large');
    });

    it('recognizes generic "quota" message', () => {
      const result = humanizeCloneError('Exceeded storage quota');
      expect(result.title).toContain('too large');
    });

    it('adds Firefox tip on quota error when browser is Firefox', () => {
      mockDetectBrowser.mockReturnValue('firefox');
      const result = humanizeCloneError('QuotaExceededError');
      expect(result.tip).toContain('Firefox');
      expect(result.tip).toContain('IndexedDB');
    });
  });

  describe('timeout errors', () => {
    it('recognizes "timed out"', () => {
      const result = humanizeCloneError('Request timed out');
      expect(result.title).toContain('timed out');
    });

    it('recognizes "timeout"', () => {
      const result = humanizeCloneError('Connection timeout after 30s');
      expect(result.title).toContain('timed out');
    });
  });

  describe('not found errors', () => {
    it('recognizes "404"', () => {
      const result = humanizeCloneError('HTTP Error: 404 Not Found');
      expect(result.title).toContain('not found');
    });

    it('recognizes "not found"', () => {
      const result = humanizeCloneError('Repository not found');
      expect(result.title).toContain('not found');
    });
  });

  describe('rate limit errors', () => {
    it('recognizes "403"', () => {
      const result = humanizeCloneError('HTTP Error: 403 Forbidden');
      expect(result.title).toContain('rate limit');
    });

    it('recognizes "rate limit"', () => {
      const result = humanizeCloneError('API rate limit exceeded');
      expect(result.title).toContain('rate limit');
    });

    it('recognizes "rate_limit"', () => {
      const result = humanizeCloneError('rate_limit reached');
      expect(result.title).toContain('rate limit');
    });
  });

  describe('auth errors', () => {
    it('recognizes "401"', () => {
      const result = humanizeCloneError('HTTP Error: 401');
      expect(result.title).toContain('expired or revoked');
    });

    it('recognizes "bad credentials"', () => {
      const result = humanizeCloneError('Bad credentials');
      expect(result.title).toContain('expired or revoked');
    });

    it('recognizes "unauthorized"', () => {
      const result = humanizeCloneError('Unauthorized access');
      expect(result.title).toContain('expired or revoked');
    });
  });

  describe('fallback', () => {
    it('returns generic error with raw message in body', () => {
      const result = humanizeCloneError('Something completely unexpected');
      expect(result.title).toContain('Something went wrong');
      expect(result.body).toBe('Something completely unexpected');
      expect(result.tip).toBeUndefined();
    });

    it('adds Firefox tip for IndexedDB-related fallback on Firefox', () => {
      mockDetectBrowser.mockReturnValue('firefox');
      const result = humanizeCloneError('Unknown IndexedDB failure');
      expect(result.tip).toContain('Firefox');
    });

    it('adds Firefox tip for IDB-related fallback on Firefox', () => {
      mockDetectBrowser.mockReturnValue('firefox');
      const result = humanizeCloneError('idb transaction aborted');
      expect(result.tip).toContain('Firefox');
    });

    it('no Firefox tip on Chrome for IndexedDB errors', () => {
      mockDetectBrowser.mockReturnValue('chrome');
      const result = humanizeCloneError('Unknown IndexedDB failure');
      expect(result.tip).toBeUndefined();
    });
  });
});

describe('formatHumanizedError', () => {
  it('formats title and body', () => {
    const result = formatHumanizedError({ title: 'Oops', body: 'Something broke' });
    expect(result).toBe('Oops. Something broke');
  });

  it('appends tip with ||| delimiter', () => {
    const result = formatHumanizedError({
      title: 'Oops',
      body: 'Something broke',
      tip: 'Try this',
    });
    expect(result).toBe('Oops. Something broke|||Try this');
  });
});

describe('parseErrorWithTip', () => {
  it('parses message without tip', () => {
    const result = parseErrorWithTip('Oops. Something broke');
    expect(result.message).toBe('Oops. Something broke');
    expect(result.tip).toBeUndefined();
  });

  it('parses message with tip', () => {
    const result = parseErrorWithTip('Oops. Something broke|||Try this');
    expect(result.message).toBe('Oops. Something broke');
    expect(result.tip).toBe('Try this');
  });
});
