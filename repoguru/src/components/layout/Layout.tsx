import type { ReactNode } from 'react';
import type { PageId } from '../../types';
import { Header } from './Header';
import { Footer } from './Footer';

interface Props {
  children: ReactNode;
  onNavigate: (page: PageId) => void;
  currentPage: string;
}

export function Layout({ children, onNavigate, currentPage }: Props) {
  return (
    <div className="min-h-screen flex flex-col bg-surface text-text bg-gradient-dark">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Header onNavigate={onNavigate} currentPage={currentPage} />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
