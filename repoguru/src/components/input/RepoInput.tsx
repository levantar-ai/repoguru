import { useState } from 'react';
import { Spinner } from '../common/Spinner';

interface Props {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export function RepoInput({ onSubmit, isLoading }: Props) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (value.trim() && !isLoading) {
      onSubmit(value.trim());
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl mx-auto"
      aria-label="Repository analysis"
    >
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <label htmlFor="repo-url" className="sr-only">
            GitHub repository URL or owner/repo
          </label>
          <input
            id="repo-url"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="owner/repo or https://github.com/owner/repo"
            className="w-full h-14 px-5 pr-12 rounded-xl border border-border-bright bg-surface-alt text-text text-lg placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-neon/40 focus:border-neon/40 transition-all duration-200"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
            disabled={isLoading}
            aria-describedby="repo-input-hint"
            autoComplete="url"
          />
          <svg
            className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          <p id="repo-input-hint" className="sr-only">
            Enter a GitHub repository URL or owner/repo shorthand, then press Analyze or Enter
          </p>
        </div>
        <button
          type="submit"
          disabled={!value.trim() || isLoading}
          className="h-14 px-8 rounded-xl font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 sm:w-auto w-full"
          style={{
            background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
            color: '#0f172a',
            boxShadow: '0 0 16px rgba(56,189,248,0.2), 0 4px 12px rgba(0,0,0,0.3)',
          }}
          aria-busy={isLoading}
        >
          {isLoading ? <Spinner size="sm" /> : null}
          {isLoading ? 'Analyzing...' : 'Analyze'}
        </button>
      </div>
    </form>
  );
}
