import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useScan } from '@/hooks/useScan';
import { ScanProgress } from '@/components/scan/ScanProgress';
import { RepoPicker } from '@/components/common/RepoPicker';
import { addRecentRepo } from '@/services/storage';

const DEMO_REPOS = [
  { name: 'facebook/react', desc: 'A JavaScript library for building user interfaces', icon: '⚛' },
  { name: 'expressjs/express', desc: 'Fast, minimalist web framework for Node.js', icon: '🚂' },
  { name: 'kelseyhightower/nocode', desc: 'The best way to write secure applications', icon: '🚫' },
];

const DEFAULT_OUT_DIR = '/tmp/repoguru-scan';
const QUICKSTART_DISMISSED_KEY = 'repoguru:quickstart-dismissed';

export function Dashboard() {
  const [repoPath, setRepoPath] = useState('');
  const [outPath, setOutPath] = useState(DEFAULT_OUT_DIR);
  const [quickStartDismissed, setQuickStartDismissed] = useState(
    () => localStorage.getItem(QUICKSTART_DISMISSED_KEY) === 'true'
  );
  const { scanning, progress, error, startScan } = useScan();
  const navigate = useNavigate();

  const dismissQuickStart = () => {
    setQuickStartDismissed(true);
    localStorage.setItem(QUICKSTART_DISMISSED_KEY, 'true');
  };

  const handleAnalyze = async () => {
    if (!repoPath) return;
    addRecentRepo(repoPath);

    await startScan({
      repo_path: repoPath,
      out_path: outPath,
      renames: true,
      copies: false,
      rename_threshold: 50,
      merge_policy: 'first-parent',
      max_diff_files: 1000,
      merge_diff_limit: 100,
      report: false,
    });

    // After scan completes, navigate to report card
    navigate(`/report-card?repo=${encodeURIComponent(repoPath)}&out=${encodeURIComponent(outPath)}`);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white tracking-tight">RepoGuru</h2>
        <p className="text-gray-400 mt-1">Analyze any git repository for health, security, and best practices.</p>
      </div>

      {/* Repo input */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <RepoPicker
              value={repoPath}
              onChange={setRepoPath}
              onSubmit={handleAnalyze}
              showRecent
              trackRecent
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={!repoPath || scanning}
            className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-md text-sm font-medium text-white transition-colors"
          >
            {scanning ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>

        {/* Output path (collapsed by default) */}
        <details className="mt-3">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
            Advanced options
          </summary>
          <div className="mt-2">
            <label className="block text-xs text-gray-500 mb-1">Output directory</label>
            <input
              type="text"
              value={outPath}
              onChange={(e) => setOutPath(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-sky-500"
            />
          </div>
        </details>
      </div>

      {/* Scan progress */}
      {(scanning || progress) && !progress?.done && progress && (
        <div className="mt-6">
          <ScanProgress progress={progress} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Quick start cards */}
      {!quickStartDismissed && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-300">Quick Start</h3>
            <button
              onClick={dismissQuickStart}
              className="text-gray-600 hover:text-gray-400 transition-colors"
              title="Dismiss Quick Start"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {DEMO_REPOS.map((demo) => (
              <button
                key={demo.name}
                type="button"
                onClick={() => {
                  setRepoPath(demo.name);
                  addRecentRepo(demo.name);
                }}
                className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 hover:border-sky-500/30 hover:bg-gray-800/30 cursor-pointer transition-all group text-left"
              >
                <div className="text-2xl mb-2">{demo.icon}</div>
                <div className="text-sm font-medium text-gray-200 group-hover:text-sky-400 transition-colors">
                  {demo.name}
                </div>
                <div className="text-xs text-gray-500 mt-1">{demo.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feature grid */}
      <div className="mt-10 grid grid-cols-4 gap-4">
        {[
          { label: 'Report Card', desc: '8 scoring categories', path: '/report-card' },
          { label: 'Git Stats', desc: '15+ interactive charts', path: '/git-stats' },
          { label: 'Tech Detect', desc: 'Languages & frameworks', path: '/tech' },
          { label: 'Policy Engine', desc: 'Compliance rules', path: '/policy' },
        ].map((f) => (
          <button
            key={f.path}
            onClick={() => navigate(f.path)}
            className="text-left p-4 rounded-lg border border-gray-800 bg-gray-900/30 hover:border-gray-700 transition-colors"
          >
            <div className="text-sm font-medium text-gray-300">{f.label}</div>
            <div className="text-xs text-gray-600 mt-0.5">{f.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
