import type { LlmInsights } from '../../types';

interface Props {
  insights: LlmInsights;
}

export function LlmInsightsPanel({ insights }: Props) {
  return (
    <div className="rounded-xl border border-neon/25 bg-neon/5 p-6 neon-glow">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="h-8 w-8 rounded-lg bg-neon/15 flex items-center justify-center">
          <svg className="h-5 w-5 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-neon">AI Insights</h3>
      </div>

      <p className="text-sm text-text leading-relaxed mb-5">{insights.summary}</p>

      {insights.risks.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            Risks
          </h4>
          <ul className="space-y-2">
            {insights.risks.map((risk) => (
              <li key={risk} className="text-sm text-text flex items-start gap-2.5 leading-relaxed">
                <span className="text-grade-c mt-0.5">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}

      {insights.recommendations.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            Recommendations
          </h4>
          <ul className="space-y-2">
            {insights.recommendations.map((rec) => (
              <li key={rec} className="text-sm text-text flex items-start gap-2.5 leading-relaxed">
                <span className="text-neon mt-0.5">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
