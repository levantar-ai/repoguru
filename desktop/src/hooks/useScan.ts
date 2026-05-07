import { useState, useCallback, useEffect, useRef } from 'react';
import { grpcClient, type ScanRequest, type ScanProgress } from '../services/grpc-client';

export interface ScanState {
  scanning: boolean;
  progress: ScanProgress | null;
  error: string | null;
}

export function useScan() {
  const [state, setState] = useState<ScanState>({
    scanning: false,
    progress: null,
    error: null,
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const startScan = useCallback(async (req: ScanRequest) => {
    setState({ scanning: true, progress: null, error: null });

    try {
      await grpcClient.scan(req, (progress) => {
        if (mountedRef.current) setState((prev) => ({ ...prev, progress }));
      });
      if (mountedRef.current) setState((prev) => ({ ...prev, scanning: false }));
    } catch (err) {
      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          scanning: false,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    }
  }, []);

  return { ...state, startScan };
}
