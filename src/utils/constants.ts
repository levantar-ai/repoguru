import type { CategoryKey } from '../types';

export const GITHUB_API_BASE = 'https://api.github.com';

export const CATEGORY_WEIGHTS: Record<CategoryKey, number> = {
  documentation: 0.15,
  security: 0.1,
  cicd: 0.15,
  dependencies: 0.15,
  codeQuality: 0.15,
  license: 0.1,
  community: 0.1,
  openssf: 0.1,
};

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  documentation: 'Documentation',
  security: 'Security',
  cicd: 'CI/CD',
  dependencies: 'Dependencies',
  codeQuality: 'Code Quality',
  license: 'License',
  community: 'Community',
  openssf: 'OpenSSF',
};

export const GRADE_THRESHOLDS = {
  A: 85,
  B: 70,
  C: 55,
  D: 40,
} as const;

export const GRADE_COLORS: Record<string, string> = {
  A: 'var(--color-grade-a)',
  B: 'var(--color-grade-b)',
  C: 'var(--color-grade-c)',
  D: 'var(--color-grade-d)',
  F: 'var(--color-grade-f)',
};

// Files we want to fetch for analysis — matched against the tree
export const TARGET_FILES: string[] = [
  'README.md',
  'README.rst',
  'readme.md',
  'CONTRIBUTING.md',
  'CHANGELOG.md',
  'CHANGES.md',
  'HISTORY.md',
  'LICENSE',
  'LICENSE.md',
  'LICENSE.txt',
  'SECURITY.md',
  'CODEOWNERS',
  '.github/CODEOWNERS',
  'CODE_OF_CONDUCT.md',
  '.github/CODE_OF_CONDUCT.md',
  '.github/FUNDING.yml',
  '.github/SUPPORT.md',
  '.github/dependabot.yml',
  '.github/dependabot.yaml',
  '.renovaterc',
  '.renovaterc.json',
  'renovate.json',
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.toml',
  'Cargo.lock',
  'go.mod',
  'go.sum',
  'requirements.txt',
  'Pipfile',
  'pyproject.toml',
  'setup.py',
  'setup.cfg',
  'Gemfile',
  'Gemfile.lock',
  'composer.json',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  '.eslintrc.json',
  '.eslintrc.js',
  '.eslintrc.yml',
  '.eslintrc',
  'eslint.config.js',
  'eslint.config.mjs',
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.js',
  'prettier.config.js',
  'tsconfig.json',
  '.editorconfig',
  '.pre-commit-config.yaml',
  '.husky/pre-commit',
  'Makefile',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  '.dockerignore',
];

// Glob-like prefixes to match workflow files
export const WORKFLOW_DIR = '.github/workflows/';
export const ISSUE_TEMPLATE_DIR = '.github/ISSUE_TEMPLATE/';
export const PR_TEMPLATE = '.github/PULL_REQUEST_TEMPLATE.md';
export const PR_TEMPLATE_ALT = '.github/pull_request_template.md';

export const FETCH_DELAY_MS = 100;
export const MAX_FILES_TO_FETCH = 25;

export const DEMO_REPOS = [
  {
    owner: 'facebook',
    repo: 'react',
    description: 'The library for web and native user interfaces',
  },
  {
    owner: 'expressjs',
    repo: 'express',
    description: 'Fast, unopinionated, minimalist web framework for Node.js',
  },
  {
    owner: 'kelseyhightower',
    repo: 'nocode',
    description: 'The best way to write secure and reliable applications',
  },
] as const;

export const IDB_NAME = 'repoguru';
export const IDB_VERSION = 1;
export const STORE_REPORTS = 'reports';
export const STORE_RECENT = 'recent';
export const STORE_SETTINGS = 'settings';
