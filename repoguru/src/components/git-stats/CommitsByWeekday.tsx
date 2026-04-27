import { CommitsByWeekdayChart } from '@repoguru/ui';

interface Props {
  commitsByWeekday: number[];
}

export function CommitsByWeekday({ commitsByWeekday }: Props) {
  if (commitsByWeekday.every((c) => c === 0)) return null;
  return <CommitsByWeekdayChart data={commitsByWeekday} card={false} height={280} />;
}
