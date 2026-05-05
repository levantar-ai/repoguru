import type { AnalysisReport } from '../../types';
import { reportToMarkdown } from '../../services/export/markdown';
import { useClipboard } from '../../hooks/useClipboard';
import { useWebShare } from '../../hooks/useWebShare';

interface Props {
  report: AnalysisReport;
}

const btnClass =
  'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-border bg-surface-alt hover:bg-surface-hover hover:border-neon/30 transition-all duration-200';

export function ShareToolbar({ report }: Props) {
  const { copied, copy } = useClipboard();
  const { canShare, share } = useWebShare();

  const markdown = reportToMarkdown(report);

  const handleCopy = () => copy(markdown);
  const handlePrint = () => window.print();
  const handleShare = () => {
    share({
      title: `Repo Guru: ${report.repo.owner}/${report.repo.repo} — Grade ${report.grade}`,
      text: `${report.repo.owner}/${report.repo.repo} scored ${report.grade} (${report.overallScore}/100) on Repo Guru`,
    });
  };

  return (
    <div className="no-print flex flex-wrap items-center gap-3">
      <button onClick={handleCopy} className={btnClass}>
        {copied ? (
          <>
            <svg
              className="h-4 w-4 text-grade-a"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-grade-a">Copied!</span>
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
              />
            </svg>
            Copy Markdown
          </>
        )}
      </button>

      <button onClick={handlePrint} className={btnClass}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
          />
        </svg>
        Print / PDF
      </button>

      {canShare && (
        <button onClick={handleShare} className={btnClass}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
          Share
        </button>
      )}
    </div>
  );
}
