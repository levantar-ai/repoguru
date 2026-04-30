/** Curated demo repos for the Report Card / Compare / Tech Detect
 *  cold-start flows. Replaces the previous lone `octocat/hello-world`
 *  chip — a stub repo that scored 4/100 F with empty insights and was
 *  the first thing every new visitor saw. The new set is real
 *  production codebases at varying grade levels so a click delivers
 *  an immediately-useful artifact.
 *
 *  Order picks A-grade leads first so the demo *sells* the product on
 *  first interaction; `octocat/hello-world` is retained at the end
 *  deliberately as "what an F looks like" for the curious. */
export interface DemoChip {
  slug: string;
  hint: string;
}

export const DEMO_REPOS: DemoChip[] = [
  { slug: 'vercel/next.js',         hint: 'A — large, well-tested SaaS framework' },
  { slug: 'vitejs/vite',            hint: 'A — battle-tested build tool' },
  { slug: 'tailwindlabs/tailwindcss', hint: 'A — high-quality utility CSS' },
  { slug: 'octocat/Hello-World',    hint: 'F — see what a failing repo looks like' },
];

export interface DemoChipsProps {
  /** Called with the selected slug. Hosting page typically pipes it
   *  into the picker's onChange + immediately runs scoring. */
  onPick: (slug: string) => void;
  /** Disable while a scoring run is in flight. */
  disabled?: boolean;
}

export function DemoChips({ onPick, disabled }: DemoChipsProps) {
  return (
    <div className="flex flex-col items-center gap-2 mb-3" role="group" aria-label="Try a demo repository">
      <span className="text-xs uppercase tracking-wider text-text-muted font-medium">
        Or try one of these
      </span>
      <div className="flex flex-wrap justify-center gap-1.5">
        {DEMO_REPOS.map((d) => (
          <button
            key={d.slug}
            type="button"
            disabled={disabled}
            onClick={() => onPick(d.slug)}
            title={d.hint}
            className="px-3 py-1.5 rounded-lg text-xs bg-surface-alt border border-border text-text-secondary hover:text-neon hover:border-neon/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {d.slug}
          </button>
        ))}
      </div>
    </div>
  );
}
