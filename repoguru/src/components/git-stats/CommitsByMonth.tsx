import { CommitsByMonthChart } from '@repoguru/ui';

interface Props {
  commitsByMonth: number[];
}

export function CommitsByMonth({ commitsByMonth }: Props) {
  if (commitsByMonth.every((c) => c === 0)) return null;
  return <CommitsByMonthChart data={commitsByMonth} card={false} height={280} />;
}
