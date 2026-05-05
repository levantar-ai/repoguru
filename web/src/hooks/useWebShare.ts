import { useCallback } from 'react';

export function useWebShare() {
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  const share = useCallback(async (data: { title: string; text: string; url?: string }) => {
    if (!navigator.share) return false;
    try {
      await navigator.share(data);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { canShare, share };
}
