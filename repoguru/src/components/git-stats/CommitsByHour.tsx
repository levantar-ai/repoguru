import { CommitsByHourChart } from '@repoguru/ui';

interface Props {
  commitsByHour: number[];
}

export function CommitsByHour({ commitsByHour }: Props) {
  return <CommitsByHourChart data={commitsByHour} />;
}
