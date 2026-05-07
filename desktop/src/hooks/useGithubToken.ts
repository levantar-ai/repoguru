import { useState, useEffect, useCallback } from 'react';
import { loadToken, saveToken, clearToken } from '@/services/token';

export function useGithubToken() {
  const [token, setToken] = useState('');
  const [isSet, setIsSet] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const t = await loadToken();
    setToken(t);
    setIsSet(!!t);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadToken().then((t) => {
      if (!cancelled) {
        setToken(t);
        setIsSet(!!t);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (value: string) => {
    await saveToken(value);
    setToken(value);
    setIsSet(!!value);
  }, []);

  const clear = useCallback(async () => {
    await clearToken();
    setToken('');
    setIsSet(false);
  }, []);

  return { token, isSet, loading, save, clear, refresh };
}
