import { useState } from 'react';
import { TechDetectView } from '@repoguru/ui';
import type { TechDetectResult } from '@repoguru/core';
import { grpcClient } from '@/services/grpc-client';
import { RepoPicker } from '@/components/common/RepoPicker';

interface CliShape extends Omit<TechDetectResult, 'manifestFiles' | 'totalFiles'> {
  manifest_files?: string[];
  total_files?: number;
}

function cliToTechDetect(raw: CliShape): TechDetectResult {
  return {
    aws: raw.aws ?? [],
    azure: raw.azure ?? [],
    gcp: raw.gcp ?? [],
    python: raw.python ?? [],
    node: raw.node ?? [],
    go: raw.go ?? [],
    java: raw.java ?? [],
    php: raw.php ?? [],
    rust: raw.rust ?? [],
    ruby: raw.ruby ?? [],
    frameworks: raw.frameworks ?? [],
    databases: raw.databases ?? [],
    cicd: raw.cicd ?? [],
    testing: raw.testing ?? [],
    languages: raw.languages ?? {},
    manifestFiles: raw.manifest_files ?? [],
    totalFiles: raw.total_files ?? 0,
  };
}

export function TechDetect() {
  const [repoPath, setRepoPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TechDetectResult | null>(null);

  const handleDetect = async () => {
    if (!repoPath) return;
    setLoading(true);
    setError(null);
    try {
      const res = (await grpcClient.detectTech(repoPath)) as { json?: string };
      if (res?.json) {
        const data = JSON.parse(res.json) as CliShape;
        setResult(cliToTechDetect(data));
      } else {
        setResult(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  if (!result && !loading && !error) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">Technology Detection</h2>
          <p className="text-gray-400 mt-1 text-sm">
            Detect languages, frameworks, cloud services, databases, and CI/CD tools.
          </p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <RepoPicker
                value={repoPath}
                onChange={setRepoPath}
                onSubmit={handleDetect}
                showRecent
                trackRecent={false}
              />
            </div>
            <button
              onClick={handleDetect}
              disabled={!repoPath}
              className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-md text-sm font-medium text-white transition-colors"
            >
              Detect
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-gray-800" />
          <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-sky-500 border-t-transparent animate-spin" />
        </div>
        <p className="text-gray-400 mt-4 text-sm">Detecting technologies...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {error}
        </div>
        <button
          onClick={handleDetect}
          disabled={!repoPath}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <TechDetectView
        result={result}
        actions={
          <button
            onClick={() => setResult(null)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border bg-surface-alt hover:bg-surface-hover transition-all"
          >
            New Scan
          </button>
        }
      />
    </div>
  );
}
