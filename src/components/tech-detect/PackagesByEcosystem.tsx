import { useMemo } from 'react';
import type { DetectedPackage, DetectedPythonPackage } from '../../types/techDetect';
import { EChartsWrapper } from '../git-stats/EChartsWrapper';

const ECOSYSTEM_COLORS: Record<string, string> = {
  node: '#339933',
  python: '#3776AB',
  go: '#00ADD8',
  java: '#ED8B00',
  php: '#777BB4',
  rust: '#DEA584',
  ruby: '#CC342D',
};

const ECOSYSTEM_LABELS: Record<string, string> = {
  node: 'npm',
  python: 'Python',
  go: 'Go',
  java: 'Java',
  php: 'PHP',
  rust: 'Rust',
  ruby: 'Ruby',
};

interface Props {
  node: DetectedPackage[];
  python: DetectedPythonPackage[];
  go: DetectedPackage[];
  java: DetectedPackage[];
  php: DetectedPackage[];
  rust: DetectedPackage[];
  ruby: DetectedPackage[];
}

export function PackagesByEcosystem({ node, python, go, java, php, rust, ruby }: Props) {
  const ecosystems = useMemo(() => {
    const entries: { name: string; key: string; count: number }[] = [
      { name: ECOSYSTEM_LABELS.node, key: 'node', count: node.length },
      { name: ECOSYSTEM_LABELS.python, key: 'python', count: python.length },
      { name: ECOSYSTEM_LABELS.go, key: 'go', count: go.length },
      { name: ECOSYSTEM_LABELS.java, key: 'java', count: java.length },
      { name: ECOSYSTEM_LABELS.php, key: 'php', count: php.length },
      { name: ECOSYSTEM_LABELS.rust, key: 'rust', count: rust.length },
      { name: ECOSYSTEM_LABELS.ruby, key: 'ruby', count: ruby.length },
    ].filter((e) => e.count > 0);
    return entries;
  }, [node, python, go, java, php, rust, ruby]);

  const option = useMemo(() => {
    return {
      tooltip: {
        trigger: 'item' as const,
        formatter: '{b}: {c} package{c|s} ({d}%)',
      },
      series: [
        {
          type: 'pie' as const,
          radius: ['45%', '70%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6, borderColor: 'rgba(0,0,0,0.3)', borderWidth: 2 },
          label: {
            color: '#9CA3AF',
            fontSize: 12,
            formatter: '{b}\n{c}',
          },
          emphasis: {
            label: { fontSize: 14, fontWeight: 'bold' as const },
          },
          data: ecosystems.map((e) => ({
            name: e.name,
            value: e.count,
            itemStyle: { color: ECOSYSTEM_COLORS[e.key] },
          })),
        },
      ],
    };
  }, [ecosystems]);

  if (ecosystems.length === 0) return null;

  const totalPackages = ecosystems.reduce((s, e) => s + e.count, 0);

  return (
    <section className="rounded-xl border border-border bg-surface-alt overflow-hidden">
      <div className="flex items-center gap-3 p-5 border-b border-border">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-teal-500/10">
          <svg
            className="h-5 w-5 text-teal-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
            />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-text flex-1">Packages by Ecosystem</h3>
        <span className="shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-400">
          {totalPackages} total
        </span>
      </div>
      <div className="p-4">
        <EChartsWrapper option={option} height="300px" />
      </div>
    </section>
  );
}
