import { CommitsByMonthChart } from '@repoguru/ui';

interface Props {
  commitsByMonth: number[];
}

export function CommitsByMonth({ commitsByMonth }: Props) {
  return <CommitsByMonthChart data={commitsByMonth} />;
}
