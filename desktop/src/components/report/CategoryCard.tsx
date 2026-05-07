import { useState } from 'react';
import type { CategoryScore } from '@/services/grpc-client';
import { LetterGrade } from './LetterGrade';
import { SignalList } from './SignalList';

const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e',
  B: '#84cc16',
  C: '#eab308',
  D: '#f97316',
  F: '#ef4444',
};

const CATEGORY_ICONS: Record<string, string> = {
  documentation:
    'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  security:
    'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  cicd: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  dependencies: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  code_quality: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  license:
    'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  community:
    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  openssf: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
};

interface Props {
  category: CategoryScore;
  index: number;
}

export function CategoryCard({ category, index }: Props) {
  const [expanded, setExpanded] = useState(false);
  const color = GRADE_COLORS[category.grade] || '#64748b';
  const iconPath = CATEGORY_ICONS[category.key] || CATEGORY_ICONS.code_quality;
  const foundCount = category.signals.filter((s) => s.found).length;

  return (
    <div
      className={`animate-fade-in-up rounded-lg border border-gray-800 bg-gray-900/50 p-4 hover:border-gray-700 transition-all cursor-pointer`}
      style={{ animationDelay: `${index * 100}ms` }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div
          className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
          </svg>
        </div>

        {/* Label + weight */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-200">{category.label}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">
              {Math.round(category.weight * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full animate-progress-fill"
                style={{ width: `${category.score}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-xs text-gray-400 tabular-nums w-7 text-right">
              {category.score}
            </span>
          </div>
        </div>

        {/* Grade badge */}
        <LetterGrade grade={category.grade} score={category.score} size="sm" />
      </div>

      {/* Signal count summary */}
      <div className="mt-2 flex items-center gap-1 text-[11px] text-gray-500">
        <span className="text-green-500">{foundCount}</span>/<span>{category.signals.length}</span>{' '}
        signals found
        <svg
          className={`w-3 h-3 ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded signal list */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-800">
          <SignalList signals={category.signals} />
        </div>
      )}
    </div>
  );
}
