export interface PageHeroProps {
  /** Plain text leading the title. */
  title: string;
  /** Word to highlight with the neon brand colour (rendered after `title`). */
  highlight: string;
  subtitle?: string;
  /** Apply the neon-glow text-shadow utility to the highlight word. */
  glow?: boolean;
}

/** Authoritative page hero used by every top-level page in both apps:
 *  centred bold title with a single accent word + optional subtitle.
 *  Matches the in-browser app's visual reference. */
export function PageHero({ title, highlight, subtitle, glow = true }: PageHeroProps) {
  return (
    <div className="text-center mb-10">
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-text tracking-tight">
        {title}{' '}
        <span className={`text-neon ${glow ? 'neon-glow' : ''}`}>{highlight}</span>
      </h1>
      {subtitle && (
        <p className="mt-3 text-base sm:text-lg text-text-secondary max-w-xl mx-auto">
          {subtitle}
        </p>
      )}
    </div>
  );
}
