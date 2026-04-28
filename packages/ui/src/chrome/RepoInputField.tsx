import type { ReactNode } from 'react';

export interface RepoInputFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Submit on Enter — host wires this. */
  onSubmit?: () => void;
  /** Optional picker / browse-button rendered below the input. The host
   *  injects it because picker semantics differ (browser: GitHub repo
   *  search, desktop: filesystem picker). */
  picker?: ReactNode;
}

/** Single labelled repo input with the in-browser app's input styling.
 *  Both hosts use this so the form chrome (label, padding, focus ring)
 *  is identical. */
export function RepoInputField({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  onSubmit,
  picker,
}: RepoInputFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-1.5">
        {label}
      </label>
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
        className="w-full px-4 py-3 rounded-xl bg-surface-alt border border-border text-text placeholder-text-muted focus:outline-none focus:border-border-bright focus:ring-1 focus:ring-border-bright transition-colors disabled:opacity-50"
      />
      {!disabled && picker}
    </div>
  );
}
