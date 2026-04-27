/**
 * Boilerplate templates for commonly missing repository files.
 * Each entry provides a filename and default content that can be
 * used to create the file directly on GitHub or downloaded locally.
 */
export const TEMPLATES: Record<string, { filename: string; content: string }> = {
  'SECURITY.md': {
    filename: 'SECURITY.md',
    content: `# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

**Please do NOT open a public GitHub issue.**

Instead, send an email to [security@example.com](mailto:security@example.com) with:

- A description of the vulnerability
- Steps to reproduce the issue
- Any relevant logs or screenshots

### What to expect

- You will receive an acknowledgment within **48 hours**.
- We will investigate and provide an estimated timeline for a fix within **5 business days**.
- Once the vulnerability is fixed, we will publicly disclose it and credit you (unless you prefer otherwise).

Thank you for helping keep this project and its users safe!
`,
  },

  'CODE_OF_CONDUCT.md': {
    filename: 'CODE_OF_CONDUCT.md',
    content: `# Contributor Covenant Code of Conduct

## Our Pledge

We as members, contributors, and leaders pledge to make participation in our
community a harassment-free experience for everyone, regardless of age, body
size, visible or invisible disability, ethnicity, sex characteristics, gender
identity and expression, level of experience, education, socio-economic status,
nationality, personal appearance, race, religion, or sexual identity
and orientation.

## Our Standards

Examples of behavior that contributes to a positive environment:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

Examples of unacceptable behavior:

- The use of sexualized language or imagery and unwelcome sexual attention
- Trolling, insulting or derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Other conduct which could reasonably be considered inappropriate

## Enforcement Responsibilities

Community leaders are responsible for clarifying and enforcing our standards of
acceptable behavior and will take appropriate and fair corrective action in
response to any behavior that they deem inappropriate, threatening, offensive,
or harmful.

## Scope

This Code of Conduct applies within all community spaces, and also applies when
an individual is officially representing the community in public spaces.

## Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be
reported to the community leaders responsible for enforcement at
[INSERT CONTACT METHOD].

All complaints will be reviewed and investigated promptly and fairly.

## Attribution

This Code of Conduct is adapted from the [Contributor Covenant](https://www.contributor-covenant.org),
version 2.1, available at
[https://www.contributor-covenant.org/version/2/1/code_of_conduct.html](https://www.contributor-covenant.org/version/2/1/code_of_conduct.html).
`,
  },

  'CONTRIBUTING.md': {
    filename: 'CONTRIBUTING.md',
    content: `# Contributing

Thank you for your interest in contributing! We welcome contributions from everyone.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork locally:
   \`\`\`bash
   git clone https://github.com/YOUR_USERNAME/REPO_NAME.git
   cd REPO_NAME
   \`\`\`
3. **Install dependencies**:
   \`\`\`bash
   npm install
   \`\`\`
4. **Create a branch** for your changes:
   \`\`\`bash
   git checkout -b feature/your-feature-name
   \`\`\`

## Development Workflow

1. Make your changes
2. Run the test suite:
   \`\`\`bash
   npm test
   \`\`\`
3. Run the linter:
   \`\`\`bash
   npm run lint
   \`\`\`
4. Commit your changes following [Conventional Commits](https://www.conventionalcommits.org/):
   \`\`\`bash
   git commit -m "feat: add new feature"
   \`\`\`

## Submitting a Pull Request

1. Push your branch to your fork
2. Open a Pull Request against the \`main\` branch
3. Fill in the PR template with a description of your changes
4. Wait for a maintainer to review your PR

## Code Style

- Follow the existing code style and conventions
- Write clear, descriptive commit messages
- Add tests for new functionality
- Update documentation as needed

## Reporting Issues

- Use the [issue tracker](../../issues) to report bugs
- Use the bug report template when filing new issues
- Include steps to reproduce the issue

## Questions?

Feel free to open a [discussion](../../discussions) if you have questions about contributing.
`,
  },

  '.github/PULL_REQUEST_TEMPLATE.md': {
    filename: '.github/PULL_REQUEST_TEMPLATE.md',
    content: `## Description

<!-- Describe your changes in detail -->

## Related Issue

<!-- Link to the issue this PR addresses -->
Fixes #

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)

## Checklist

- [ ] My code follows the project's code style
- [ ] I have performed a self-review of my code
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing tests pass locally
- [ ] I have updated the documentation accordingly
- [ ] My changes generate no new warnings

## Screenshots (if applicable)

<!-- Add screenshots to help explain your changes -->
`,
  },

  '.github/ISSUE_TEMPLATE/bug_report.md': {
    filename: '.github/ISSUE_TEMPLATE/bug_report.md',
    content: `---
name: Bug Report
about: Create a report to help us improve
title: "[BUG] "
labels: bug
assignees: ''
---

## Describe the Bug

<!-- A clear and concise description of what the bug is. -->

## Steps to Reproduce

1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

## Expected Behavior

<!-- A clear and concise description of what you expected to happen. -->

## Actual Behavior

<!-- A clear and concise description of what actually happened. -->

## Screenshots

<!-- If applicable, add screenshots to help explain your problem. -->

## Environment

- OS: [e.g., macOS 14, Ubuntu 22.04]
- Browser: [e.g., Chrome 120, Firefox 121]
- Version: [e.g., v1.2.3]

## Additional Context

<!-- Add any other context about the problem here. -->
`,
  },

  '.github/FUNDING.yml': {
    filename: '.github/FUNDING.yml',
    content: `# These are supported funding model platforms
# Replace with your own usernames or URLs

github: # [your-github-username]
# patreon: # your-patreon-username
# open_collective: # your-open-collective-username
# ko_fi: # your-ko-fi-username
# tidelift: # npm/your-package-name
# community_bridge: # your-project-name
# liberapay: # your-liberapay-username
# issuehunt: # your-issuehunt-username
# custom: ["https://your-custom-link.com"]
`,
  },

  '.github/dependabot.yml': {
    filename: '.github/dependabot.yml',
    content: `# Dependabot configuration
# https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file

version: 2
updates:
  # Maintain dependencies for GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"

  # Maintain dependencies for npm
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    # Limit to 5 open PRs at a time
    open-pull-requests-limit: 5
`,
  },

  '.editorconfig': {
    filename: '.editorconfig',
    content: `# EditorConfig is a file format and collection of text editor plugins
# for maintaining consistent coding styles between different editors and IDEs.
# https://editorconfig.org

root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false

[*.{yml,yaml}]
indent_size = 2

[Makefile]
indent_style = tab
`,
  },
};
