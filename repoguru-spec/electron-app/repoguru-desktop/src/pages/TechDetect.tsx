import { useState } from 'react';
import { grpcClient } from '@/services/grpc-client';
import { RepoPicker } from '@/components/common/RepoPicker';

interface TechCategory {
  name: string;
  items: TechItem[];
}

interface TechItem {
  name: string;
  category: string;
  confidence: string;
  files: string[];
}

const CATEGORY_STYLES: Record<string, { color: string; icon: string }> = {
  languages: { color: '#38bdf8', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
  frameworks: { color: '#34d399', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
  cloud: { color: '#a78bfa', icon: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z' },
  databases: { color: '#fbbf24', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4' },
  cicd: { color: '#fb923c', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
  testing: { color: '#f472b6', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  build: { color: '#a3e635', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
  other: { color: '#64748b', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
};

export function TechDetect() {
  const [repoPath, setRepoPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<TechCategory[]>([]);
  const [filter, setFilter] = useState('');

  const handleDetect = async () => {
    if (!repoPath) return;
    setLoading(true);
    setError(null);
    try {
      const result = await grpcClient.detectTech(repoPath) as { json?: string };
      if (result?.json) {
        const data = JSON.parse(result.json);
        // Group by category
        const grouped: Record<string, TechItem[]> = {};
        for (const item of (data.technologies || data.items || [])) {
          const cat = item.category || 'other';
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(item);
        }
        setCategories(
          Object.entries(grouped).map(([name, items]) => ({ name, items }))
            .sort((a, b) => b.items.length - a.items.length)
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = filter
    ? categories.map((c) => ({
        ...c,
        items: c.items.filter((i) =>
          i.name.toLowerCase().includes(filter.toLowerCase()) ||
          i.category.toLowerCase().includes(filter.toLowerCase())
        ),
      })).filter((c) => c.items.length > 0)
    : categories;

  const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-2">Technology Detection</h2>
      <p className="text-sm text-gray-500 mb-6">Detect languages, frameworks, cloud services, databases, and CI/CD tools.</p>

      {/* Input */}
      <div className="flex gap-3 items-end mb-6">
        <div className="flex-1">
          <RepoPicker
            value={repoPath}
            onChange={setRepoPath}
            onSubmit={handleDetect}
            showRecent
            trackRecent={false}
          />
        </div>
        <button onClick={handleDetect} disabled={!repoPath || loading} className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-md text-sm font-medium text-white transition-colors">
          {loading ? 'Detecting...' : 'Detect'}
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{error}</div>
      )}

      {/* Results */}
      {categories.length > 0 && (
        <>
          {/* Summary bar */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-400">{totalItems} technologies detected across {categories.length} categories</span>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter..."
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-sky-500 w-48"
            />
          </div>

          {/* Category grid */}
          <div className="space-y-6">
            {filteredCategories.map((cat) => {
              const style = CATEGORY_STYLES[cat.name] || CATEGORY_STYLES.other;
              return (
                <div key={cat.name} className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={style.color} strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={style.icon} />
                    </svg>
                    <h3 className="text-sm font-semibold capitalize" style={{ color: style.color }}>{cat.name}</h3>
                    <span className="text-xs text-gray-600">({cat.items.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cat.items.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-800/70 border border-gray-700 text-xs group relative"
                      >
                        <span className="text-gray-200">{item.name}</span>
                        {item.confidence && (
                          <span className="text-gray-600">{item.confidence}</span>
                        )}
                        {item.files?.length > 0 && (
                          <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 bg-gray-800 border border-gray-700 rounded p-2 text-[10px] text-gray-400 whitespace-nowrap z-10 shadow-lg">
                            {item.files.slice(0, 5).map((f) => (
                              <div key={f}>{f}</div>
                            ))}
                            {item.files.length > 5 && <div className="text-gray-600">+{item.files.length - 5} more</div>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
