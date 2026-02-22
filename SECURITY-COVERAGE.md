# Security Coverage — Attack Vector Matrix

RepoGuru is a client-side React SPA with no backend. This document maps every relevant attack vector to the tool(s) that detect it in CI.

| Attack Vector                               | Risk   | What's Checking                     | How                                                                                 |
| ------------------------------------------- | ------ | ----------------------------------- | ----------------------------------------------------------------------------------- |
| **DOM XSS (`innerHTML`, `document.write`)** | High   | `eslint-plugin-no-unsanitized`      | Lint error on `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`      |
| **XSS via user input rendering**            | High   | `sanitize.fuzz.test.ts`             | 10k property tests: `sanitizeText` never outputs `<script`, `javascript:`, `on*=`   |
| **HTML injection**                          | High   | `sanitize.fuzz.test.ts`             | 10k property tests: `escapeHtml` output never contains raw `<` or `>`               |
| **URL injection / repo input**              | High   | `parser.fuzz.test.ts`               | 10k property tests: `parseRepoUrl` never returns `<script`, `..`, `/` in owner/repo |
| **Taint flow (source-to-sink)**             | Medium | CodeQL, Semgrep                     | SAST dataflow analysis for JS/TS XSS patterns                                       |
| **Dependency vulnerabilities**              | High   | `npm audit`, Dependabot, dep-review | Known CVEs in transitive deps flagged on every PR/push                              |
| **Supply chain (malicious packages)**       | Medium | Dependency review action            | Blocks new deps with known advisories on PRs                                        |
| **License compliance**                      | Low    | `license-checker`                   | Blocks GPL/AGPL/SSPL deps                                                           |
| **Prototype pollution**                     | Medium | CodeQL, Semgrep, SonarCloud         | SAST rules for `__proto__`, `constructor.prototype`                                 |
| **Secrets in source**                       | Medium | CodeQL, Semgrep                     | Detects hardcoded tokens, API keys, passwords                                       |
| **OAuth token leakage**                     | Medium | Code design                         | Browser Credential API storage, no tokens in URLs/localStorage                      |
| **CORS proxy abuse**                        | Medium | Cloudflare Worker config            | Proxy only forwards to `github.com` origins                                         |
| **Code quality / bugs**                     | Medium | SonarCloud, TypeScript              | Quality gate + strict type checking catch logic errors                              |
| **Regex DoS (ReDoS)**                       | Low    | Semgrep, CodeQL                     | Rules for catastrophic backtracking patterns                                        |
| **Open redirect**                           | Low    | Not applicable                      | No server-side redirects, SPA is client-only                                        |
| **CSRF**                                    | None   | Not applicable                      | No backend, no state-changing server requests                                       |
| **SQL injection**                           | None   | Not applicable                      | No database                                                                         |
| **SSRF**                                    | None   | Not applicable                      | No server-side requests (CORS proxy is separate)                                    |
