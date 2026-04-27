import { CommitsByYearChart } from '@repoguru/ui';

interface Props {
  commitsByYear: { year: number; count: number }[];
}

export function CommitsByYear({ commitsByYear }: Props) {
  return <CommitsByYearChart data={commitsByYear} />;
}
