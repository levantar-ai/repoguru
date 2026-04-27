import type { AnalysisReport, OrgScanResult, CategoryKey } from '../../types';
import { scoreToGrade } from '../../utils/formatters';
import { CATEGORY_LABELS } from '../../utils/constants';

/**
 * Escapes a CSV field value. Wraps in double quotes if it contains
 * commas, double quotes, or newlines.
 */
function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Converts a single analysis report to CSV format.
 * Columns: Category, Score, Weight, Grade, Signals Found, Signals Missing
 */
export function reportToCsv(report: AnalysisReport): string {
  const rows: string[] = [];

  // Header
  rows.push('Category,Score,Weight,Grade,Signals Found,Signals Missing');

  for (const cat of report.categories) {
    const grade = scoreToGrade(cat.score);
    const found = cat.signals
      .filter((s) => s.found)
      .map((s) => s.name)
      .join('; ');
    const missing = cat.signals
      .filter((s) => !s.found)
      .map((s) => s.name)
      .join('; ');

    rows.push(
      [
        escapeCsv(cat.label),
        cat.score.toString(),
        cat.weight.toString(),
        grade,
        escapeCsv(found),
        escapeCsv(missing),
      ].join(','),
    );
  }

  // Summary row
  rows.push('');
  rows.push(`Overall,${report.overallScore},,${report.grade},,`);

  return rows.join('\n');
}

/**
 * Converts an org scan result to CSV format.
 * Columns: Repo, Score, Grade, then one column per category score.
 */
export function orgScanToCsv(result: OrgScanResult): string {
  const rows: string[] = [];

  const categoryKeys: CategoryKey[] = [
    'documentation',
    'security',
    'cicd',
    'dependencies',
    'codeQuality',
    'license',
    'community',
    'openssf',
  ];
  const categoryHeaders = categoryKeys.map((k) => CATEGORY_LABELS[k]);

  // Header
  rows.push(['Repo', 'Score', 'Grade', ...categoryHeaders].join(','));

  for (const repo of result.repos) {
    const repoName = `${repo.repo.owner}/${repo.repo.repo}`;
    const categoryScores = categoryKeys.map((key) => {
      const cat = repo.categories.find((c) => c.key === key);
      return cat ? cat.score.toString() : '0';
    });

    rows.push(
      [escapeCsv(repoName), repo.overallScore.toString(), repo.grade, ...categoryScores].join(','),
    );
  }

  // Summary row
  rows.push('');
  const avgCategoryScores = categoryKeys.map((key) => {
    const avg = result.categoryAverages[key];
    return avg !== undefined ? Math.round(avg).toString() : '0';
  });
  rows.push(
    [
      'Average',
      Math.round(result.averageScore).toString(),
      result.averageGrade,
      ...avgCategoryScores,
    ].join(','),
  );

  return rows.join('\n');
}
