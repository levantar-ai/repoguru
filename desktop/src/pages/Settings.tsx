import { useState, useEffect } from 'react';
import { useGithubToken } from '@/hooks/useGithubToken';

interface AppSettings {
  theme: 'dark' | 'light';
  defaultOutDir: string;
  maxDiffFiles: number;
  mergeDiffLimit: number;
  threads: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  defaultOutDir: '/tmp/repoguru-scan',
  maxDiffFiles: 1000,
  mergeDiffLimit: 100,
  threads: 6,
};

const SETTINGS_KEY = 'repoguru:settings';
const THEME_KEY = 'repoguru:theme';

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    let settings: AppSettings;
    if (raw) {
      const parsed = JSON.parse(raw);
      // Strip legacy githubToken from settings if present
      const { githubToken: _, ...rest } = parsed;
      settings = { ...DEFAULT_SETTINGS, ...rest };
    } else {
      settings = DEFAULT_SETTINGS;
    }
    // Sync theme from dedicated theme key (shared with ThemeToggle)
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'dark' || savedTheme === 'light') {
      settings.theme = savedTheme;
    }
    return settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettingsToStorage(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  // Also update the shared theme key so ThemeToggle stays in sync
  localStorage.setItem(THEME_KEY, settings.theme);
}

export function Settings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [saved, setSaved] = useState(false);
  const { token, isSet, loading: tokenLoading, save: saveGithubToken, clear: clearGithubToken } = useGithubToken();
  const [tokenInput, setTokenInput] = useState('');
  const [tokenRevealed, setTokenRevealed] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('light', settings.theme === 'light');
    // Immediately persist theme changes (don't wait for Save button)
    try { localStorage.setItem(THEME_KEY, settings.theme); } catch {}
  }, [settings.theme]);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    saveSettingsToStorage(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    saveSettingsToStorage(DEFAULT_SETTINGS);
    document.documentElement.classList.remove('light');
  };

  const handleSaveToken = async () => {
    if (tokenInput.trim()) {
      await saveGithubToken(tokenInput.trim());
      setTokenInput('');
    }
  };

  const handleClearToken = async () => {
    await clearGithubToken();
    setTokenInput('');
    setTokenRevealed(false);
  };

  // Mask token display
  const maskedToken = token ? `${token.slice(0, 7)}${'*'.repeat(Math.min(token.length - 7, 30))}` : '';

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-6">Settings</h2>

      <div className="space-y-6">
        {/* Theme */}
        <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Appearance</h3>
          <div className="flex gap-3">
            {(['dark', 'light'] as const).map((t) => (
              <button
                key={t}
                onClick={() => update('theme', t)}
                className={`flex-1 px-4 py-3 rounded-md border text-sm capitalize transition-all ${
                  settings.theme === t
                    ? 'border-sky-500/50 bg-sky-500/10 text-sky-400'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {t === 'dark' ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                    </svg>
                    Dark
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="5" />
                      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                    Light
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Scan defaults */}
        <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Scan Defaults</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Default output directory</label>
              <input
                type="text"
                value={settings.defaultOutDir}
                onChange={(e) => update('defaultOutDir', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Worker threads</label>
                <input
                  type="number"
                  value={settings.threads}
                  onChange={(e) => update('threads', Number(e.target.value) || 6)}
                  min={1}
                  max={32}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Max diff files</label>
                <input
                  type="number"
                  value={settings.maxDiffFiles}
                  onChange={(e) => update('maxDiffFiles', Number(e.target.value) || 1000)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Merge diff limit</label>
                <input
                  type="number"
                  value={settings.mergeDiffLimit}
                  onChange={(e) => update('mergeDiffLimit', Number(e.target.value) || 100)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>
        </section>

        {/* GitHub Token */}
        <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">GitHub Integration</h3>

          {/* Token status */}
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-2 h-2 rounded-full ${isSet ? 'bg-green-500' : 'bg-gray-600'}`} />
            <span className="text-xs text-gray-400">
              {tokenLoading ? 'Loading...' : isSet ? 'Token configured' : 'No token set'}
            </span>
            {isSet && (
              <span className="text-[10px] text-gray-600 ml-1">
                (encrypted via {'secureStore' in (window.repoGuru || {}) ? 'safeStorage' : 'localStorage'})
              </span>
            )}
          </div>

          {/* Show current token masked */}
          {isSet && (
            <div className="flex items-center gap-2 mb-3 bg-gray-800/50 rounded-md px-3 py-2">
              <code className="text-xs text-gray-400 flex-1 font-mono">
                {tokenRevealed ? token : maskedToken}
              </code>
              <button
                onClick={() => setTokenRevealed(!tokenRevealed)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
                title={tokenRevealed ? 'Hide' : 'Reveal'}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  {tokenRevealed ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  ) : (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </>
                  )}
                </svg>
              </button>
              <button
                onClick={handleClearToken}
                className="text-gray-500 hover:text-red-400 transition-colors"
                title="Remove token"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </div>
          )}

          {/* Set new token */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {isSet ? 'Replace token' : 'Personal Access Token (for org scans, GitHub autocomplete)'}
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveToken()}
                placeholder="ghp_..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-sky-500"
              />
              <button
                onClick={handleSaveToken}
                disabled={!tokenInput.trim()}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-md text-sm font-medium text-white transition-colors"
              >
                {isSet ? 'Update' : 'Save'}
              </button>
            </div>
            <p className="text-[10px] text-gray-600 mt-1">
              Stored securely. Used for GitHub API calls (org scans, repo autocomplete).
              Needs <code className="text-gray-500">repo</code> scope.
            </p>
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 rounded-md text-sm font-medium text-white transition-colors"
          >
            Save Settings
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md text-sm text-gray-400 transition-colors"
          >
            Reset to Defaults
          </button>
          {saved && (
            <span className="text-xs text-green-400 animate-fade-in-up">Saved!</span>
          )}
        </div>

        {/* Dashboard */}
        <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Dashboard</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-300">Show Quick Start panel</p>
              <p className="text-[10px] text-gray-600 mt-0.5">Display demo repository cards on the Dashboard</p>
            </div>
            <button
              onClick={() => {
                const key = 'repoguru:quickstart-dismissed';
                const isDismissed = localStorage.getItem(key) === 'true';
                if (isDismissed) {
                  localStorage.removeItem(key);
                } else {
                  localStorage.setItem(key, 'true');
                }
                // Force re-render
                setSettings((prev) => ({ ...prev }));
              }}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                localStorage.getItem('repoguru:quickstart-dismissed') !== 'true'
                  ? 'bg-sky-600'
                  : 'bg-gray-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-[#fff] transition-transform ${
                  localStorage.getItem('repoguru:quickstart-dismissed') !== 'true'
                    ? 'translate-x-5'
                    : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </section>
      </div>

      {/* About */}
      <div className="mt-10 pt-6 border-t border-gray-800">
        <h3 className="text-sm font-semibold text-gray-300 mb-2">About</h3>
        <div className="text-xs text-gray-500 space-y-1">
          <p>RepoGuru Desktop v0.1.0</p>
          <p>Built with Electron + React + Rust</p>
          <p>Powered by gix for git analysis</p>
        </div>
      </div>
    </div>
  );
}
