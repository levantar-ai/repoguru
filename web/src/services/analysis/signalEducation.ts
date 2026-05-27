import type { SignalEducation } from '../../types';

/** Resolve a signal's `fixUrl` template (with {owner}/{repo}/{branch}
 *  placeholders) to a concrete URL — owners/repos/branches with spaces
 *  or slashes are URL-encoded. Returns null if the signal has no
 *  fixUrl or isn't in the map. */
export function getFixUrl(
  owner: string,
  repo: string,
  branch: string,
  signalName: string,
): string | null {
  const entry = SIGNAL_EDUCATION[signalName];
  if (!entry?.fixUrl) return null;
  return entry.fixUrl
    .replace('{owner}', encodeURIComponent(owner))
    .replace('{repo}', encodeURIComponent(repo))
    .replace('{branch}', encodeURIComponent(branch));
}

/**
 * Educational content for every signal across all 8 categories.
 * Keyed by signal name (matching the `Signal.name` field from analyzers).
 *
 * Style guide:
 *   - `why` explains the *outcome*, never the vendor. ("Outdated deps
 *     get a fix PR" — not "Dependabot opens a PR".)
 *   - `howToFix` lists at least two genuine alternatives where they
 *     exist, with copy-pasteable snippets. The aim is to be useful on
 *     GitHub *and* GitLab/Gitea/Bitbucket/self-hosted.
 *   - `fixUrl` is a GitHub deep-link template (best-effort UX shortcut).
 *     Repos elsewhere get the generic guidance and skip the button.
 *   - `learnMoreUrl` prefers vendor-neutral references where possible.
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
    learnMoreUrl: 'https://www.makeareadme.com/',
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
    why: 'A contribution guide lowers the barrier for new contributors and ensures consistent code quality across pull/merge requests.',
    howToFix:
      'Create CONTRIBUTING.md with development setup instructions, coding standards, and change-request guidelines.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=CONTRIBUTING.md',
  },
  CHANGELOG: {
    name: 'CHANGELOG',
    category: 'documentation',
    why: 'A changelog helps users understand what changed between versions, making upgrades less risky and more predictable.',
    howToFix:
      'Create CHANGELOG.md following the Keep a Changelog format, or generate one automatically with semantic-release, release-please, or changesets.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=CHANGELOG.md',
    learnMoreUrl: 'https://keepachangelog.com/',
  },
  'docs/ directory': {
    name: 'docs/ directory',
    category: 'documentation',
    why: 'A dedicated docs directory signals that the project has documentation beyond the README, which is important for larger projects.',
    howToFix:
      'Create a docs/ directory with additional guides, API references, or architecture decisions. Static-site generators like Docusaurus, MkDocs, VitePress, or Hugo can render it into a doc site.',
  },

  // ── Security ──
  'Security policy': {
    name: 'Security policy',
    category: 'security',
    why: 'A security policy tells researchers how to responsibly disclose vulnerabilities instead of opening public issues that tip off attackers.',
    howToFix:
      "Create SECURITY.md at the repo root (or in .github/) describing your reporting process, an expected response time, and supported versions. Include a private contact channel — a security email, a private form, or your platform's private advisory feature.",
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=SECURITY.md',
    learnMoreUrl: 'https://github.com/ossf/oss-vulnerability-guide',
  },
  'Code ownership': {
    name: 'Code ownership',
    category: 'security',
    why: 'A code-ownership file declares who reviews changes to which paths — preventing accidental merges to critical areas (auth, payments, infra) and making sure the right reviewers are auto-requested.',
    howToFix:
      'Create a CODEOWNERS file. The format is the same on GitHub, GitLab, Gitea and Bitbucket: one line per glob → owners. Example:\n\n  /src/auth/   @security-team\n  *.tf         @platform\n  /docs/       @docs-team\n\nPlace it at one of: CODEOWNERS, .github/CODEOWNERS, .gitlab/CODEOWNERS, or docs/CODEOWNERS.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=.github/CODEOWNERS',
    learnMoreUrl:
      'https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners',
  },
  'Automated dependency updates': {
    name: 'Automated dependency updates',
    category: 'security',
    why: 'Manual dependency upgrades drift. An automated tool opens PRs for new versions (especially security patches) so you stay current without remembering to.',
    howToFix:
      'Pick one (any one is fine):\n\n  • Dependabot — GitHub-native, zero install. Add .github/dependabot.yml with one entry per package ecosystem.\n  • Renovate — works on GitHub, GitLab, Gitea, Bitbucket. Install the app, add a renovate.json (or just enable for sensible defaults).\n  • Snyk — also opens fix PRs, plus vuln scanning.\n  • Mend (formerly WhiteSource) — enterprise alternative.\n\nMinimal dependabot.yml:\n\n  version: 2\n  updates:\n    - package-ecosystem: "npm"\n      directory: "/"\n      schedule: { interval: "weekly" }',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=.github/dependabot.yml',
    learnMoreUrl: 'https://docs.renovatebot.com/',
  },
  'Static security analysis': {
    name: 'Static security analysis',
    category: 'security',
    why: 'Static analysis (SAST) reads your source code on every change and flags security bugs — SQL injection, XSS, hard-coded secrets, unsafe deserialisation — before they reach production.',
    howToFix:
      "Wire one into CI:\n\n  • Semgrep — language-agnostic, free, easy to start. `semgrep --config auto` in CI.\n  • CodeQL — GitHub-native, free for public repos. Add the CodeQL workflow.\n  • Snyk Code, SonarCloud / SonarQube — SaaS options with richer dashboards.\n  • Language-specific: Bandit (Python), Brakeman (Rails), gosec (Go), eslint-plugin-security (JS).\n  • Infra-as-code: Checkov, tfsec, Trivy.\n\nUpload results as SARIF so they show up in your platform's security tab.",
    learnMoreUrl: 'https://owasp.org/www-community/Source_Code_Analysis_Tools',
  },
  'Source-control ignore file': {
    name: 'Source-control ignore file',
    category: 'security',
    why: "Without ignore rules it's easy to accidentally commit secrets, build artefacts, IDE files or node_modules — bloating history and leaking credentials.",
    howToFix:
      'Add .gitignore (or .hgignore for Mercurial) at the repo root. Use github.com/github/gitignore as a starting point — they have curated templates per language/framework. Add lines for: build output, node_modules / target / dist, .env files, IDE config (.vscode, .idea), OS files (.DS_Store).',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=.gitignore',
    learnMoreUrl: 'https://github.com/github/gitignore',
  },
  'No exposed secret files': {
    name: 'No exposed secret files',
    category: 'security',
    why: "Files named .env, credentials.json, secret.* in the tree are usually a mistake — and even if they're fake, they teach contributors a bad habit. Real secrets in history are extremely costly to remove.",
    howToFix:
      "Remove the file and rotate the secret immediately (assume it's compromised). Add a pattern to .gitignore so it can't come back. For history rewrite use git-filter-repo or BFG Repo-Cleaner. Going forward, run a secret scanner — gitleaks, trufflehog, or your platform's native scanning — as a pre-commit hook and in CI.",
    learnMoreUrl: 'https://github.com/gitleaks/gitleaks',
  },

  // ── CI/CD ──
  'Continuous integration': {
    name: 'Continuous integration',
    category: 'cicd',
    why: 'CI runs your tests, linters and build on every change. Without it, breakages reach main and ship to users before anyone notices.',
    howToFix:
      "Add a CI config for whichever platform you're on — they're all roughly equivalent:\n\n  • GitHub Actions — .github/workflows/ci.yml\n  • GitLab CI — .gitlab-ci.yml\n  • CircleCI — .circleci/config.yml\n  • Jenkins — Jenkinsfile\n  • Drone / Woodpecker — .drone.yml / .woodpecker.yml\n  • Buildkite — .buildkite/pipeline.yml\n\nMinimal jobs to start: install, lint, test, build. Add typecheck, security scan, and deploy as you grow.",
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=.github/workflows/ci.yml',
    learnMoreUrl: 'https://martinfowler.com/articles/continuousIntegration.html',
  },
  'Deployment automation': {
    name: 'Deployment automation',
    category: 'cicd',
    why: 'Manual deploys are slow, error-prone, and bottleneck on whoever knows the steps. A pipeline makes deploys reproducible, audited, and recoverable.',
    howToFix:
      'A deploy/release pipeline runs on tag, on main, or on manual trigger. Common patterns:\n\n  • Libraries — semantic-release, release-please, or changesets auto-publish to npm/PyPI/crates on merge.\n  • Apps — push container to registry → roll out via your platform (Kubernetes, Fly, Render, Cloudflare, Vercel, Netlify).\n  • Go binaries — GoReleaser builds + signs + uploads in one step.\n\nKeep deploy steps in version control next to your CI config; never run them from a laptop.',
    learnMoreUrl: 'https://martinfowler.com/bliki/ContinuousDelivery.html',
  },
  'Pre-merge checks': {
    name: 'Pre-merge checks',
    category: 'cicd',
    why: 'If CI only runs on main, broken PRs land. Pre-merge (per-PR) checks catch breakages while the author can still fix them — and let you enforce branch protection so merges are blocked until checks pass.',
    howToFix:
      "Configure your CI so it triggers on pull/merge requests:\n\n  • GitHub Actions — add `pull_request:` to the workflow `on:` trigger.\n  • GitLab CI — use `rules: - if: $CI_MERGE_REQUEST_IID` or `workflow.rules` with `merge_request_event`.\n  • CircleCI / Drone / Woodpecker / Buildkite — PR builds are usually on by default; verify they're not excluded.\n\nThen enable branch protection / merge-request approvals to require these checks before merge.",
    learnMoreUrl:
      'https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches',
  },
  'Container image build': {
    name: 'Container image build',
    category: 'cicd',
    why: "A container image makes your service deployable to any modern runtime without environment drift. It's also the foundation for SBOM, signing, and most cloud platforms.",
    howToFix:
      'Add a Dockerfile at the repo root. Use a minimal base image (distroless, Alpine, or scratch) and a multi-stage build so the final image only contains runtime artefacts. Pin the base image by digest, not tag, for reproducibility.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=Dockerfile',
    learnMoreUrl: 'https://docs.docker.com/develop/dev-best-practices/',
  },
  'Multi-service local dev': {
    name: 'Multi-service local dev',
    category: 'cicd',
    why: 'When a service depends on a DB, cache or other services, "works on my machine" diverges fast. A compose file gives every contributor the same local stack with one command.',
    howToFix:
      'Add docker-compose.yml (or compose.yaml) listing each service, its image, exposed ports, and volumes. Alternatives: a Tilt or Skaffold config for Kubernetes-style local dev, or devcontainers for editor-integrated dev environments.',
    learnMoreUrl: 'https://docs.docker.com/compose/',
  },
  'Build / task runner': {
    name: 'Build / task runner',
    category: 'cicd',
    why: "A consistent task entry point (`make test`, `task lint`, `just deploy`) means contributors don't have to remember per-language incantations and CI just calls the same commands.",
    howToFix:
      'Add one of:\n\n  • Make — Makefile, universal, every Unix has it.\n  • Task — Taskfile.yml, YAML-based, cross-platform.\n  • just — justfile, friendly Make replacement.\n  • Mage — mage.go, for Go-heavy projects.\n  • package.json scripts — for JS/TS projects, often enough on their own.\n\nAt minimum: `setup`, `lint`, `test`, `build`, `run`.',
  },

  // ── Community ──
  'Issue templates': {
    name: 'Issue templates',
    category: 'community',
    why: 'Templates ensure issue reports come in with the information you need to triage — version, reproduction, environment — instead of "it broke, fix it."',
    howToFix:
      'Create one template file per issue type:\n\n  • GitHub — .github/ISSUE_TEMPLATE/bug_report.md (or YAML forms).\n  • GitLab — .gitlab/issue_templates/Bug.md\n  • Gitea — .gitea/ISSUE_TEMPLATE/bug.md\n\nA bug template should ask for: what you expected, what happened, version, reproduction steps.',
    fixUrl:
      'https://github.com/{owner}/{repo}/new/{branch}?filename=.github/ISSUE_TEMPLATE/bug_report.md',
  },
  'Change-request template': {
    name: 'Change-request template',
    category: 'community',
    why: 'A PR/MR template prompts contributors to explain *what* they changed, *why*, and how reviewers should verify — making review faster and reducing back-and-forth.',
    howToFix:
      'Create the template file at one of:\n\n  • GitHub — .github/PULL_REQUEST_TEMPLATE.md\n  • GitLab — .gitlab/merge_request_templates/Default.md\n  • Gitea — .gitea/PULL_REQUEST_TEMPLATE.md\n\nGood sections: Summary, Motivation, Test plan, Screenshots (if UI), Breaking changes.',
    fixUrl:
      'https://github.com/{owner}/{repo}/new/{branch}?filename=.github/PULL_REQUEST_TEMPLATE.md',
  },
  'Code of Conduct': {
    name: 'Code of Conduct',
    category: 'community',
    why: 'A code of conduct sets expectations for behaviour in your project spaces (issues, PRs, chat) — protecting contributors and giving maintainers a clear basis for moderation.',
    howToFix:
      'Adopt an existing one rather than writing your own. The Contributor Covenant is the de-facto standard; adapt and place at CODE_OF_CONDUCT.md (or .github/CODE_OF_CONDUCT.md).',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=CODE_OF_CONDUCT.md',
    learnMoreUrl: 'https://www.contributor-covenant.org/',
  },
  'Contributing guide': {
    name: 'Contributing guide',
    category: 'community',
    why: 'New contributors need to know how to set up the project, what conventions you follow, and how to send a change. Without a guide, they bounce.',
    howToFix:
      'Create CONTRIBUTING.md (or .github/CONTRIBUTING.md) covering: setup steps, how to run tests, commit message conventions (Conventional Commits is a common pick), how to open a PR/MR, and what reviewers look for.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=CONTRIBUTING.md',
  },
  'Funding info': {
    name: 'Funding info',
    category: 'community',
    why: 'If your project is open source and unfunded, making the funding ask visible converts a small fraction of users into supporters — and keeps maintainers from burning out.',
    howToFix:
      'Pick one or more platforms and either add a config file or link in README:\n\n  • .github/FUNDING.yml — renders sponsor buttons on GitHub.\n  • .opencollective — links repo to an Open Collective.\n  • README links to GitHub Sponsors, Open Collective, Patreon, Liberapay, Ko-fi, Polar, Tidelift.\n  • For npm: add a `funding` field to package.json so `npm fund` surfaces it.\n\nMost projects pick 1–2 — too many is noise.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=.github/FUNDING.yml',
  },
  'Support channels': {
    name: 'Support channels',
    category: 'community',
    why: 'Users with usage questions clog the issue tracker if they have nowhere else to go. A clear pointer to discussions/chat keeps the issue tracker for actual bugs.',
    howToFix:
      'Create SUPPORT.md (or .github/SUPPORT.md) pointing to your preferred channel: GitHub Discussions, Discord, Slack, a community forum, Stack Overflow tag, or a paid support email if applicable.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=.github/SUPPORT.md',
  },

  // ── Dependencies ──
  'Dependency manifest': {
    name: 'Dependency manifest',
    category: 'dependencies',
    why: "A manifest declares what your code depends on. Without one, builds aren't reproducible and security tools can't scan for vulnerable versions.",
    howToFix:
      'Use the manifest for your ecosystem: package.json (npm/yarn/pnpm), Cargo.toml (Rust), go.mod (Go), requirements.txt / pyproject.toml / Pipfile (Python), Gemfile (Ruby), composer.json (PHP), pom.xml / build.gradle (Java/Kotlin).',
  },
  'Lockfile present': {
    name: 'Lockfile present',
    category: 'dependencies',
    why: 'A manifest declares ranges ("^1.2.0"); a lockfile pins the exact transitive tree. Without a lockfile, two installs of the same code can resolve different deps — the canonical "works on my machine" failure.',
    howToFix:
      'Commit your lockfile. npm → package-lock.json. yarn → yarn.lock. pnpm → pnpm-lock.yaml. Cargo → Cargo.lock (always commit for apps; optional for libraries). Go → go.sum. Bundler → Gemfile.lock. Composer → composer.lock.',
  },
  'Dependencies tracked': {
    name: 'Dependencies tracked',
    category: 'dependencies',
    why: 'Counting declared deps confirms the manifest is real, not empty.',
    howToFix: "Add the packages you actually use to your manifest (and remove ones you don't).",
  },
  'Reasonable dependency count': {
    name: 'Reasonable dependency count',
    category: 'dependencies',
    why: 'Every dependency is an attack surface, a supply-chain risk, and a future upgrade burden. Excessive deps (>200) often indicate sprawl, unused packages, or a "leftpad culture" that increases the chance of one going bad.',
    howToFix:
      "Audit your deps. Use `npm prune`, `cargo machete`, `depcheck`, or your ecosystem's equivalent to find unused ones. For small utility deps, consider whether a few lines of code would be safer than a transitive sub-tree.",
  },

  // ── Code Quality ──
  'Linter configured': {
    name: 'Linter configured',
    category: 'codeQuality',
    why: 'A linter catches mistakes (unused vars, missing returns, async-without-await) before they reach review or runtime. It also enforces team conventions automatically.',
    howToFix:
      'Pick one for your language and commit its config:\n\n  • JS/TS — ESLint or Biome (faster, no plugins).\n  • Python — Ruff (fast, replaces Flake8/Pylint/isort) or Flake8.\n  • Rust — Clippy (`cargo clippy`).\n  • Go — golangci-lint (bundles ~50 linters).\n  • Ruby — RuboCop.\n  • Shell — ShellCheck.\n\nRun it in CI and as a pre-commit hook.',
    learnMoreUrl: 'https://github.com/caramelomartins/awesome-linters',
  },
  'Formatter configured': {
    name: 'Formatter configured',
    category: 'codeQuality',
    why: 'A formatter ends every "your braces are wrong" review nit. Commit one config; nobody argues about style again.',
    howToFix:
      '  • JS/TS/JSON/MD — Prettier or Biome.\n  • Python — Black or Ruff format.\n  • Rust — rustfmt (built into cargo).\n  • Go — gofmt / goimports (built into the toolchain).\n  • C/C++ — clang-format.\n  • Cross-language — EditorConfig handles indentation/line endings across editors.\n\nRun on save in your editor and in CI/pre-commit so unformatted code never lands.',
  },
  'Type system': {
    name: 'Type system',
    category: 'codeQuality',
    why: 'Types catch a class of bugs at edit time that tests never will. They also act as machine-checked documentation that stays in sync with the code.',
    howToFix:
      "If you're on a language with optional typing, opt in:\n\n  • JavaScript — migrate to TypeScript, or add JSDoc types + tsc --checkJs.\n  • Python — add type hints + mypy or pyright. Try `--strict` once the codebase is stable.\n  • Ruby — Sorbet or RBS.\n  • PHP — declare(strict_types=1) + PHPStan or Psalm.\n\nRun the checker in CI.",
  },
  'Git hooks': {
    name: 'Git hooks',
    category: 'codeQuality',
    why: 'Hooks run linters/formatters/tests before commit (or pre-push), catching issues locally instead of waiting for CI to fail.',
    howToFix:
      'Use a hook manager so hooks come with the repo, not personal config:\n\n  • Husky — popular for JS/TS projects (npm install --save-dev husky).\n  • pre-commit — Python, but works for any language; .pre-commit-config.yaml.\n  • Lefthook — fast, language-agnostic, no node dependency.\n\nMinimum useful hook: run formatter + linter on staged files (lint-staged for Husky, native filtering for the others).',
    learnMoreUrl: 'https://pre-commit.com/',
  },
  'Tests present': {
    name: 'Tests present',
    category: 'codeQuality',
    why: 'Tests prove the code does what you think it does — and catch regressions when you change it. A codebase without tests gets harder to change every week.',
    howToFix:
      'Pick the canonical framework for your language and commit at least a smoke test:\n\n  • JS/TS — Vitest, Jest, Node test runner, Playwright (e2e).\n  • Python — pytest.\n  • Rust — `#[test]` blocks, cargo test.\n  • Go — testing package, _test.go files.\n  • Ruby — RSpec, Minitest.\n\nWire tests into CI so they run on every change.',
  },
  'CI runs tests': {
    name: 'CI runs tests',
    category: 'codeQuality',
    why: "Tests that don't run in CI are tests that quietly break. CI is the only guarantee they're executed on every change.",
    howToFix:
      'In your CI config, add a step that runs your test command (`npm test`, `pytest`, `cargo test`, `go test ./...`, `bundle exec rspec`). Make the job required for merge so failing tests block.',
  },
  EditorConfig: {
    name: 'EditorConfig',
    category: 'codeQuality',
    why: 'EditorConfig settings (indent, line endings, trim whitespace) are respected by every major editor automatically — preventing "mixed tabs and spaces" diffs.',
    howToFix:
      'Add .editorconfig at the repo root. A minimal example:\n\n  root = true\n  [*]\n  indent_style = space\n  indent_size = 2\n  end_of_line = lf\n  charset = utf-8\n  trim_trailing_whitespace = true\n  insert_final_newline = true',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=.editorconfig',
    learnMoreUrl: 'https://editorconfig.org/',
  },

  // ── License ──
  'License file exists': {
    name: 'License file exists',
    category: 'license',
    why: 'Without a license, your code is "all rights reserved" by default — meaning nobody can legally use, copy or distribute it. Even other open-source projects can\'t depend on you.',
    howToFix:
      'Pick a license at choosealicense.com and add it as LICENSE (or LICENSE.md/LICENSE.txt) at the repo root. Common picks: MIT (permissive), Apache-2.0 (permissive + patent grant), GPL-3.0 (copyleft).',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=LICENSE',
    learnMoreUrl: 'https://choosealicense.com/',
  },
  'SPDX license detected': {
    name: 'SPDX license detected',
    category: 'license',
    why: 'SPDX identifiers are the standardised machine-readable license IDs (MIT, Apache-2.0, GPL-3.0…) that legal-review tools, package managers, and SBOM generators all rely on.',
    howToFix:
      'Use the full text of a recognised license — most platforms auto-detect it and assign the SPDX ID. Avoid custom or modified licenses; they confuse downstream tooling. Add the SPDX expression to package.json / Cargo.toml / pyproject.toml for explicit declaration.',
    learnMoreUrl: 'https://spdx.org/licenses/',
  },
  'Permissive license': {
    name: 'Permissive license',
    category: 'license',
    why: 'Permissive licenses (MIT, Apache-2.0, BSD, ISC) let users — including commercial users — do almost anything with your code. They maximise adoption.',
    howToFix:
      'Switch to MIT, Apache-2.0, BSD-3-Clause, or ISC if maximum reach matters. (Note: this is a project decision, not a flaw — copyleft licenses are valid choices for different goals.)',
    learnMoreUrl: 'https://choosealicense.com/permissive/',
  },
  'Copyleft license': {
    name: 'Copyleft license',
    category: 'license',
    why: 'Copyleft (GPL family, MPL) requires derivative works to also be open-source. Useful for ensuring contributions flow back; restrictive for commercial integrators.',
    howToFix:
      'If you want commercial users, consider Apache-2.0 instead. If you want strong copyleft for a library, MPL-2.0 is more file-scoped than GPL-3.0. (This is a choice, not necessarily a problem.)',
  },

  // ── OpenSSF ──
  'Hardened CI permissions': {
    name: 'Hardened CI permissions',
    category: 'openssf',
    why: 'By default, GitHub Actions tokens have broad write access. A malicious action — or a compromised one — can use them to push code, publish releases, or leak secrets. Explicit permissions block that.',
    howToFix:
      'In each workflow file, add a top-level `permissions:` block. Start with `permissions: read-all` and grant the minimum each job needs:\n\n  permissions:\n    contents: read\n    pull-requests: write   # only if you need it\n\nFor non-GitHub-Actions setups, the equivalent is restricting CI runner roles (least-privilege IAM, scoped tokens).',
    learnMoreUrl: 'https://docs.github.com/en/actions/using-jobs/assigning-permissions-to-jobs',
  },
  'Pinned CI dependencies': {
    name: 'Pinned CI dependencies',
    category: 'openssf',
    why: 'Pinning to a tag (@v3) lets the upstream maintainer (or an attacker who compromises them) ship new code under that same tag. Pinning to a full commit SHA freezes exactly what runs.',
    howToFix:
      'For GitHub Actions, replace `uses: actions/checkout@v4` with `uses: actions/checkout@<40-char-sha>  # v4.1.1`. Renovate/Dependabot can auto-update SHAs.\n\nFor other CI: pin Docker base images by digest, pin tool versions in setup actions, avoid `latest` tags.',
    learnMoreUrl:
      'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-third-party-actions',
  },
  'No untrusted-PR-checkout patterns': {
    name: 'No untrusted-PR-checkout patterns',
    category: 'openssf',
    why: '`pull_request_target` runs with write permissions but is often combined with checking out untrusted PR code — letting a hostile contributor steal secrets the moment their PR is opened.',
    howToFix:
      'Avoid the combination of `pull_request_target` + `actions/checkout` of `github.event.pull_request.head.*`. If you must check out PR code, either use the regular `pull_request` trigger (no write access), or split the job: gather untrusted code in a sandbox, post results back from a separate job.',
    learnMoreUrl: 'https://securitylab.github.com/research/github-actions-preventing-pwn-requests/',
  },
  'No binary artifacts in tree': {
    name: 'No binary artifacts in tree',
    category: 'openssf',
    why: "Binary artefacts (.jar, .so, .exe, .pyc) checked into the repo can't be reviewed and may hide malicious code. They also bloat clones.",
    howToFix:
      'Remove binaries from the tree. Build them in CI from source. If you need to distribute them, attach them to releases (every platform supports this). Add their patterns to .gitignore.',
  },
  'Signed releases': {
    name: 'Signed releases',
    category: 'openssf',
    why: 'Signed releases let consumers verify the artefact really came from you (not a typo-squatter or a compromised mirror). Provenance attestations go further: they prove which exact source built which exact artefact.',
    howToFix:
      'Pick one or layer them:\n\n  • SLSA provenance — slsa-framework/slsa-github-generator for GitHub-built artefacts.\n  • Sigstore / cosign — keyless signing for containers and arbitrary blobs.\n  • npm provenance — `npm publish --provenance` for npm packages.\n  • GPG-signed git tags — `git tag -s vX.Y.Z`, then verify with `git tag -v`.\n  • GoReleaser has signing built in for Go binaries.',
    learnMoreUrl: 'https://slsa.dev/',
  },
  Fuzzing: {
    name: 'Fuzzing',
    category: 'openssf',
    why: 'Fuzzers generate millions of random inputs to find crashes and security bugs that hand-written tests miss. Especially valuable for parsers, deserialisers, and anything that handles untrusted input.',
    howToFix:
      "  • OSS-Fuzz — Google's free service for open-source projects. Submit a project.yaml.\n  • Rust — cargo-fuzz (libFuzzer-based).\n  • Go — built-in `go test -fuzz`.\n  • Python — Atheris.\n  • C/C++ — libFuzzer or AFL++.\n\nStart by fuzzing the entry points that touch untrusted input.",
    learnMoreUrl: 'https://github.com/google/oss-fuzz',
  },
  'Software bill of materials': {
    name: 'Software bill of materials',
    category: 'openssf',
    why: 'An SBOM lists every component (direct and transitive) in your build. When the next Log4Shell happens, you can answer "are we affected?" in seconds instead of days.',
    howToFix:
      'Generate one in CI and attach to releases:\n\n  • Syft — `syft <image-or-dir> -o cyclonedx-json`. Works on source, binaries, containers.\n  • Trivy — `trivy fs --format cyclonedx`.\n  • CycloneDX language plugins — `cdxgen`, `cyclonedx-bom` (npm/Python/Java).\n\nUse CycloneDX or SPDX format — both are widely supported.',
    learnMoreUrl: 'https://cyclonedx.org/',
  },
  'License declared': {
    name: 'License declared',
    category: 'openssf',
    why: "OpenSSF Scorecard counts the presence of a license as a baseline trust signal — downstream users need to know they're legally allowed to use the code.",
    howToFix: 'See "License file exists" — add a LICENSE file at the repo root.',
    fixUrl: 'https://github.com/{owner}/{repo}/new/{branch}?filename=LICENSE',
  },
};
