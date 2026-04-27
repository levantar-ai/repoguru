import { CommitsByYearChart } from '@repoguru/ui';

interface Props {
  commitsByYear: { year: number; count: number }[];
}

export function CommitsByYear({ commitsByYear }: Props) {
  if (commitsByYear.length === 0) return null;
  return <CommitsByYearChart data={commitsByYear} card={false} height={280} />;
}
