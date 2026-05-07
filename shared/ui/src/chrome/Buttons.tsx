import type { ButtonHTMLAttributes, ReactNode } from 'react';

type CommonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

/** Primary action button — solid neon fill, dark text, no glow. The
 *  earlier 15%-tint + neon outline + glow read as a *secondary* button
 *  in every modern SaaS pattern (Linear, Stripe, Vercel) and lost the
 *  scoring/comparing CTAs to whatever else was on screen. Solid fills
 *  reserve the brand colour for unambiguous "do the thing" actions. */
export function PrimaryButton({ className = '', children, ...rest }: CommonProps) {
  return (
    <button
      {...rest}
      className={`px-6 py-2.5 rounded-lg bg-neon text-surface font-semibold hover:bg-neon/90 active:bg-neon/80 focus-visible:ring-2 focus-visible:ring-neon/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
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
