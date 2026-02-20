const version = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

export function Footer() {
  return (
    <footer className="no-print border-t border-border py-8 mt-auto" role="contentinfo">
      <div className="px-8 lg:px-12 text-center text-sm text-text-muted">
        <p>
          <span className="text-neon/60">RepoRev</span> &mdash; Fully client-side GitHub repository
          analysis. No data leaves your browser.
        </p>
        <p className="mt-2 text-xs text-text-muted/50">v{version}</p>
      </div>
    </footer>
  );
}
