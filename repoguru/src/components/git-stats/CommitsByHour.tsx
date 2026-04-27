import { CommitsByHourChart } from '@repoguru/ui';

interface Props {
  commitsByHour: number[];
}

export function CommitsByHour({ commitsByHour }: Props) {
  if (commitsByHour.every((c) => c === 0)) return null;
  return <CommitsByHourChart data={commitsByHour} card={false} height={300} />;
}
