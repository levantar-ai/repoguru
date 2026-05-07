import { useState, useCallback, useEffect, useRef } from 'react';
import { grpcClient, type ScoreResponse } from '../services/grpc-client';

export interface ReportCardState {
  loading: boolean;
  score: ScoreResponse | null;
  error: string | null;
}

export function useReportCard() {
  const [state, setState] = useState<ReportCardState>({
    loading: false,
    score: null,
    error: null,
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const scoreRepo = useCallback(async (repoPath: string, outPath?: string) => {
    setState({ loading: true, score: null, error: null });
    try {
      const score = await grpcClient.scoreReportCard(repoPath, outPath);
      if (mountedRef.current) setState({ loading: false, score, error: null });
      return score;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      if (mountedRef.current) setState({ loading: false, score: null, error });
      return null;
    }
  }, []);

  return { ...state, scoreRepo };
}
