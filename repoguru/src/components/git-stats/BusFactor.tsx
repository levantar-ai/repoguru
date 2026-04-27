import { BusFactorChart } from '@repoguru/ui';
import type { HealthSection } from '@repoguru/core';

interface Props {
  busFactor: HealthSection['busFactor'];
}

export function BusFactor({ busFactor }: Props) {
  if (busFactor.lorenz.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-sm text-text-muted">
        No contributor data available
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-3 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-neon inline-block" /> Lorenz Curve
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 inline-block" style={{ borderTop: '1px dashed #475569' }} />{' '}
          Perfect Equality
        </span>
      </div>
      <BusFactorChart busFactor={busFactor} card={false} height={350} />
    </div>
  );
}
