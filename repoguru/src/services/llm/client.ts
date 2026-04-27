import type { LlmInsights, AnalysisReport } from '../../types';
import type { AnthropicRequest, AnthropicResponse } from './types';
import { buildAnalysisPrompt, SYSTEM_PROMPT } from './prompts';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export async function enrichWithLlm(report: AnalysisReport, apiKey: string): Promise<LlmInsights> {
  const prompt = buildAnalysisPrompt(report);

  const requestBody: AnthropicRequest = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  };

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
  }

  const data: AnthropicResponse = await response.json();
  const text = data.content[0]?.text || '';

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse LLM response as JSON');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    summary: parsed.summary || '',
    risks: parsed.risks || [],
    recommendations: parsed.recommendations || [],
    generatedAt: new Date().toISOString(),
  };
}
