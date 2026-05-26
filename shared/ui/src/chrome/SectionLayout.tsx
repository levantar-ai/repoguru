import { useEffect, useState, type ReactNode } from 'react';

export interface SectionDef {
  id: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
  /** Optional count rendered as a pill next to the label (e.g. number of
   *  strengths, risks). When undefined or 0 nothing is rendered, so empty
   *  sections don't add visual noise. */
  badge?: number;
}

export interface SectionLayoutProps {
  sections: SectionDef[];
  /** Optional content rendered above the active section (e.g. repo header
   *  + action bar) — stays visible regardless of which section is active. */
  header?: ReactNode;
  /** Optional override for the initial active section. Defaults to the
   *  first section in the list. */
  defaultActiveId?: string;
}

const COLLAPSE_KEY = 'repoguru:section-nav-collapsed';

/** Page-internal navigation: a fixed-width left rail listing the report's
 *  sections, sitting flush against the parent's left edge so it visually
 *  continues the app's main left sidebar. The right column shows the
 *  active section's content; switching is instant (no scroll). The rail
 *  collapses to icon-only via the chevron toggle, and the collapsed state
 *  persists across pages and sessions in localStorage.
 *
 *  This component intentionally renders WITHOUT outer padding so the rail
 *  can hug the parent's left edge. Hosting pages should not wrap it in a
 *  padded container in their "done" state.
 */
export function SectionLayout({ sections, header, defaultActiveId }: SectionLayoutProps) {
  const initialId = defaultActiveId ?? sections[0]?.id ?? '';
  const [activeId, setActiveId] = useState<string>(initialId);
  const [collapsed, setCollapsed] = useState<boolean>(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    if (!sections.find((s) => s.id === activeId) && sections[0]) {
      setActiveId(sections[0].id);
    }
  }, [sections, activeId]);

  const active = sections.find((s) => s.id === activeId) ?? sections[0];
  const railWidth = collapsed ? 'w-14' : 'w-56';

  return (
    <div className="flex w-full">
      {/* Rail: flush left, full-height, mirrors the app's main sidebar
          styling so the two visually merge into one nav surface. */}
      <nav
        aria-label="Report sections"
        className={`${railWidth} shrink-0 border-r border-border bg-surface-alt transition-[width] duration-200 ease-out sticky top-0 self-start min-h-screen max-h-screen overflow-y-auto flex flex-col`}
      >
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Expand section nav' : 'Collapse section nav'}
          aria-pressed={collapsed}
          className="flex items-center justify-center gap-2 mx-2 mt-3 mb-2 px-2 py-2 rounded-lg text-text-muted hover:text-neon hover:bg-neon/5 transition-colors"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <ChevronIcon direction={collapsed ? 'right' : 'left'} />
          {!collapsed && (
            <span className="text-[10px] font-semibold uppercase tracking-wider">Collapse</span>
          )}
        </button>
        <ul className="space-y-1 list-none p-2 m-0 flex-1">
          {sections.map((s) => {
            const isActive = s.id === active?.id;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(s.id)}
                  aria-current={isActive ? 'page' : undefined}
                  // aria-label is the authoritative accessible name when
                  // the visible label is hidden in collapsed mode. title=
                  // alone is a last-resort fallback per HTML AAM and is
                  // skipped by some screen readers.
                  aria-label={collapsed ? s.label : undefined}
                  title={collapsed ? s.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-neon/10 text-neon border border-neon/30'
                      : 'text-text-secondary hover:text-text hover:bg-surface border border-transparent'
                  } ${collapsed ? 'justify-center' : ''}`}
                >
                  <span className="h-5 w-5 shrink-0" aria-hidden="true">
                    {s.icon}
                  </span>
                  <span className={collapsed ? 'sr-only' : 'truncate flex-1'}>{s.label}</span>
                  {!collapsed && s.badge !== undefined && s.badge > 0 && (
                    <span
                      className={`text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full border ${
                        isActive
                          ? 'border-neon/40 text-neon bg-neon/10'
                          : 'border-border text-text-muted bg-surface'
                      }`}
                      aria-label={`${s.badge} items`}
                    >
                      {s.badge}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex-1 min-w-0 px-8 lg:px-12 xl:px-16 py-8">
        {/* Live region announces section changes for SR users. The button
            click swaps content silently otherwise — focus stays on the
            rail and there's no spoken cue that the right pane updated. */}
        <span role="status" aria-live="polite" className="sr-only">
          {active ? `${active.label} section` : ''}
        </span>
        {header && <div className="mb-8">{header}</div>}
        {active?.content}
      </div>
    </div>
  );
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      className={`h-4 w-4 ${direction === 'left' ? '' : 'rotate-180'}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" />
    </svg>
  );
}
