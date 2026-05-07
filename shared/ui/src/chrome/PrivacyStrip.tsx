/** A thin "100% client-side · No code uploaded · No login required"
 *  strip rendered beneath the hero on landing pages. RepoGuru's
 *  privacy story is its strongest moat vs. every paid SaaS peer
 *  (Snyk / Sonar / DeepSource all store your code) and was
 *  previously buried in /docs. Surfacing it inline turns it into a
 *  trust signal that earns the OAuth ask without the user having to
 *  go looking. */
export function PrivacyStrip({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-text-muted mb-6 ${className}`}
      role="note"
      aria-label="Privacy guarantees"
    >
      <Item>100% client-side</Item>
      <span aria-hidden="true" className="text-border">
        ·
      </span>
      <Item>No code uploaded</Item>
      <span aria-hidden="true" className="text-border">
        ·
      </span>
      <Item>No login required</Item>
    </div>
  );
}

function Item({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <svg
        className="h-3 w-3 text-grade-a shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      {children}
    </span>
  );
}
