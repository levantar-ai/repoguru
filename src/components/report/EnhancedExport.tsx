import type { AnalysisReport } from '../../types';
import { reportToMarkdown } from '../../services/export/markdown';
import { reportToCsv } from '../../services/export/csv';
import { sbomToJson } from '../../services/export/sbom';
import { useClipboard } from '../../hooks/useClipboard';
import { trackEvent } from '../../utils/analytics';

interface Props {
  report: AnalysisReport;
}

interface ExportOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  actionLabel: string;
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function EnhancedExport({ report }: Props) {
  const { copied, copy } = useClipboard();

  const options: ExportOption[] = [
    {
      id: 'markdown',
      title: 'Markdown',
      description: 'Copy the full report as Markdown text.',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
      action: () => {
        copy(reportToMarkdown(report));
        trackEvent('report_export', {
          format: 'markdown',
          repo: `${report.repo.owner}/${report.repo.repo}`,
        });
      },
      actionLabel: 'Copy',
    },
    {
      id: 'csv',
      title: 'CSV',
      description: 'Copy category scores and signals as CSV.',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      ),
      action: () => {
        copy(reportToCsv(report));
        trackEvent('report_export', {
          format: 'csv',
          repo: `${report.repo.owner}/${report.repo.repo}`,
        });
      },
      actionLabel: 'Copy',
    },
    {
      id: 'json',
      title: 'JSON',
      description: 'Copy the raw report data as JSON.',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
          />
        </svg>
      ),
      action: () => {
        copy(JSON.stringify(report, null, 2));
        trackEvent('report_export', {
          format: 'json',
          repo: `${report.repo.owner}/${report.repo.repo}`,
        });
      },
      actionLabel: 'Copy',
    },
    {
      id: 'sbom',
      title: 'SBOM',
      description: 'Download a CycloneDX-style software bill of materials.',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      ),
      action: () => {
        const filename = `${report.repo.owner}-${report.repo.repo}-sbom.json`;
        downloadFile(sbomToJson(report), filename, 'application/json');
        trackEvent('report_export', {
          format: 'sbom',
          repo: `${report.repo.owner}/${report.repo.repo}`,
        });
      },
      actionLabel: 'Download',
    },
    {
      id: 'print',
      title: 'Print / PDF',
      description: 'Print the report or save as PDF via browser.',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
          />
        </svg>
      ),
      action: () => {
        trackEvent('report_export', {
          format: 'print',
          repo: `${report.repo.owner}/${report.repo.repo}`,
        });
        window.print();
      },
      actionLabel: 'Print',
    },
  ];

  return (
    <div className="no-print">
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
        Export Report
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {options.map((opt) => (
          <div
            key={opt.id}
            className="flex flex-col justify-between p-4 rounded-xl border border-border bg-surface-alt hover:border-neon/20 transition-colors"
          >
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="text-neon-dim" aria-hidden="true">
                  {opt.icon}
                </div>
                <span className="text-sm font-semibold text-text">{opt.title}</span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">{opt.description}</p>
            </div>
            <button
              onClick={opt.action}
              className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-surface-hover hover:border-neon/30 hover:text-neon text-text-secondary transition-all"
              aria-label={`${opt.actionLabel} ${opt.title} export`}
            >
              {copied && (opt.id === 'markdown' || opt.id === 'csv' || opt.id === 'json') ? (
                <output className="text-grade-a">Copied!</output>
              ) : (
                opt.actionLabel
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
