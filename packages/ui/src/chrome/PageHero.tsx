export interface PageHeroProps {
  /** Plain text leading the title. */
  title: string;
  /** Second word of the title — receives subtle weight emphasis but no
   *  brand-colour saturation. Was previously rendered with text-neon +
   *  glow, which over-spent the accent on chrome and made every page
   *  fight the data for attention. */
  highlight: string;
  subtitle?: string;
  /** Deprecated: was the neon-glow toggle on the highlight word. Kept
   *  for source compatibility but ignored — the hero no longer uses
   *  the neon accent regardless of this value. */
  glow?: boolean;
}

/** Authoritative page hero used by every top-level page in both apps:
 *  centred title with a single emphasised second word + optional
 *  subtitle. The emphasis is deliberately understated — Linear / Stripe
 *  / Vercel use a single neutral type scale for in-app titles and
 *  reserve the brand colour for one primary action and the data ink. */
export function PageHero({ title, highlight, subtitle }: PageHeroProps) {
  return (
    <div className="text-center mb-10">
      <h1 className="text-2xl sm:text-3xl font-semibold text-text tracking-tight">
        {title}{' '}
        <span className="text-text">{highlight}</span>
      </h1>
      {subtitle && (
        <p className="mt-2 text-sm sm:text-base text-text-secondary max-w-xl mx-auto">
          {subtitle}
        </p>
      )}
    </div>
  );
}
