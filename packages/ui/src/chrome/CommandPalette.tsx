import { useEffect, useState, useMemo, type ReactNode } from 'react';
import { Command } from 'cmdk';
import { useRepoGuru } from '../services/Provider.js';

export interface PaletteCommand {
  /** Unique id for the cmdk row. */
  id: string;
  /** Visible label (matched against fuzzy search). */
  label: string;
  /** Optional secondary line — shortcut hint, status, last-grade, etc. */
  hint?: string;
  /** Optional left-side icon. */
  icon?: ReactNode;
  /** Optional `aria-keyshortcuts` value (e.g. "g r"). */
  shortcut?: string;
  /** Invoked when the user picks this command. */
  onSelect: () => void;
  /** Section grouping label. Items with the same group are clustered. */
  group: 'Recents' | 'Tools' | 'Actions';
}

export interface CommandPaletteProps {
  /** App-supplied list of "Tools" — usually one per nav destination. */
  tools: Omit<PaletteCommand, 'group'>[];
  /** App-supplied actions — Toggle theme, Open settings, Connect/Disconnect, etc. */
  actions?: Omit<PaletteCommand, 'group'>[];
}

const STORAGE_KEY = 'repoguru:palette-open';

/** ⌘K palette. Opens with Cmd/Ctrl+K from anywhere, also `/` when no
 *  text input has focus (GitHub muscle memory). Sections: Recents
 *  (the user's previously-analysed repos, jump straight back to
 *  Report Card), Tools (every nav destination), Actions (Settings,
 *  Connect, theme toggle).
 *
 *  The host wires `tools` (one per nav destination) and `actions`
 *  (settings, connect, theme). Recents are sourced from the
 *  RepoBrowseService's existing `recents()` so they're consistent
 *  with what the picker shows. */
export function CommandPalette({ tools, actions = [] }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const { repoBrowse } = useRepoGuru();
  const recents = repoBrowse.recents();

  // Open on Cmd/Ctrl+K. Also `/` when focus isn't in a text input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === '/' && !isInTextInput(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Persist the palette's last-was-open state — diagnostic; cmdk's
  // own state is in-memory only.
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, open ? '1' : '0'); }
    catch { /* ignore */ }
  }, [open]);

  const recentCommands: PaletteCommand[] = useMemo(
    () => recents.slice(0, 10).map((r) => ({
      id: `recent:${r.value}`,
      label: r.label,
      hint: r.hint,
      group: 'Recents' as const,
      icon: r.grade ? <RecentGradeMini grade={r.grade} /> : null,
      onSelect: () => {
        // Recents row → fill the active picker via custom event.
        // Hosting page (Report Card) listens and runs analysis.
        window.dispatchEvent(
          new CustomEvent('repoguru:palette-pick-repo', { detail: { value: r.value } }),
        );
      },
    })),
    [recents],
  );

  const wrap = (cmd: Omit<PaletteCommand, 'group'>, group: PaletteCommand['group']): PaletteCommand =>
    ({ ...cmd, group });

  // Close after every selection — feels like Linear's palette.
  const runAndClose = (cb: () => void) => () => {
    cb();
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <Command
        loop
        label="Command palette"
        className="relative w-full max-w-xl rounded-xl border border-border bg-surface-alt shadow-2xl overflow-hidden"
      >
        <Command.Input
          placeholder="Search recents, tools, settings…"
          className="w-full px-4 py-3 bg-transparent text-text placeholder:text-text-muted border-b border-border focus:outline-none text-sm"
          autoFocus
        />
        <Command.List className="max-h-[60vh] overflow-y-auto p-1.5">
          <Command.Empty className="px-3 py-6 text-sm text-text-muted text-center">
            No matches.
          </Command.Empty>

          {recentCommands.length > 0 && (
            <Command.Group heading="Recents" className="text-xs text-text-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider">
              {recentCommands.map((c) => (
                <PaletteRow key={c.id} cmd={c} onSelect={runAndClose(c.onSelect)} />
              ))}
            </Command.Group>
          )}

          <Command.Group heading="Tools" className="text-xs text-text-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider">
            {tools.map((t) => {
              const cmd = wrap(t, 'Tools');
              return <PaletteRow key={cmd.id} cmd={cmd} onSelect={runAndClose(cmd.onSelect)} />;
            })}
          </Command.Group>

          {actions.length > 0 && (
            <Command.Group heading="Actions" className="text-xs text-text-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider">
              {actions.map((a) => {
                const cmd = wrap(a, 'Actions');
                return <PaletteRow key={cmd.id} cmd={cmd} onSelect={runAndClose(cmd.onSelect)} />;
              })}
            </Command.Group>
          )}
        </Command.List>
        <div className="flex items-center justify-between px-3 py-2 border-t border-border text-[11px] text-text-muted">
          <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> to navigate · <Kbd>↵</Kbd> select · <Kbd>Esc</Kbd> close</span>
          <span><Kbd>⌘K</Kbd> toggle</span>
        </div>
      </Command>
    </div>
  );
}

function PaletteRow({ cmd, onSelect }: { cmd: PaletteCommand; onSelect: () => void }) {
  return (
    <Command.Item
      value={`${cmd.group} ${cmd.label} ${cmd.hint ?? ''}`}
      onSelect={onSelect}
      className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-text-secondary cursor-pointer aria-selected:bg-surface-hover aria-selected:text-text"
    >
      {cmd.icon && <span className="h-4 w-4 shrink-0 inline-flex items-center justify-center">{cmd.icon}</span>}
      <span className="flex-1 truncate">{cmd.label}</span>
      {cmd.hint && <span className="text-xs text-text-muted truncate">{cmd.hint}</span>}
      {cmd.shortcut && <Kbd>{cmd.shortcut}</Kbd>}
    </Command.Item>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 rounded bg-surface text-[10px] border border-border text-text-secondary font-mono">
      {children}
    </kbd>
  );
}

function RecentGradeMini({ grade }: { grade: 'A' | 'B' | 'C' | 'D' | 'F' }) {
  const colorClass = {
    A: 'bg-grade-a/15 text-grade-a',
    B: 'bg-grade-b/15 text-grade-b',
    C: 'bg-grade-c/15 text-grade-c',
    D: 'bg-grade-d/15 text-grade-d',
    F: 'bg-grade-f/15 text-grade-f',
  }[grade];
  return (
    <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold ${colorClass}`}>
      {grade}
    </span>
  );
}

function isInTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    target.isContentEditable
  );
}
