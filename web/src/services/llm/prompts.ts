import type { AnalysisReport } from '../../types';

export function buildAnalysisPrompt(report: AnalysisReport): string {
  const categoryLines = report.categories
    .map(
      (c) =>
        `- ${c.label}: ${c.score}/100 (${c.signals.filter((s) => s.found).length}/${c.signals.length} signals)`,
    )
    .join('\n');

  const techStackLine = report.techStack.map((t) => t.name).join(', ');

  return `Analyze this GitHub repository report card and provide insights.

Repository: ${report.repo.owner}/${report.repo.repo}
Description: ${report.repoInfo.description || 'N/A'}
Overall Grade: ${report.grade} (${report.overallScore}/100)
Stars: ${report.repoInfo.stars} | Forks: ${report.repoInfo.forks}
Tech Stack: ${techStackLine || 'N/A'}

Category Scores:
${categoryLines}

Strengths identified: ${report.strengths.join('; ') || 'None'}
Risks identified: ${report.risks.join('; ') || 'None'}

Please provide:
1. A 2-3 sentence executive summary of the repository's health and maturity
2. The top 3 specific risks or concerns (be concrete)
3. The top 3 actionable recommendations to improve the repository (be specific)

Respond in JSON format:
{
  "summary": "...",
  "risks": ["...", "...", "..."],
  "recommendations": ["...", "...", "..."]
}`;
}

export const SYSTEM_PROMPT = `You are a senior software engineer reviewing GitHub repositories.
Provide concise, actionable insights based on the repository analysis data provided.
Focus on practical improvements. Always respond with valid JSON.`;
