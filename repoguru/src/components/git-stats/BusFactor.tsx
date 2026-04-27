import { BusFactorChart } from '@repoguru/ui';
import type { HealthSection } from '@repoguru/core';

interface Props {
  busFactor: HealthSection['busFactor'];
}

export function BusFactor({ busFactor }: Props) {
  return <BusFactorChart busFactor={busFactor} />;
}
