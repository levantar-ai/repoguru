import type { AnalysisReport, FileContent, TreeEntry, RepoInfo, ParsedRepo } from '../../types';
import { analyzeDocumentation } from './documentationAnalyzer';
import { analyzeSecurity } from './securityAnalyzer';
import { analyzeCicd } from './cicdAnalyzer';
import { analyzeDependencies } from './dependenciesAnalyzer';
import { analyzeCodeQuality } from './codeQualityAnalyzer';
import { analyzeLicense } from './licenseAnalyzer';
import { analyzeCommunity } from './communityAnalyzer';
import { analyzeOpenssf } from './openssfAnalyzer';
import { analyzeContributorFriendliness } from './contributorAnalyzer';
import {
  computeOverallScore,
  computeGrade,
  generateStrengths,
  generateRisks,
  generateNextSteps,
} from './scoring';
import { generateMermaidDiagram } from './repoStructure';

export function runAnalysis(
  parsedRepo: ParsedRepo,
  repoInfo: RepoInfo,
  tree: TreeEntry[],
  files: FileContent[],
): AnalysisReport {
  // Run all 8 analyzers
  const documentation = analyzeDocumentation(files, tree);
  const security = analyzeSecurity(files, tree);
  const cicd = analyzeCicd(files, tree);
  const { result: dependencies, techStack } = analyzeDependencies(files, tree);
  const codeQuality = analyzeCodeQuality(files, tree);
  const license = analyzeLicense(files, tree, repoInfo);
  const community = analyzeCommunity(files, tree);
  const openssf = analyzeOpenssf(files, tree);

  const categories = [
    documentation,
    security,
    cicd,
    dependencies,
    codeQuality,
    license,
    community,
    openssf,
  ];

  const overallScore = computeOverallScore(categories);
  const grade = computeGrade(overallScore);
  const strengths = generateStrengths(categories);
  const risks = generateRisks(categories);
  const nextSteps = generateNextSteps(categories);
  const repoStructure = generateMermaidDiagram(tree);

  // Run contributor friendliness analyzer
  const contributorScore = analyzeContributorFriendliness(files, tree, repoInfo);

  // Add language from repoInfo if not already in techStack
  if (
    repoInfo.language &&
    !techStack.some((t) => t.name.toLowerCase() === repoInfo.language!.toLowerCase())
  ) {
    techStack.unshift({ name: repoInfo.language, category: 'language' });
  }

  return {
    id: `${parsedRepo.owner}/${parsedRepo.repo}@${new Date().toISOString()}`,
    repo: parsedRepo,
    repoInfo,
    categories,
    overallScore,
    grade,
    techStack,
    strengths,
    risks,
    nextSteps,
    repoStructure,
    analyzedAt: new Date().toISOString(),
    contributorScore,
    fileCount: files.length,
    treeEntryCount: tree.length,
  };
}
