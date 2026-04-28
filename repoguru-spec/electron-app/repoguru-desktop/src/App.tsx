import { HashRouter, Routes, Route, NavLink } from 'react-router';
import { ComparePage, ReportCardPage, TechDetectPage, RepoGuruProvider } from '@repoguru/ui';
import { Dashboard } from './pages/Dashboard';
import { GitStats } from './pages/GitStats';
import { OrgScan } from './pages/OrgScan';
import { PolicyEngine } from './pages/PolicyEngine';
import { Settings } from './pages/Settings';
import { ThemeToggle } from './components/common/ThemeToggle';
import { desktopServices } from './services/repoGuruServices';

const NAV_ICONS: Record<string, string> = {
  '/': 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  '/report-card': 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  '/git-stats': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  '/tech': 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  '/compare': 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  '/org-scan': 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  '/policy': 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  '/settings': 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
};

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/report-card', label: 'Report Card' },
  { to: '/git-stats', label: 'Git Stats' },
  { to: '/tech', label: 'Tech Detect' },
  { to: '/compare', label: 'Compare' },
  { to: '/org-scan', label: 'Org Scan' },
  { to: '/policy', label: 'Policy' },
  { to: '/settings', label: 'Settings' },
] as const;

export function App() {
  return (
    <RepoGuruProvider services={desktopServices}>
    <HashRouter>
      <div className="flex h-screen bg-gray-950 text-gray-100">
        {/* Sidebar */}
        <nav className="w-56 flex-shrink-0 border-r border-gray-800 bg-gray-900 flex flex-col">
          <div className="px-4 py-5 border-b border-gray-800 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">RepoGuru</h1>
              <p className="text-[10px] text-gray-500 mt-0.5">Desktop DevSecOps</p>
            </div>
            <ThemeToggle />
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-gray-800 text-white font-medium border-r-2 border-sky-500'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                  }`
                }
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={NAV_ICONS[to] || NAV_ICONS['/']} />
                </svg>
                {label}
              </NavLink>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-600">
            v0.1.0
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/report-card" element={<ReportCardPage />} />
            <Route path="/git-stats" element={<GitStats />} />
            <Route path="/tech" element={<TechDetectPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/org-scan" element={<OrgScan />} />
            <Route path="/policy" element={<PolicyEngine />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
    </RepoGuruProvider>
  );
}
