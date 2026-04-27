export type BrowserName = 'firefox' | 'chrome' | 'safari' | 'edge' | 'other';

export function detectBrowser(): BrowserName {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'firefox';
  if (ua.includes('Edg')) return 'edge';
  if (ua.includes('Chrome') || ua.includes('Chromium')) return 'chrome';
  if (ua.includes('Safari')) return 'safari';
  return 'other';
}

export function isFirefox(): boolean {
  return detectBrowser() === 'firefox';
}
