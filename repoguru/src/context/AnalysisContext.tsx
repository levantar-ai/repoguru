import { createContext, useContext, useReducer, useMemo, type ReactNode } from 'react';
import type { AnalysisState, AnalysisReport, AnalysisStep } from '../types';

type AnalysisAction =
  | { type: 'SET_STEP'; step: AnalysisStep; progress?: number; subProgress?: number }
  | { type: 'SET_PROGRESS'; progress: number }
  | { type: 'SET_FILES_TOTAL'; total: number }
  | { type: 'INCREMENT_FILES_FETCHED' }
  | { type: 'SET_REPORT'; report: AnalysisReport }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'RESET' };

const initialState: AnalysisState = {
  step: 'idle',
  progress: 0,
  subProgress: 0,
  report: null,
  error: null,
  filesTotal: 0,
  filesFetched: 0,
};

function analysisReducer(state: AnalysisState, action: AnalysisAction): AnalysisState {
  switch (action.type) {
    case 'SET_STEP':
      return {
        ...state,
        step: action.step,
        progress: action.progress ?? state.progress,
        subProgress: action.subProgress ?? 0,
        error: null,
      };
    case 'SET_PROGRESS':
      return { ...state, progress: action.progress };
    case 'SET_FILES_TOTAL':
      return { ...state, filesTotal: action.total };
    case 'INCREMENT_FILES_FETCHED':
      return { ...state, filesFetched: state.filesFetched + 1 };
    case 'SET_REPORT':
      return { ...state, step: 'done', progress: 100, report: action.report };
    case 'SET_ERROR':
      return { ...state, step: 'error', error: action.error };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

interface AnalysisContextValue {
  state: AnalysisState;
  dispatch: React.Dispatch<AnalysisAction>;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(analysisReducer, initialState);

  const contextValue = useMemo(() => ({ state, dispatch }), [state, dispatch]);

  return <AnalysisContext.Provider value={contextValue}>{children}</AnalysisContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAnalysisContext() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error('useAnalysisContext must be used within AnalysisProvider');
  return ctx;
}
