import type { CategoryResult, FileContent, TreeEntry, Signal } from '../../types';

// Maps config file paths to human-readable tool names
const LINTER_FILES: Record<string, string> = {
  '.eslintrc.json': 'ESLint',
  '.eslintrc.js': 'ESLint',
  '.eslintrc.yml': 'ESLint',
  '.eslintrc': 'ESLint',
  'eslint.config.js': 'ESLint',
  'eslint.config.mjs': 'ESLint',
  '.flake8': 'Flake8',
  '.pylintrc': 'Pylint',
  'clippy.toml': 'Clippy',
  '.rubocop.yml': 'RuboCop',
  '.golangci.yml': 'golangci-lint',
  'biome.json': 'Biome',
  'deno.json': 'Deno',
};

const FORMATTER_FILES: Record<string, string> = {
  '.prettierrc': 'Prettier',
  '.prettierrc.json': 'Prettier',
  '.prettierrc.js': 'Prettier',
  'prettier.config.js': 'Prettier',
  '.prettierrc.yaml': 'Prettier',
  'rustfmt.toml': 'rustfmt',
  '.clang-format': 'clang-format',
  'biome.json': 'Biome',
  '.editorconfig': 'EditorConfig',
};

const TEST_DIR_NAMES = ['test', 'tests', '__tests__', 'spec', 'src/test', 'src/__tests__'];

const TEST_FILE_PATTERNS = [
  { regex: /\.test\.[jt]sx?$/, label: 'JS/TS test files' },
  { regex: /\.spec\.[jt]sx?$/, label: 'JS/TS spec files' },
  { regex: /_test\.go$/, label: 'Go test files' },
  { regex: /_test\.rs$/, label: 'Rust test files' },
  { regex: /test_.*\.py$/, label: 'Python test files' },
  { regex: /_spec\.rb$/, label: 'Ruby spec files' },
];

const CI_TEST_COMMANDS: Record<string, string> = {
  'npm test': 'npm test',
  'npm run test': 'npm run test',
  'yarn test': 'yarn test',
  'pnpm test': 'pnpm test',
  pytest: 'pytest',
  'cargo test': 'cargo test',
  'go test': 'go test',
  jest: 'Jest',
  vitest: 'Vitest',
  'make test': 'make test',
  'bundle exec rspec': 'RSpec',
  phpunit: 'PHPUnit',
};

function findMatchingFile(
  paths: Set<string> | Map<string, FileContent>,
  lookup: Record<string, string>,
): string | null {
  for (const [file, name] of Object.entries(lookup)) {
    if (paths.has(file)) return name;
  }
  return null;
}

function detectHookTool(fileMap: Map<string, FileContent>, treePaths: Set<string>): string | null {
  if (
    fileMap.has('.husky/pre-commit') ||
    treePaths.has('.husky/pre-commit') ||
    treePaths.has('.husky')
  ) {
    return 'Husky';
  }
  if (fileMap.has('.pre-commit-config.yaml') || treePaths.has('.pre-commit-config.yaml')) {
    return 'pre-commit';
  }
  if (treePaths.has('.lefthook.yml') || treePaths.has('lefthook.yml')) {
    return 'Lefthook';
  }
  return null;
}

function detectTests(tree: TreeEntry[]): { found: boolean; details: string | undefined } {
  const testDirs = TEST_DIR_NAMES.filter((d) =>
    tree.some((e) => e.type === 'tree' && e.path === d),
  );

  let testFileCount = 0;
  let testFileType = '';
  for (const { regex, label } of TEST_FILE_PATTERNS) {
    const matches = tree.filter((e) => e.type === 'blob' && regex.test(e.path));
    if (matches.length > 0) {
      testFileCount += matches.length;
      if (!testFileType) testFileType = label;
    }
  }

  const found = testDirs.length > 0 || testFileCount > 0;
  let details: string | undefined;
  if (testFileCount > 0) {
    details = `${testFileCount} test files found (${testFileType})`;
  } else if (testDirs.length > 0) {
    details = `${testDirs.join(', ')} directory`;
  }
  return { found, details };
}

function detectCiTests(files: FileContent[]): string | null {
  for (const f of files) {
    if (!f.path.startsWith('.github/workflows/')) continue;
    for (const [pattern, label] of Object.entries(CI_TEST_COMMANDS)) {
      if (f.content.includes(pattern)) return label;
    }
  }
  return null;
}

export function analyzeCodeQuality(files: FileContent[], tree: TreeEntry[]): CategoryResult {
  const signals: Signal[] = [];
  const fileMap = new Map(files.map((f) => [f.path, f]));
  const treePaths = new Set(tree.map((e) => e.path));

  const linterName =
    findMatchingFile(fileMap, LINTER_FILES) || findMatchingFile(treePaths, LINTER_FILES);
  signals.push({
    name: 'Linter configured',
    found: !!linterName,
    details: linterName || undefined,
  });

  const formatterName =
    findMatchingFile(fileMap, FORMATTER_FILES) || findMatchingFile(treePaths, FORMATTER_FILES);
  signals.push({
    name: 'Formatter configured',
    found: !!formatterName,
    details: formatterName || undefined,
  });

  const hasTypeScript = fileMap.has('tsconfig.json') || treePaths.has('tsconfig.json');
  signals.push({
    name: 'Type system',
    found: hasTypeScript,
    details: hasTypeScript ? 'TypeScript' : undefined,
  });

  const hookTool = detectHookTool(fileMap, treePaths);
  signals.push({ name: 'Git hooks', found: !!hookTool, details: hookTool || undefined });

  const tests = detectTests(tree);
  signals.push({ name: 'Tests present', found: tests.found, details: tests.details });

  const ciTestCmd = detectCiTests(files);
  signals.push({
    name: 'CI runs tests',
    found: !!ciTestCmd,
    details: ciTestCmd ? `via ${ciTestCmd}` : undefined,
  });

  const hasEditorConfig = fileMap.has('.editorconfig') || treePaths.has('.editorconfig');
  signals.push({ name: 'EditorConfig', found: hasEditorConfig });

  let score = 0;
  if (linterName) score += 20;
  if (formatterName) score += 15;
  if (hasTypeScript) score += 15;
  if (hasEditorConfig) score += 10;
  if (hookTool) score += 10;
  if (tests.found) score += 20;
  if (ciTestCmd) score += 10;

  return {
    key: 'codeQuality',
    label: 'Code Quality',
    score: Math.min(100, score),
    weight: 0.15,
    signals,
  };
}
