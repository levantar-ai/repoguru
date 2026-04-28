import type { ButtonHTMLAttributes, ReactNode } from 'react';

type CommonProps = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode };

/** Neon-accented primary action button matching the in-browser app's
 *  primary CTA (gradient + glow). */
export function PrimaryButton({ className = '', children, ...rest }: CommonProps) {
  return (
    <button
      {...rest}
      className={`px-8 py-3 rounded-xl bg-neon/15 border border-neon/30 text-neon font-semibold hover:bg-neon/25 hover:border-neon/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed neon-glow ${className}`}
    >
      {children}
    </button>
  );
}

/** Outlined secondary button (Reset / Cancel / New). */
export function SecondaryButton({ className = '', children, ...rest }: CommonProps) {
  return (
    <button
      {...rest}
      className={`px-6 py-3 rounded-xl bg-surface-alt border border-border text-text-secondary font-medium hover:border-border-bright hover:text-text transition-all ${className}`}
    >
      {children}
    </button>
  );
}
