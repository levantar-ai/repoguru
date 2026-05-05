import { DEMO_REPOS } from '../../utils/constants';
import { trackEvent } from '../../utils/analytics';

interface Props {
  onSelect: (url: string) => void;
  disabled: boolean;
}

export function DemoRepoCards({ onSelect, disabled }: Props) {
  return (
    <section className="w-full max-w-2xl mx-auto mt-10" aria-labelledby="demo-repos-heading">
      <h2
        id="demo-repos-heading"
        className="text-xs font-semibold text-text-muted mb-4 uppercase tracking-widest"
      >
        Try a demo
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {DEMO_REPOS.map((demo) => (
          <button
            key={`${demo.owner}/${demo.repo}`}
            onClick={() => {
              trackEvent('demo_repo_click', { repo: `${demo.owner}/${demo.repo}` });
              onSelect(`${demo.owner}/${demo.repo}`);
            }}
            disabled={disabled}
            className="card-glow text-left p-5 rounded-xl border border-border bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 group"
            aria-label={`Analyze ${demo.owner}/${demo.repo}: ${demo.description}`}
          >
            <div className="text-sm font-semibold text-text group-hover:text-neon transition-colors">
              {demo.owner}/<wbr />
              {demo.repo}
            </div>
            <div className="text-xs text-text-muted mt-2 leading-relaxed">{demo.description}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
