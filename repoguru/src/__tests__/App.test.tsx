import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// --- Mocks: external dependencies ---

vi.mock('../utils/analytics', () => ({
  trackPageView: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock('../utils/oauth', () => ({
  handleOAuthCallback: vi.fn().mockResolvedValue(null),
}));

vi.mock('../services/persistence/credentials', () => ({
  saveGithubToken: vi.fn(),
  loadGithubToken: vi.fn().mockResolvedValue(''),
}));

vi.mock('../services/persistence/settingsStore', () => ({
  loadSettings: vi.fn().mockResolvedValue({ theme: 'dark', llmMode: 'off' }),
  saveSettings: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/persistence/repoCache', () => ({
  loadRecentRepos: vi.fn().mockResolvedValue([]),
  saveRecentRepo: vi.fn().mockResolvedValue(undefined),
}));

// --- Mocks: Layout, SettingsPanel, LoadingScreen ---

vi.mock('../components/layout/Layout', () => ({
  Layout: ({
    children,
    onNavigate,
  }: {
    children: React.ReactNode;
    onNavigate: (p: string) => void;
  }) => (
    <div>
      <nav>
        <button onClick={() => onNavigate('home')}>nav-home</button>
        <button onClick={() => onNavigate('docs')}>nav-docs</button>
        <button onClick={() => onNavigate('org-scan')}>nav-org-scan</button>
        <button onClick={() => onNavigate('compare')}>nav-compare</button>
        <button onClick={() => onNavigate('portfolio')}>nav-portfolio</button>
        <button onClick={() => onNavigate('discover')}>nav-discover</button>
        <button onClick={() => onNavigate('policy')}>nav-policy</button>
        <button onClick={() => onNavigate('git-stats')}>nav-git-stats</button>
        <button onClick={() => onNavigate('tech-detect')}>nav-tech-detect</button>
      </nav>
      {children}
    </div>
  ),
}));

vi.mock('../components/settings/SettingsPanel', () => ({
  SettingsPanel: () => null,
}));

vi.mock('../components/common/LoadingScreen', () => ({
  LoadingScreen: () => <div>Loading...</div>,
}));

// --- Mocks: Page components ---

vi.mock('../pages/HomePage', () => ({
  HomePage: () => <div data-testid="home-page">Home</div>,
}));

vi.mock('../pages/HowItWorksPage', () => ({
  HowItWorksPage: () => <div data-testid="docs-page">Docs</div>,
}));

vi.mock('../pages/OrgScanPage', () => ({
  OrgScanPage: () => <div data-testid="org-scan-page">Org Scan</div>,
}));

vi.mock('../pages/ComparePage', () => ({
  ComparePage: () => <div data-testid="compare-page">Compare</div>,
}));

vi.mock('../pages/PortfolioPage', () => ({
  PortfolioPage: () => <div data-testid="portfolio-page">Portfolio</div>,
}));

vi.mock('../pages/DiscoverPage', () => ({
  DiscoverPage: () => <div data-testid="discover-page">Discover</div>,
}));

vi.mock('../pages/PolicyPage', () => ({
  PolicyPage: () => <div data-testid="policy-page">Policy</div>,
}));

vi.mock('../pages/GitStatsPage', () => ({
  GitStatsPage: () => <div data-testid="git-stats-page">Git Stats</div>,
}));

vi.mock('../pages/TechDetectPage', () => ({
  TechDetectPage: () => <div data-testid="tech-detect-page">Tech Detect</div>,
}));

// --- Import App after mocks ---

import App from '../App';

// Helper: get the wrapper div around a page component
function getPageWrapper(testId: string): HTMLElement {
  return screen.getByTestId(testId).parentElement!;
}

describe('App page navigation and state preservation', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure no OAuth code param is set
    vi.stubGlobal('location', { ...window.location, search: '' });
  });

  it('renders HomePage on initial load', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });
  });

  it('does not mount unvisited lazy pages', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('docs-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('org-scan-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('compare-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('portfolio-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('discover-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('policy-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('git-stats-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tech-detect-page')).not.toBeInTheDocument();
  });

  it('home page wrapper is visible on initial load', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });
    expect(getPageWrapper('home-page').style.display).toBe('');
  });

  it('mounts and shows a page on first navigation', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });

    await user.click(screen.getByText('nav-org-scan'));

    await waitFor(() => {
      expect(screen.getByTestId('org-scan-page')).toBeInTheDocument();
    });
    expect(getPageWrapper('org-scan-page').style.display).toBe('');
    expect(getPageWrapper('home-page').style.display).toBe('none');
  });

  it('keeps a visited page mounted when navigating away', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });

    // Visit org-scan
    await user.click(screen.getByText('nav-org-scan'));
    await waitFor(() => {
      expect(screen.getByTestId('org-scan-page')).toBeInTheDocument();
    });

    // Navigate back to home
    await user.click(screen.getByText('nav-home'));
    await waitFor(() => {
      expect(getPageWrapper('home-page').style.display).toBe('');
    });

    // org-scan is still in the DOM, just hidden
    expect(screen.getByTestId('org-scan-page')).toBeInTheDocument();
    expect(getPageWrapper('org-scan-page').style.display).toBe('none');
  });

  it('re-shows a previously visited page without remounting', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });

    // Visit org-scan, then home, then org-scan again
    await user.click(screen.getByText('nav-org-scan'));
    await waitFor(() => {
      expect(screen.getByTestId('org-scan-page')).toBeInTheDocument();
    });

    await user.click(screen.getByText('nav-home'));
    await user.click(screen.getByText('nav-org-scan'));

    await waitFor(() => {
      expect(getPageWrapper('org-scan-page').style.display).toBe('');
    });
    expect(getPageWrapper('home-page').style.display).toBe('none');
  });

  it('supports navigating across multiple pages', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });

    // Visit docs
    await user.click(screen.getByText('nav-docs'));
    await waitFor(() => {
      expect(screen.getByTestId('docs-page')).toBeInTheDocument();
    });

    // Visit compare
    await user.click(screen.getByText('nav-compare'));
    await waitFor(() => {
      expect(screen.getByTestId('compare-page')).toBeInTheDocument();
    });

    // All three are in the DOM
    expect(screen.getByTestId('home-page')).toBeInTheDocument();
    expect(screen.getByTestId('docs-page')).toBeInTheDocument();
    expect(screen.getByTestId('compare-page')).toBeInTheDocument();

    // Only compare is visible
    expect(getPageWrapper('compare-page').style.display).toBe('');
    expect(getPageWrapper('home-page').style.display).toBe('none');
    expect(getPageWrapper('docs-page').style.display).toBe('none');
  });

  it.each([
    ['docs', 'nav-docs', 'docs-page'],
    ['portfolio', 'nav-portfolio', 'portfolio-page'],
    ['discover', 'nav-discover', 'discover-page'],
    ['policy', 'nav-policy', 'policy-page'],
    ['git-stats', 'nav-git-stats', 'git-stats-page'],
    ['tech-detect', 'nav-tech-detect', 'tech-detect-page'],
  ] as const)('navigating to %s mounts and shows it', async (_page, navBtn, testId) => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });

    await user.click(screen.getByText(navBtn));

    await waitFor(() => {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    });
    expect(getPageWrapper(testId).style.display).toBe('');
  });
});
