import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

export interface TooltipProps {
  /** The interactive element receiving focus / hover. */
  children: ReactNode;
  /** Tooltip body — short text or a small JSX fragment. */
  content: ReactNode;
  /** Side relative to the trigger. Defaults to 'top'. */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** ms before showing on hover. Radix default is 700ms; we tighten
   *  to 250ms for in-app use. */
  delayMs?: number;
  /** Optional asChild — pass true when the child is already an
   *  interactive element (button, anchor) so we don't wrap it in an
   *  extra trigger button. */
  asChild?: boolean;
}

/** Accessible tooltip primitive backed by Radix. Replaces the HTML
 *  `title="…"` attribute, which has no styling, no keyboard focus
 *  support, no delay control, and is dismissed too quickly to read.
 *
 *  Composition: a single TooltipProvider must wrap the app — exported
 *  separately as <TooltipProvider /> below, intended as a one-time
 *  mount near the App root. Individual <Tooltip /> instances are
 *  cheap. */
export function Tooltip({
  children,
  content,
  side = 'top',
  delayMs = 250,
  asChild = true,
}: TooltipProps) {
  return (
    <RadixTooltip.Root delayDuration={delayMs}>
      <RadixTooltip.Trigger asChild={asChild}>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="z-[200] max-w-xs rounded-md bg-surface border border-border px-2.5 py-1.5 text-xs text-text shadow-lg data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0"
        >
          {content}
          <RadixTooltip.Arrow className="fill-border" width={10} height={5} />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

/** Mount once near the app root. All <Tooltip/> instances inside this
 *  provider share its delay queue (so consecutive hovers show
 *  immediately rather than re-paying the full delay). */
export function TooltipProvider({
  children,
  delayMs = 250,
}: {
  children: ReactNode;
  delayMs?: number;
}) {
  return (
    <RadixTooltip.Provider delayDuration={delayMs} skipDelayDuration={150}>
      {children}
    </RadixTooltip.Provider>
  );
}
