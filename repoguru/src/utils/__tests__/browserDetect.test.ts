import { describe, it, expect, vi, afterEach } from 'vitest';
import { detectBrowser, isFirefox } from '../browserDetect';

function mockUserAgent(ua: string) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('detectBrowser', () => {
  it('detects Firefox', () => {
    mockUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/118.0');
    expect(detectBrowser()).toBe('firefox');
  });

  it('detects Edge', () => {
    mockUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/118.0.0.0 Safari/537.36 Edg/118.0.2088.76',
    );
    expect(detectBrowser()).toBe('edge');
  });

  it('detects Chrome', () => {
    mockUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/118.0.0.0 Safari/537.36',
    );
    expect(detectBrowser()).toBe('chrome');
  });

  it('detects Chromium', () => {
    mockUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chromium/118.0.0.0 Safari/537.36',
    );
    expect(detectBrowser()).toBe('chrome');
  });

  it('detects Safari', () => {
    mockUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
    );
    expect(detectBrowser()).toBe('safari');
  });

  it('returns "other" for unknown user agent', () => {
    mockUserAgent('SomeBot/1.0');
    expect(detectBrowser()).toBe('other');
  });
});

describe('isFirefox', () => {
  it('returns true for Firefox', () => {
    mockUserAgent('Mozilla/5.0 Firefox/118.0');
    expect(isFirefox()).toBe(true);
  });

  it('returns false for Chrome', () => {
    mockUserAgent('Mozilla/5.0 Chrome/118.0.0.0 Safari/537.36');
    expect(isFirefox()).toBe(false);
  });
});
