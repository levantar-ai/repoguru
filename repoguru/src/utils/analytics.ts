declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(name: string, params?: Record<string, string | number | boolean>): void {
  try {
    window.gtag?.('event', name, params);
  } catch {
    // Analytics should never break the app
  }
}

export function trackPageView(pageId: string): void {
  trackEvent('page_view', { page_id: pageId });
}
