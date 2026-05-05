import { useMemo, type ReactNode } from 'react';
import { RepoGuruProvider } from '@repoguru/ui';
import { useApp } from '../context/AppContext';
import { makeBrowserServices } from './repoGuruServices';

/** Wraps children with @repoguru/ui's RepoGuruProvider, supplying the
 *  browser-side services implementation. The browser's processing engine
 *  (isomorphic-git + GitHub API + in-page light analyser) backs every
 *  shared page mounted under it. */
export function BrowserServicesProvider({ children }: { children: ReactNode }) {
  const { state } = useApp();
  const services = useMemo(
    () => makeBrowserServices(
      () => state.githubToken ?? '',
      () => state.recentRepos,
      () => (state.githubUser ? { login: state.githubUser.login } : null),
    ),
    [state.githubToken, state.recentRepos, state.githubUser],
  );
  return <RepoGuruProvider services={services}>{children}</RepoGuruProvider>;
}
