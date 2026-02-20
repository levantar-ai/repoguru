# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in RepoGuru, please report it responsibly.

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please send an email to **security@repoguru.dev** with:

- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Any suggested fixes (optional)

## Response Timeline

- **Acknowledgment**: Within 48 hours of report
- **Initial Assessment**: Within 5 business days
- **Resolution Target**: Within 30 days for critical issues

## Supported Versions

| Version | Supported |
| ------- | --------- |
| Latest  | Yes       |

## Scope

The following are in scope for security reports:

- Cross-site scripting (XSS) vulnerabilities
- Client-side injection attacks
- Sensitive data exposure (tokens, credentials)
- Dependencies with known vulnerabilities
- Authentication/authorization bypasses

The following are **out of scope**:

- Rate limiting issues with the GitHub API (this is GitHub's responsibility)
- Issues in third-party dependencies (report upstream, but let us know)
- Social engineering attacks

## Security Measures

RepoGuru implements the following security practices:

- All analysis runs client-side in the browser
- GitHub tokens are stored using the Credential Management API with IndexedDB fallback
- No server-side data collection or storage
- Automated dependency scanning via Dependabot
- Static analysis via CodeQL and Semgrep
- Content Security Policy headers on deployment
