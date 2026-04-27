import type {
  FileContent,
  TreeEntry,
  RepoInfo,
  ContributorFriendliness,
  Signal,
  ChecklistItem,
} from '../../types';
import { ISSUE_TEMPLATE_DIR, PR_TEMPLATE, PR_TEMPLATE_ALT } from '../../utils/constants';

/**
 * Analyzes how contributor-friendly a repository is.
 * Returns a score (0-100), signals, and a readiness checklist.
 */
export function analyzeContributorFriendliness(
  files: FileContent[],
  tree: TreeEntry[],
  _repoInfo: RepoInfo, // eslint-disable-line @typescript-eslint/no-unused-vars -- kept for API compatibility
): ContributorFriendliness {
  const signals: Signal[] = [];
  const fileMap = new Map(files.map((f) => [f.path, f]));
  const treePaths = new Set(tree.map((e) => e.path));

  // 1. CONTRIBUTING.md exists + quality
  const contributing = fileMap.get('CONTRIBUTING.md');
  const contributingExists = !!contributing || treePaths.has('CONTRIBUTING.md');
  const contributingQuality = (contributing?.content.length ?? 0) > 200;
  signals.push({
    name: 'CONTRIBUTING.md exists',
    found: contributingExists,
  });
  signals.push({
    name: 'CONTRIBUTING.md is substantial (>200 chars)',
    found: contributingQuality,
    details: contributing ? `${contributing.content.length} characters` : undefined,
  });

  // 2. Issue templates
  const issueTemplates = tree.filter(
    (e) => e.type === 'blob' && e.path.startsWith(ISSUE_TEMPLATE_DIR),
  );
  const issueTemplateCount = issueTemplates.length;
  signals.push({
    name: 'Issue templates',
    found: issueTemplateCount > 0,
    details: `${issueTemplateCount} template(s)`,
  });

  // 3. PR template
  const hasPRTemplate =
    treePaths.has(PR_TEMPLATE) ||
    treePaths.has(PR_TEMPLATE_ALT) ||
    treePaths.has('.github/PULL_REQUEST_TEMPLATE.md') ||
    treePaths.has('PULL_REQUEST_TEMPLATE.md');
  signals.push({ name: 'PR template', found: hasPRTemplate });

  // 4. Code of Conduct
  const hasCOC =
    fileMap.has('CODE_OF_CONDUCT.md') ||
    fileMap.has('.github/CODE_OF_CONDUCT.md') ||
    treePaths.has('CODE_OF_CONDUCT.md') ||
    treePaths.has('.github/CODE_OF_CONDUCT.md');
  signals.push({ name: 'Code of Conduct', found: hasCOC });

  // 5. Good first issue mentioned in templates
  const hasGoodFirstIssue = files.some(
    (f) =>
      f.path.startsWith(ISSUE_TEMPLATE_DIR) &&
      (f.content.toLowerCase().includes('good first issue') ||
        f.content.toLowerCase().includes('good-first-issue')),
  );
  signals.push({ name: 'Good first issue label in templates', found: hasGoodFirstIssue });

  // 6. README has "Contributing" section
  const readme = fileMap.get('README.md') || fileMap.get('readme.md') || fileMap.get('README.rst');
  const hasContributingSection = /^#{1,3}\s+contribut/im.test(readme?.content ?? '');
  signals.push({ name: 'README has Contributing section', found: hasContributingSection });

  // 7. Setup instructions in README
  const readmeContent = readme?.content ?? '';
  const hasSetupInstructions = /^#{1,3}\s+(install|setup|getting\s+started)/im.test(readmeContent);
  signals.push({ name: 'Setup instructions in README', found: hasSetupInstructions });

  // 8. Funding configured
  const hasFunding = fileMap.has('.github/FUNDING.yml') || treePaths.has('.github/FUNDING.yml');
  signals.push({ name: 'Funding configured', found: hasFunding });

  // 9. SUPPORT.md exists
  const hasSupport =
    fileMap.has('.github/SUPPORT.md') ||
    fileMap.has('SUPPORT.md') ||
    treePaths.has('.github/SUPPORT.md') ||
    treePaths.has('SUPPORT.md');
  signals.push({ name: 'SUPPORT.md', found: hasSupport });

  // Calculate score
  let score = 0;
  if (contributingExists) score += 12;
  if (contributingQuality) score += 8;
  if (issueTemplateCount > 0) score += 12;
  if (issueTemplateCount >= 2) score += 5;
  if (hasPRTemplate) score += 12;
  if (hasCOC) score += 10;
  if (hasGoodFirstIssue) score += 8;
  if (hasContributingSection) score += 8;
  if (hasSetupInstructions) score += 10;
  if (hasFunding) score += 7;
  if (hasSupport) score += 8;

  // Build readiness checklist
  const readinessChecklist: ChecklistItem[] = [
    {
      label: 'Contribution guide',
      passed: contributingExists,
      description: 'A CONTRIBUTING.md file explaining how to contribute to the project',
    },
    {
      label: 'Issue templates',
      passed: issueTemplateCount > 0,
      description:
        'Structured issue templates in .github/ISSUE_TEMPLATE/ for bug reports and feature requests',
    },
    {
      label: 'PR template',
      passed: hasPRTemplate,
      description: 'A pull request template that guides contributors through the PR process',
    },
    {
      label: 'Code of conduct',
      passed: hasCOC,
      description: 'A CODE_OF_CONDUCT.md that sets expectations for community behavior',
    },
    {
      label: 'Setup instructions',
      passed: hasSetupInstructions,
      description:
        'Clear instructions in the README for installing and running the project locally',
    },
    {
      label: 'Contributing section in README',
      passed: hasContributingSection,
      description: 'A section in the README that introduces contributors to the project workflow',
    },
    {
      label: 'Good first issue labels',
      passed: hasGoodFirstIssue,
      description: 'Issue templates or labels that help newcomers find beginner-friendly tasks',
    },
    {
      label: 'Support resources',
      passed: hasSupport,
      description: 'A SUPPORT.md file directing users to help channels (forums, chat, etc.)',
    },
    {
      label: 'Funding information',
      passed: hasFunding,
      description: 'A .github/FUNDING.yml file enabling sponsor buttons on the repository',
    },
  ];

  return {
    score: Math.min(100, score),
    signals,
    readinessChecklist,
  };
}
