import { useState } from 'react';
import { useRepoGuru } from '../services/Provider.js';
import type { RepoPickerProps } from '../services/types.js';

/** Shared repo picker rendered identically by every host. Only the data
 *  the picker shows differs:
 *   - Browser: services.repoBrowse.browse() opens the GitHub repo picker
 *     (or auth flow). recents() returns the user's recent GitHub repos.
 *   - Desktop: services.repoBrowse.browse() opens Electron's native folder
 *     picker. recents() returns recent local paths.
 *  The chrome (label, input, Browse button, recent chips, hint line) is
 *  rendered from this single React file in both hosts. */
export function RepoPicker({
  label,
  value,
  onChange,
  onSubmit,
  disabled,
  inputId,
  placeholder = 'owner/repo or /path/to/repo',
}: RepoPickerProps) {
  const { repoBrowse } = useRepoGuru();
  const [browsing, setBrowsing] = useState(false);
  const recents = repoBrowse.recents();
  const id = inputId ?? `repo-${label.replace(/\s+/g, '-').toLowerCase()}`;

  const handleBrowse = async () => {
    if (browsing) return;
    setBrowsing(true);
    try {
      const picked = await repoBrowse.browse();
      if (picked) onChange(picked);
    } finally {
      setBrowsing(false);
    }
  };

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-1.5">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSubmit) onSubmit();
          }}
          className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-surface-alt border border-border text-text placeholder-text-muted focus:outline-none focus:border-border-bright focus:ring-1 focus:ring-border-bright transition-colors disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleBrowse}
          disabled={disabled || browsing}
          className="px-4 py-3 rounded-xl bg-surface-alt border border-border text-text-secondary hover:text-neon hover:border-neon/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2 whitespace-nowrap"
          title="Browse"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          Browse
        </button>
      </div>

      {repoBrowse.hint && (
        <p className="mt-1.5 text-xs text-text-muted">{repoBrowse.hint}</p>
      )}

      {!disabled && recents.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {recents.slice(0, 6).map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => onChange(s.value)}
              title={s.hint ?? s.value}
              className="px-2.5 py-1 rounded-lg text-xs bg-surface-alt border border-border text-text-secondary hover:text-neon hover:border-neon/30 transition-all max-w-[260px] truncate"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
