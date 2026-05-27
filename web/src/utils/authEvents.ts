// Tiny pub/sub for "your GitHub auth just died" events.
//
// The github client (`services/github/client.ts`) lives outside the
// React tree but needs to flip a piece of UI state (the inline
// reconnect banner) when it sees a 401. AppProvider subscribes on
// mount, dispatches SET_AUTH_EXPIRED, and the banner picks it up.
//
// Module-level singleton — safe because each browser tab has one
// module instance.

type Listener = () => void;
const listeners = new Set<Listener>();

export function notifyAuthExpired(): void {
  for (const l of listeners) l();
}

export function onAuthExpired(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Dev-only window hook so Playwright / DevTools can fire the event
// against the canonical module instance — Vite serves the source via
// two slightly different resolved paths (with/without `.ts`), which
// produces two module copies and hence two distinct listener Sets.
// In production this whole block is dead-code-eliminated.
if (import.meta.env.DEV) {
  (
    globalThis as unknown as { __notifyAuthExpired?: typeof notifyAuthExpired }
  ).__notifyAuthExpired = notifyAuthExpired;
}
