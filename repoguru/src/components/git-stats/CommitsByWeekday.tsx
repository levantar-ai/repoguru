import { CommitsByWeekdayChart } from '@repoguru/ui';

interface Props {
  commitsByWeekday: number[];
}

export function CommitsByWeekday({ commitsByWeekday }: Props) {
  return <CommitsByWeekdayChart data={commitsByWeekday} />;
}
