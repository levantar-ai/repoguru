import { useState, useCallback, useEffect, useRef } from 'react';
import { grpcClient, type OrgScanRequest, type OrgScanProgress } from '../services/grpc-client';

export interface OrgScanState {
  scanning: boolean;
  progress: OrgScanProgress | null;
  error: string | null;
}

export function useOrgScan() {
  const [state, setState] = useState<OrgScanState>({
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

  const startOrgScan = useCallback(async (req: OrgScanRequest) => {
    setState({ scanning: true, progress: null, error: null });

    try {
      await grpcClient.scanOrg(req, (progress) => {
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

  return { ...state, startOrgScan };
}
