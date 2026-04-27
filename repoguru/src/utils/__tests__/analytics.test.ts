import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { trackEvent, trackPageView } from '../analytics';

describe('trackEvent', () => {
  let gtagSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gtagSpy = vi.fn();
    window.gtag = gtagSpy as unknown as typeof window.gtag;
  });

  afterEach(() => {
    delete window.gtag;
  });

  it('calls gtag with event name and params', () => {
    trackEvent('click', { target: 'button' });
    expect(gtagSpy).toHaveBeenCalledWith('event', 'click', { target: 'button' });
  });

  it('calls gtag without params', () => {
    trackEvent('scroll');
    expect(gtagSpy).toHaveBeenCalledWith('event', 'scroll', undefined);
  });

  it('does not throw when gtag is undefined', () => {
    delete window.gtag;
    expect(() => trackEvent('click')).not.toThrow();
  });

  it('does not throw when gtag throws', () => {
    window.gtag = () => {
      throw new Error('gtag broken');
    };
    expect(() => trackEvent('click')).not.toThrow();
  });
});

describe('trackPageView', () => {
  let gtagSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gtagSpy = vi.fn();
    window.gtag = gtagSpy as unknown as typeof window.gtag;
  });

  afterEach(() => {
    delete window.gtag;
  });

  it('sends page_view event with page_id', () => {
    trackPageView('home');
    expect(gtagSpy).toHaveBeenCalledWith('event', 'page_view', { page_id: 'home' });
  });
});
