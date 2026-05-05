import { createContext, useContext, type ReactNode } from 'react';
import type { RepoGuruServices } from './types.js';

const Ctx = createContext<RepoGuruServices | null>(null);

export interface RepoGuruProviderProps {
  services: RepoGuruServices;
  children: ReactNode;
}

/** Top-level provider. Mount once at the app root in each host:
 *
 *   // browser host
 *   ReactDOM.createRoot(...).render(
 *     <RepoGuruProvider services={browserServices}><App /></RepoGuruProvider>
 *   );
 *
 *   // desktop host
 *   ReactDOM.createRoot(...).render(
 *     <RepoGuruProvider services={desktopServices}><App /></RepoGuruProvider>
 *   );
 *
 * All shared pages then call `useRepoGuru()` to access the host-injected
 * services — the page itself never imports anything host-specific. */
export function RepoGuruProvider({ services, children }: RepoGuruProviderProps) {
  return <Ctx.Provider value={services}>{children}</Ctx.Provider>;
}

/** Hook used by every shared page in @repoguru/ui to access the host's
 *  platform services (data engines + repo picker). */
export function useRepoGuru(): RepoGuruServices {
  const value = useContext(Ctx);
  if (!value) {
    throw new Error(
      'useRepoGuru() must be used inside <RepoGuruProvider>. Each host (browser, desktop) wraps its app root with the provider and supplies its own services implementation.',
    );
  }
  return value;
}
