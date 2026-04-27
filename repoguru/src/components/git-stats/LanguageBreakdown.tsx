import { LanguageBreakdownChart } from '@repoguru/ui';
import type { PatternsSection } from '@repoguru/core';

interface Props {
  languages: PatternsSection['languageBreakdown'];
}

export function LanguageBreakdown({ languages }: Props) {
  return <LanguageBreakdownChart data={languages} />;
}
