import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** Documentation for a single signal (a check inside a category).
 *  The browser app already has 50 of these wired up via
 *  `SIGNAL_EDUCATION`; the desktop app can supply its own lookup or
 *  fall back to nothing. */
export interface SignalDoc {
  name: string;
  category: string;
  why: string;
  howToFix: string;
  /** Optional URL prefilled with owner/repo/branch placeholders. */
  fixUrl?: string;
  learnMoreUrl?: string;
}

interface SignalDocsContextValue {
  /** Open the right-side drawer for a given signal. */
  show: (name: string) => void;
  /** Close the drawer. */
  close: () => void;
  /** Whether docs exist for the given signal name. Used by InfoIcon to
   *  hide itself when no docs are available rather than show a dead
   *  button. */
  has: (name: string) => boolean;
}

const Ctx = createContext<SignalDocsContextValue | null>(null);

/** Mount once near the app root. Provides the docs lookup + manages the
 *  shared drawer that all info icons open into.
 *
 *  Host (web/desktop) supplies the `lookup` function. The provider keeps
 *  the lookup stable + renders a fixed-position right-side drawer that
 *  swaps content as users click different info icons. */
export function SignalDocsProvider({
  lookup,
  children,
}: {
  lookup: (name: string) => SignalDoc | null;
  children: ReactNode;
}) {
  const [activeName, setActiveName] = useState<string | null>(null);

  const value = useMemo<SignalDocsContextValue>(
    () => ({
      show: (name) => setActiveName(name),
      close: () => setActiveName(null),
      has: (name) => lookup(name) !== null,
    }),
    [lookup],
  );

  // ESC closes the drawer.
  useEffect(() => {
    if (!activeName) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveName(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeName]);

  const activeDoc = activeName ? lookup(activeName) : null;

  return (
    <Ctx.Provider value={value}>
      {children}
      <SignalDocsDrawer doc={activeDoc} onClose={() => setActiveName(null)} />
    </Ctx.Provider>
  );
}

/** Hook for consumers — gives `show()` / `has()` for rendering info icons. */
export function useSignalDocs(): SignalDocsContextValue {
  const v = useContext(Ctx);
  // Graceful fallback when no provider is mounted: every info icon
  // silently disappears rather than crashing the page.
  return v ?? { show: () => {}, close: () => {}, has: () => false };
}

/** Tiny circular ⓘ button rendered inline next to a signal name. Only
 *  visible when docs exist for that signal. */
export function InfoIcon({ signalName, label }: { signalName: string; label?: string }) {
  const { show, has } = useSignalDocs();
  if (!has(signalName)) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        show(signalName);
      }}
      aria-label={label ?? `What does '${signalName}' check?`}
      title={label ?? `What does '${signalName}' check?`}
      className="inline-flex items-center justify-center h-4 w-4 rounded-full text-text-muted hover:text-neon hover:bg-neon/10 transition-colors shrink-0 align-middle"
    >
      <svg
        className="h-3 w-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 16v-5M12 8h0.01" strokeLinecap="round" />
      </svg>
    </button>
  );
}

// ─────────────────────────── drawer ───────────────────────────

function SignalDocsDrawer({ doc, onClose }: { doc: SignalDoc | null; onClose: () => void }) {
  const open = doc !== null;

  return (
    <>
      {/* Backdrop — only on mobile-sized viewports, where the drawer
          covers more of the content. On lg+ the drawer sits beside
          the content and doesn't need a backdrop. */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 bg-bg/60 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          open ? 'opacity-100 z-40 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />
      <aside
        role="dialog"
        aria-modal="false"
        aria-label="Signal documentation"
        aria-hidden={!open}
        className={`fixed top-0 right-0 h-screen w-[min(420px,90vw)] z-50 bg-surface-alt border-l border-border shadow-2xl flex flex-col transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-start justify-between gap-3 p-5 border-b border-border">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              {doc?.category ?? ''}
            </div>
            <h2 className="text-base font-semibold text-text mt-0.5 break-words">
              {doc?.name ?? ''}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close documentation"
            className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm text-text-secondary">
          {doc && (
            <>
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text mb-2">
                  Why it matters
                </h3>
                <p className="leading-relaxed">{doc.why}</p>
              </section>
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text mb-2">
                  How to fix
                </h3>
                <p className="leading-relaxed">{doc.howToFix}</p>
              </section>
              {(doc.fixUrl || doc.learnMoreUrl) && (
                <section className="flex flex-col gap-2 pt-2 border-t border-border">
                  {doc.fixUrl && (
                    <a
                      href={doc.fixUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-2 text-sm text-neon hover:underline"
                    >
                      Open in GitHub →
                    </a>
                  )}
                  {doc.learnMoreUrl && (
                    <a
                      href={doc.learnMoreUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-neon hover:underline"
                    >
                      Learn more ↗
                    </a>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
