import type { DetectorInput, DetectionResult } from './types';

/** Detects a static security-analysis (SAST) tool of any kind. The
 *  outcome we care about: "someone is scanning the source for security
 *  bugs on every change", regardless of which scanner. */

/** Config-file presence is a reliable, content-free signal. */
const SAST_CONFIG_FILES: Array<{ tool: string; paths: string[] }> = [
  // Generic — all forges
  {
    tool: 'Semgrep',
    paths: ['.semgrep.yml', '.semgrep.yaml', 'semgrep.yml', '.semgrepignore', '.semgrep/'],
  },
  { tool: 'SonarQube / SonarCloud', paths: ['sonar-project.properties', '.sonarcloud.properties'] },
  { tool: 'Snyk', paths: ['.snyk'] },
  { tool: 'Bandit', paths: ['.bandit', 'bandit.yaml', '.bandit.yaml'] },
  { tool: 'Brakeman', paths: ['config/brakeman.yml', '.brakeman.yml'] },
  { tool: 'Checkov', paths: ['.checkov.yml', '.checkov.yaml'] },
  { tool: 'Trivy', paths: ['trivy.yaml', '.trivyignore'] },
  { tool: 'tfsec', paths: ['.tfsec/'] },
  { tool: 'KICS', paths: ['.kics.config'] },
];

/** Content keywords that appear in CI workflow files when these tools
 *  are wired up. Used when we have file contents (full engine only). */
const SAST_WORKFLOW_KEYWORDS: Array<{ tool: string; pattern: RegExp }> = [
  { tool: 'CodeQL', pattern: /\bgithub\/codeql-action|codeql-analysis|CodeQL\b/ },
  { tool: 'Semgrep', pattern: /\breturntocorp\/semgrep-action|semgrep ci\b/i },
  { tool: 'Snyk', pattern: /\bsnyk\/actions|snyk test\b/i },
  { tool: 'SonarQube / SonarCloud', pattern: /\bsonarsource\/sonarcloud|sonarqube-scan\b/i },
  { tool: 'Trivy', pattern: /\baquasecurity\/trivy-action|trivy fs|trivy image\b/i },
  { tool: 'Checkov', pattern: /\bbridgecrewio\/checkov-action|checkov -d\b/i },
  { tool: 'Bandit', pattern: /\bbandit -r|bandit ci\b/i },
  { tool: 'Brakeman', pattern: /\bbrakeman\b/i },
  { tool: 'gosec', pattern: /\bsecurego\/gosec|gosec \.\.\./i },
  { tool: 'ESLint security plugins', pattern: /\beslint-plugin-security\b/ },
  { tool: 'SARIF upload', pattern: /\bgithub\/codeql-action\/upload-sarif\b/ },
];

export function detectSAST(input: DetectorInput): DetectionResult {
  const tools = new Set<string>();

  for (const { tool, paths } of SAST_CONFIG_FILES) {
    if (
      paths.some(
        (p) =>
          input.treePaths.has(p) ||
          (p.endsWith('/') && input.tree.some((e) => e.path.startsWith(p))),
      )
    ) {
      tools.add(tool);
    }
  }

  // CodeQL — typically a workflow file at .github/workflows/codeql*.yml
  if (input.tree.some((e) => e.type === 'blob' && /\.github\/workflows\/.*codeql/i.test(e.path))) {
    tools.add('CodeQL');
  }

  if (input.files.length > 0) {
    for (const f of input.files) {
      if (!f.path.startsWith('.github/workflows/') && !f.path.startsWith('.gitlab-ci')) continue;
      for (const { tool, pattern } of SAST_WORKFLOW_KEYWORDS) {
        if (pattern.test(f.content)) tools.add(tool);
      }
    }
  }

  return { found: tools.size > 0, tools: Array.from(tools) };
}
