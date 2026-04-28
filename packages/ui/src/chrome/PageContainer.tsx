import type { ReactNode } from 'react';

export interface PageContainerProps {
  children: ReactNode;
}

/** Outer container used by every page in the in-browser app. The desktop
 *  uses the same wrapper so each page renders with identical padding,
 *  max-width, and vertical rhythm. */
export function PageContainer({ children }: PageContainerProps) {
  return <div className="w-full px-8 lg:px-12 xl:px-16 py-10">{children}</div>;
}
