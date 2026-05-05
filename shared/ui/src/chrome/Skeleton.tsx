import type { HTMLAttributes } from 'react';

/** A pulsing placeholder block used to fill content-shaped gaps while
 *  data is loading. Adopted from shadcn/ui's Skeleton primitive.
 *  Consumers compose this into chart-shaped, card-shaped, or row-shaped
 *  layouts so the pre-render frame visually hints at what's coming
 *  rather than showing a generic spinner. */
export function Skeleton({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-surface-hover ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
}
