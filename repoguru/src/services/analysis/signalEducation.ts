import type { SignalEducation } from '../../types';

/**
 * Educational content for every signal across all 8 categories.
 * Keyed by signal name (matching the `Signal.name` field from analyzers).
 */
export const SIGNAL_EDUCATION: Record<string, SignalEducation> = {
  // ── Documentation ──
  'README exists': {
    name: 'README exists',
    category: 'documentation',
    why: 'The README is the front page of your project. Without one, visitors have no way to understand what your project does or how to use it.',
    howToFix:
      'Create a README.md at the repository root with a description, installation instructions, and usage examples.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=README.md',
    learnMoreUrl:
      'https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes',
  },
  'Substantial README (>500 chars)': {
    name: 'Substantial README (>500 chars)',
    category: 'documentation',
    why: 'A very short README leaves users guessing. A thorough README with sections for installation, usage, and configuration significantly improves adoption.',
    howToFix:
      'Expand your README with sections: Description, Installation, Usage, Configuration, Contributing, and License.',
  },
  'README has sections': {
    name: 'README has sections',
    category: 'documentation',
    why: 'Section headers make long documents scannable. Users can jump to the part they need without reading everything.',
    howToFix:
      'Add markdown headers (## Section Name) for key sections like Installation, Usage, API, and Contributing.',
  },
  'Code examples in README': {
    name: 'Code examples in README',
    category: 'documentation',
    why: 'Code examples let developers quickly evaluate whether your project fits their needs and how to integrate it.',
    howToFix:
      'Add fenced code blocks (```language) with common usage patterns and expected output.',
  },
  'CONTRIBUTING.md': {
    name: 'CONTRIBUTING.md',
    category: 'documentation',
    why: 'A contribution guide lowers the barrier for new contributors and ensures consistent code quality across pull requests.',
    howToFix:
      'Create a CONTRIBUTING.md with development setup instructions, coding standards, and PR guidelines.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=CONTRIBUTING.md',
  },
  CHANGELOG: {
    name: 'CHANGELOG',
    category: 'documentation',
    why: 'A changelog helps users understand what changed between versions, making upgrades less risky and more predictable.',
    howToFix: 'Create a CHANGELOG.md following the Keep a Changelog format (keepachangelog.com).',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=CHANGELOG.md',
    learnMoreUrl: 'https://keepachangelog.com/',
  },
  'docs/ directory': {
    name: 'docs/ directory',
    category: 'documentation',
    why: 'A dedicated docs directory signals that the project has documentation beyond the README, which is important for larger projects.',
    howToFix:
      'Create a docs/ directory with additional guides, API references, or architecture decisions.',
  },

  // ── Security ──
  'SECURITY.md': {
    name: 'SECURITY.md',
    category: 'security',
    why: 'A security policy tells researchers how to responsibly disclose vulnerabilities instead of opening public issues.',
    howToFix:
      'Create a SECURITY.md with your vulnerability reporting process, expected response time, and supported versions.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=SECURITY.md',
    learnMoreUrl:
      'https://docs.github.com/en/code-security/getting-started/adding-a-security-policy-to-your-repository',
  },
  CODEOWNERS: {
    name: 'CODEOWNERS',
    category: 'security',
    why: 'CODEOWNERS ensures that the right people review changes to critical paths, reducing the chance of unauthorized or accidental modifications.',
    howToFix:
      'Create a CODEOWNERS file mapping directories and file patterns to responsible teams or individuals.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=.github/CODEOWNERS',
    learnMoreUrl:
      'https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners',
  },
  'Dependabot configured': {
    name: 'Dependabot configured',
    category: 'security',
    why: 'Dependabot automatically opens PRs to update vulnerable dependencies, keeping your project secure without manual effort.',
    howToFix:
      'Create .github/dependabot.yml specifying your package ecosystems and update schedule.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=.github/dependabot.yml',
    learnMoreUrl:
      'https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file',
  },
  'CodeQL / security scanning': {
    name: 'CodeQL / security scanning',
    category: 'security',
    why: 'Automated security scanning catches vulnerabilities like SQL injection and XSS before they reach production.',
    howToFix: 'Enable CodeQL via GitHub Actions by adding a codeql-analysis.yml workflow.',
    fixUrl:
      'https://github.com/{owner}/{repo}/new/{branch}?filename=.github/workflows/codeql-analysis.yml',
    learnMoreUrl:
      'https://docs.github.com/en/code-security/code-scanning/automatically-scanning-your-code-for-vulnerabilities-and-errors/about-code-scanning',
  },
  'PR-triggered workflows': {
    name: 'PR-triggered workflows',
    category: 'security',
    why: 'Running checks on pull requests prevents broken or insecure code from being merged into the main branch.',
    howToFix: 'Add pull_request as a trigger event in your GitHub Actions workflow YAML files.',
  },
  '.gitignore present': {
    name: '.gitignore present',
    category: 'security',
    why: 'A .gitignore prevents accidentally committing sensitive files like .env, credentials, and build artifacts.',
    howToFix:
      'Create a .gitignore file appropriate for your language/framework. GitHub provides templates at github.com/github/gitignore.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=.gitignore',
    learnMoreUrl: 'https://github.com/github/gitignore',
  },
  'No exposed secret files': {
    name: 'No exposed secret files',
    category: 'security',
    why: 'Committing .env files or credentials to version control exposes secrets to anyone with repository access.',
    howToFix:
      'Remove secret files from the repository, rotate any exposed credentials, and add them to .gitignore.',
  },

  // ── CI/CD ──
  'GitHub Actions workflows': {
    name: 'GitHub Actions workflows',
    category: 'cicd',
    why: 'CI/CD workflows automate testing, building, and deployment, ensuring consistent quality and faster delivery.',
    howToFix:
      'Create a .github/workflows/ directory with YAML workflow files for your CI/CD pipeline.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=.github/workflows/ci.yml',
    learnMoreUrl: 'https://docs.github.com/en/actions/quickstart',
  },
  'CI workflow (test/build)': {
    name: 'CI workflow (test/build)',
    category: 'cicd',
    why: 'A CI workflow that runs tests and builds on every push catches regressions early, before they affect users.',
    howToFix:
      'Add a workflow that triggers on push and pull_request events and runs your test suite.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=.github/workflows/ci.yml',
  },
  'Deploy / release workflow': {
    name: 'Deploy / release workflow',
    category: 'cicd',
    why: 'Automated deployments reduce human error and ensure releases go through the same validated process every time.',
    howToFix:
      'Create a workflow that triggers on tag push or release events to automate deployment.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=.github/workflows/release.yml',
  },
  'PR-triggered checks': {
    name: 'PR-triggered checks',
    category: 'cicd',
    why: 'Running checks on pull requests gives reviewers confidence that proposed changes do not break existing functionality.',
    howToFix: 'Add pull_request to the on: trigger in your CI workflow file.',
  },
  Dockerfile: {
    name: 'Dockerfile',
    category: 'cicd',
    why: 'A Dockerfile ensures the application runs consistently across different environments and simplifies deployment.',
    howToFix: 'Create a Dockerfile with a multi-stage build for your application.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=Dockerfile',
  },
  'Docker Compose': {
    name: 'Docker Compose',
    category: 'cicd',
    why: 'Docker Compose simplifies running multi-service applications locally, improving the developer experience.',
    howToFix:
      'Create a docker-compose.yml defining your application services, databases, and other dependencies.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=docker-compose.yml',
  },
  Makefile: {
    name: 'Makefile',
    category: 'cicd',
    why: 'A Makefile provides standardized commands (make build, make test) that work the same way for every developer.',
    howToFix: 'Create a Makefile with common targets: build, test, lint, clean, and run.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=Makefile',
  },

  // ── Dependencies ──
  'Dependency manifest': {
    name: 'Dependency manifest',
    category: 'dependencies',
    why: 'A manifest file (package.json, Cargo.toml, etc.) declares your dependencies explicitly so they can be reproducibly installed.',
    howToFix:
      'Initialize your project with the appropriate package manager (npm init, cargo init, go mod init, etc.).',
  },
  'Lockfile present': {
    name: 'Lockfile present',
    category: 'dependencies',
    why: 'Lockfiles pin exact dependency versions so every developer and CI system uses the same versions, preventing "works on my machine" issues.',
    howToFix:
      'Run your package manager install command to generate a lockfile, then commit it to the repository.',
  },
  'Dependencies tracked': {
    name: 'Dependencies tracked',
    category: 'dependencies',
    why: 'Tracking dependencies ensures they are explicitly declared and can be audited for vulnerabilities.',
    howToFix:
      'List all runtime and development dependencies in your manifest file instead of relying on global installs.',
  },
  'Reasonable dependency count': {
    name: 'Reasonable dependency count',
    category: 'dependencies',
    why: 'A bloated dependency tree increases attack surface, slows installs, and makes auditing harder.',
    howToFix:
      'Audit your dependencies periodically. Remove unused packages and consider lighter alternatives for heavy ones.',
  },

  // ── Code Quality ──
  'Linter configured': {
    name: 'Linter configured',
    category: 'codeQuality',
    why: 'Linters catch bugs, style issues, and anti-patterns automatically, enforcing consistent code quality across the team.',
    howToFix:
      'Add a linter config file (e.g., .eslintrc.json for JavaScript, .pylintrc for Python) and run it in CI.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=.eslintrc.json',
  },
  'Formatter configured': {
    name: 'Formatter configured',
    category: 'codeQuality',
    why: 'Formatters eliminate style debates by automatically enforcing consistent code formatting across all files.',
    howToFix:
      'Add a formatter config (e.g., .prettierrc for Prettier, rustfmt.toml for Rust) and integrate it with your editor and CI.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=.prettierrc',
  },
  'Type system': {
    name: 'Type system',
    category: 'codeQuality',
    why: 'Static typing catches type errors at compile time, improving code reliability and enabling better IDE support.',
    howToFix:
      'Add TypeScript (tsconfig.json) for JavaScript projects, or use type hints for Python projects.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=tsconfig.json',
  },
  'Git hooks': {
    name: 'Git hooks',
    category: 'codeQuality',
    why: 'Git hooks run checks before commits or pushes, catching issues locally before they reach CI.',
    howToFix: 'Set up Husky (npm), pre-commit (Python), or Lefthook for git hook management.',
  },
  'Tests present': {
    name: 'Tests present',
    category: 'codeQuality',
    why: 'Tests verify that your code works as intended and prevent regressions when making changes.',
    howToFix:
      'Create a test/ or __tests__/ directory and add unit tests using your language testing framework (Jest, pytest, go test, etc.).',
  },
  'CI runs tests': {
    name: 'CI runs tests',
    category: 'codeQuality',
    why: 'Running tests in CI ensures that all contributions are validated automatically, preventing broken code from being merged.',
    howToFix: 'Add a test step to your CI workflow (e.g., npm test, pytest, cargo test).',
  },
  EditorConfig: {
    name: 'EditorConfig',
    category: 'codeQuality',
    why: 'EditorConfig ensures consistent whitespace, line endings, and encoding across all editors and IDEs.',
    howToFix:
      'Create a .editorconfig file specifying indent style, indent size, and end-of-line preferences.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=.editorconfig',
    learnMoreUrl: 'https://editorconfig.org/',
  },

  // ── License ──
  'License file exists': {
    name: 'License file exists',
    category: 'license',
    why: 'Without a license, your code is under exclusive copyright by default and others cannot legally use, modify, or distribute it.',
    howToFix:
      'Add a LICENSE file. Use choosealicense.com to select the right license for your project.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=LICENSE',
    learnMoreUrl: 'https://choosealicense.com/',
  },
  'SPDX license detected': {
    name: 'SPDX license detected',
    category: 'license',
    why: 'SPDX detection means GitHub can identify your license, making it visible to users evaluating your project.',
    howToFix:
      'Use a standard license text (MIT, Apache-2.0, etc.) so GitHub can automatically detect and display it.',
  },
  'Permissive license': {
    name: 'Permissive license',
    category: 'license',
    why: 'Permissive licenses (MIT, Apache-2.0, BSD) allow maximum reuse, encouraging adoption in both open-source and commercial projects.',
    howToFix:
      'Consider using MIT or Apache-2.0 if you want broad adoption with minimal restrictions.',
  },
  'Copyleft license': {
    name: 'Copyleft license',
    category: 'license',
    why: 'Copyleft licenses (GPL, AGPL) ensure derivative works remain open source, which may limit commercial adoption but protects freedom.',
    howToFix:
      'This is informational. Copyleft is a valid choice if you want to ensure derivatives remain open source.',
  },

  // ── Community ──
  'Issue templates': {
    name: 'Issue templates',
    category: 'community',
    why: 'Issue templates guide reporters to provide the information maintainers need, reducing back-and-forth and improving triage.',
    howToFix:
      'Create .github/ISSUE_TEMPLATE/ directory with templates for bug reports and feature requests.',
    fixUrl:
      'https://github.com/{owner}/{repo}/new/{branch}?filename=.github/ISSUE_TEMPLATE/bug_report.md',
  },
  'PR template': {
    name: 'PR template',
    category: 'community',
    why: 'A PR template ensures contributors describe their changes, link related issues, and confirm testing before review.',
    howToFix:
      'Create .github/PULL_REQUEST_TEMPLATE.md with sections for description, related issues, and testing.',
    fixUrl:
      'https://github.com/{owner}/{repo}/new/{branch}?filename=.github/PULL_REQUEST_TEMPLATE.md',
  },
  'Code of Conduct': {
    name: 'Code of Conduct',
    category: 'community',
    why: 'A code of conduct sets behavior expectations and makes the community welcoming for underrepresented groups.',
    howToFix:
      'Adopt the Contributor Covenant or a similar code of conduct and place it as CODE_OF_CONDUCT.md.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=CODE_OF_CONDUCT.md',
    learnMoreUrl: 'https://www.contributor-covenant.org/',
  },
  'Funding configuration': {
    name: 'Funding configuration',
    category: 'community',
    why: 'A funding configuration enables the "Sponsor" button on GitHub, helping maintainers receive financial support.',
    howToFix:
      'Create .github/FUNDING.yml listing your funding platforms (GitHub Sponsors, Open Collective, etc.).',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=.github/FUNDING.yml',
    learnMoreUrl:
      'https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/displaying-a-sponsor-button-in-your-repository',
  },
  'SUPPORT.md': {
    name: 'SUPPORT.md',
    category: 'community',
    why: 'A SUPPORT.md file directs users to the right channels for help, reducing noise in the issue tracker.',
    howToFix:
      'Create a SUPPORT.md (or .github/SUPPORT.md) listing where users can get help: forums, Discord, Stack Overflow, etc.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=.github/SUPPORT.md',
  },

  // ── OpenSSF ──
  'Token permissions': {
    name: 'Token permissions',
    category: 'openssf',
    why: 'Restricting workflow token permissions limits the blast radius if a workflow is compromised. The default GITHUB_TOKEN has broad write access.',
    howToFix:
      'Add a top-level `permissions: read-all` block to each workflow file and grant write scopes only to jobs that need them.',
    learnMoreUrl:
      'https://docs.github.com/en/actions/security-guides/automatic-token-authentication#modifying-the-permissions-for-the-github_token',
  },
  'Pinned dependencies': {
    name: 'Pinned dependencies',
    category: 'openssf',
    why: 'Pinning GitHub Actions to a full SHA prevents a compromised tag from injecting malicious code into your CI pipeline.',
    howToFix:
      'Replace tag references like `actions/checkout@v4` with the full commit SHA, e.g. `actions/checkout@<sha>`.',
    learnMoreUrl:
      'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-third-party-actions',
  },
  'No dangerous workflow patterns': {
    name: 'No dangerous workflow patterns',
    category: 'openssf',
    why: 'Using `pull_request_target` with a checkout of the PR head allows untrusted code to run with write permissions, enabling supply-chain attacks.',
    howToFix:
      'Avoid checking out PR head code in `pull_request_target` workflows. Use `pull_request` trigger instead, or limit operations to metadata-only.',
    learnMoreUrl: 'https://securitylab.github.com/research/github-actions-preventing-pwn-requests/',
  },
  'No binary artifacts': {
    name: 'No binary artifacts',
    category: 'openssf',
    why: 'Checked-in binaries cannot be code-reviewed and may contain backdoors. They also bloat the repository.',
    howToFix:
      'Remove binary files (.exe, .dll, .jar, .so, .class, .pyc) from the repository. Use a package registry or release artifacts instead.',
  },
  'SLSA / signed releases': {
    name: 'SLSA / signed releases',
    category: 'openssf',
    why: 'SLSA provenance and signed releases let consumers verify that artifacts were built from the expected source code through a trusted build process.',
    howToFix: 'Add a SLSA provenance generator or Sigstore cosign step to your release workflow.',
    learnMoreUrl: 'https://slsa.dev/get-started',
  },
  Fuzzing: {
    name: 'Fuzzing',
    category: 'openssf',
    why: 'Fuzz testing discovers edge-case bugs and security vulnerabilities by feeding random inputs to your code.',
    howToFix:
      'Add fuzz tests using a framework like go-fuzz, cargo-fuzz, or AFL. Consider enrolling in Google OSS-Fuzz for continuous fuzzing.',
    learnMoreUrl: 'https://google.github.io/oss-fuzz/',
  },
  'SBOM generation': {
    name: 'SBOM generation',
    category: 'openssf',
    why: 'A Software Bill of Materials (SBOM) lists all components in your software, enabling consumers to track vulnerabilities in their supply chain.',
    howToFix:
      'Add a CI step that generates an SBOM using Syft, CycloneDX, or the SPDX tools and attach it to releases.',
    learnMoreUrl: 'https://www.cisa.gov/sbom',
  },
  'Dependency update tool': {
    name: 'Dependency update tool',
    category: 'openssf',
    why: 'Automated dependency updates (Dependabot, Renovate) ensure you promptly receive patches for known vulnerabilities.',
    howToFix:
      'Enable Dependabot by adding .github/dependabot.yml, or add a renovate.json for Renovate.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=.github/dependabot.yml',
    learnMoreUrl: 'https://docs.github.com/en/code-security/dependabot/dependabot-version-updates',
  },
  'Security policy': {
    name: 'Security policy',
    category: 'openssf',
    why: 'A security policy tells researchers how to responsibly disclose vulnerabilities instead of opening public issues.',
    howToFix:
      'Create a SECURITY.md with your vulnerability reporting process and supported versions.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=SECURITY.md',
    learnMoreUrl:
      'https://docs.github.com/en/code-security/getting-started/adding-a-security-policy-to-your-repository',
  },
  'License detected': {
    name: 'License detected',
    category: 'openssf',
    why: 'Without a license file, the code is under exclusive copyright by default and cannot be legally reused.',
    howToFix:
      'Add a LICENSE file using a standard open source license. Use choosealicense.com to pick one.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=LICENSE',
    learnMoreUrl: 'https://choosealicense.com/',
  },

  // ── Additional cross-category signals ──
  'CONTRIBUTING.md exists': {
    name: 'CONTRIBUTING.md exists',
    category: 'community',
    why: 'A contribution guide lowers the barrier for new contributors by explaining the development workflow.',
    howToFix:
      'Create a CONTRIBUTING.md explaining how to set up the dev environment, run tests, and submit PRs.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=CONTRIBUTING.md',
  },
  'CONTRIBUTING.md is substantial (>200 chars)': {
    name: 'CONTRIBUTING.md is substantial (>200 chars)',
    category: 'community',
    why: 'A detailed contribution guide reduces friction and questions from new contributors.',
    howToFix:
      'Expand CONTRIBUTING.md with sections on environment setup, coding standards, testing, and the PR process.',
  },
  'Good first issue label in templates': {
    name: 'Good first issue label in templates',
    category: 'community',
    why: 'Good first issue labels help newcomers find approachable tasks, growing your contributor community.',
    howToFix:
      'Add a "good first issue" label option to your issue templates or tag existing simple issues with this label.',
  },
  'README has Contributing section': {
    name: 'README has Contributing section',
    category: 'documentation',
    why: 'A contributing section in the README signals that the project welcomes outside contributions.',
    howToFix:
      'Add a "## Contributing" section to your README linking to CONTRIBUTING.md or explaining the process inline.',
  },
  'Setup instructions in README': {
    name: 'Setup instructions in README',
    category: 'documentation',
    why: 'Without setup instructions, contributors cannot run the project locally, blocking them from making meaningful contributions.',
    howToFix:
      'Add a "## Getting Started" or "## Installation" section with step-by-step instructions.',
  },
};

/**
 * Returns a GitHub URL for creating the missing file that would satisfy the given signal.
 */
export function getFixUrl(
  owner: string,
  repo: string,
  branch: string,
  signalName: string,
): string | undefined {
  const education = SIGNAL_EDUCATION[signalName];
  if (!education?.fixUrl) return undefined;

  return education.fixUrl
    .replace('{owner}', encodeURIComponent(owner))
    .replace('{repo}', encodeURIComponent(repo))
    .replace('{branch}', encodeURIComponent(branch));
}
