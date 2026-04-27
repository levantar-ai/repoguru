import { HealthRadarChart } from '@repoguru/ui';
import type { HealthSection } from '@repoguru/core';

interface Props {
  radarMetrics: HealthSection['radarMetrics'];
}

export function RadarHealthCard({ radarMetrics }: Props) {
  return <HealthRadarChart metrics={radarMetrics} />;
}
