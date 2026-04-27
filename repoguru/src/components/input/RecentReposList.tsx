import type { RecentRepo } from '../../types';
import { gradeColorClass } from '../../utils/formatters';

interface Props {
  repos: RecentRepo[];
  onSelect: (url: string) => void;
  disabled: boolean;
}

export function RecentReposList({ repos, onSelect, disabled }: Props) {
  if (repos.length === 0) return null;

  return (
    <section className="w-full max-w-2xl mx-auto mt-10" aria-labelledby="recent-repos-heading">
      <h2
        id="recent-repos-heading"
        className="text-xs font-semibold text-text-muted mb-4 uppercase tracking-widest"
      >
        Recent analyses
      </h2>
      <ul className="space-y-2">
        {repos.map((repo) => (
          <li key={`${repo.owner}/${repo.repo}`}>
            <button
              onClick={() => onSelect(`${repo.owner}/${repo.repo}`)}
              disabled={disabled}
              className="card-glow w-full text-left px-5 py-4 rounded-xl border border-border bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-between"
              aria-label={`Re-analyze ${repo.owner}/${repo.repo}, previous score: ${repo.overallScore} out of 100, grade ${repo.grade}`}
            >
              <span className="text-sm text-text font-medium">
                {repo.owner}/{repo.repo}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-muted">{repo.overallScore}/100</span>
                <span
                  className={`text-2xl font-bold ${gradeColorClass(repo.grade)}`}
                  aria-hidden="true"
                >
                  {repo.grade}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
