import { useState, useMemo } from 'react';
import type {
  TechDetectResult,
  DetectedAWSService,
  DetectedAzureService,
  DetectedGCPService,
  DetectedPackage,
  DetectedPythonPackage,
} from '../../types/techDetect';

interface Props {
  result: TechDetectResult;
}

const VIA_LABELS: Record<string, string> = {
  'js-sdk-v3': 'JS SDK v3',
  'js-sdk-v2': 'JS SDK v2',
  boto3: 'boto3',
  cloudformation: 'CloudFormation',
  terraform: 'Terraform',
  cdk: 'CDK',
  'arm-template': 'ARM',
  bicep: 'Bicep',
  'npm-sdk': 'npm SDK',
  'python-sdk': 'pip SDK',
};

const VIA_COLORS: Record<string, { bg: string; text: string }> = {
  'js-sdk-v3': { bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
  'js-sdk-v2': { bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
  boto3: { bg: 'bg-green-500/10', text: 'text-green-400' },
  cloudformation: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
  terraform: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
  cdk: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  'arm-template': { bg: 'bg-sky-500/10', text: 'text-sky-400' },
  bicep: { bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
  'npm-sdk': { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  'python-sdk': { bg: 'bg-lime-500/10', text: 'text-lime-400' },
};

/* ─── Chevron icon ─── */
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-text-muted transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

/* ─── Generic Cloud Service Section (reused for AWS, Azure, GCP) ─── */
interface CloudServiceSectionProps<
  T extends { service: string; via: string; source: string; sdkPackage?: string },
> {
  title: string;
  color: string;
  items: T[];
  icon: React.ReactNode;
}

function CloudServiceSection<
  T extends { service: string; via: string; source: string; sdkPackage?: string },
>({ title, color, items, icon }: CloudServiceSectionProps<T>) {
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const list = map.get(item.service) || [];
      list.push(item);
      map.set(item.service, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  const uniqueVias = useMemo(() => [...new Set(items.map((a) => a.via))], [items]);

  if (items.length === 0) return null;

  const CHIP_LIMIT = 12;
  const visibleServices = showAll ? grouped : grouped.slice(0, CHIP_LIMIT);
  const hiddenCount = grouped.length - CHIP_LIMIT;
  const selectedItems = selectedService
    ? (grouped.find(([name]) => name === selectedService)?.[1] ?? [])
    : [];

  return (
    <section className="rounded-xl border border-border bg-surface-alt overflow-hidden">
      <div className="flex items-center gap-3 p-5 border-b border-border">
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}20` }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-text">{title}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {uniqueVias.map((via) => {
              const colors = VIA_COLORS[via] || { bg: 'bg-neon/10', text: 'text-neon' };
              return (
                <span
                  key={via}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors.bg} ${colors.text}`}
                >
                  {VIA_LABELS[via] || via}
                </span>
              );
            })}
          </div>
        </div>
        <span
          className="shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold"
          style={{ background: `${color}20`, color }}
        >
          {grouped.length} service{grouped.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="p-4">
        {/* Chip grid */}
        <div className="flex flex-wrap gap-2">
          {visibleServices.map(([service, serviceItems]) => {
            const isActive = selectedService === service;
            return (
              <button
                key={service}
                onClick={() => setSelectedService(isActive ? null : service)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  isActive
                    ? 'bg-neon/15 border-neon/30 text-neon'
                    : 'bg-surface-hover border-border text-text-secondary hover:border-border-bright'
                }`}
              >
                {service}
                <span className="ml-1.5 opacity-60">{serviceItems.length}</span>
              </button>
            );
          })}
          {!showAll && hiddenCount > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium border border-border text-text-muted hover:text-text-secondary hover:border-border-bright transition-colors"
            >
              +{hiddenCount} more
            </button>
          )}
        </div>

        {/* Detail panel for selected service */}
        {selectedService && selectedItems.length > 0 && (
          <div className="mt-3 space-y-1">
            {selectedItems.map((item, i) => (
              <div
                key={`${item.via}-${item.source}-${i}`}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface/50 text-xs"
              >
                <span className="font-mono text-text-muted flex-1 truncate" title={item.source}>
                  {item.source}
                </span>
                {item.sdkPackage && (
                  <span
                    className="font-mono text-text-muted truncate max-w-[200px]"
                    title={item.sdkPackage}
                  >
                    {item.sdkPackage}
                  </span>
                )}
                <span
                  className={`px-1.5 py-0.5 rounded font-medium shrink-0 ${(VIA_COLORS[item.via] || { bg: 'bg-neon/10', text: 'text-neon' }).bg} ${(VIA_COLORS[item.via] || { bg: 'bg-neon/10', text: 'text-neon' }).text}`}
                >
                  {VIA_LABELS[item.via] || item.via}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── Generic Package Section (reused for Python, Node, Go, Java, PHP, Rust, Ruby) ─── */
interface PackageSectionProps {
  title: string;
  color: string;
  packages: (DetectedPackage | DetectedPythonPackage)[];
  icon: React.ReactNode;
}

function PackageSection({ title, color, packages, icon }: PackageSectionProps) {
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    const map = new Map<string, (DetectedPackage | DetectedPythonPackage)[]>();
    for (const item of packages) {
      const list = map.get(item.source) || [];
      list.push(item);
      map.set(item.source, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [packages]);

  const toggleSource = (source: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const expandAll = () => setExpandedSources(new Set(grouped.map(([name]) => name)));
  const collapseAll = () => setExpandedSources(new Set());

  if (packages.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-surface-alt overflow-hidden">
      <div className="flex items-center gap-3 p-5 border-b border-border">
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}20` }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-text">{title}</h3>
          {grouped.length > 0 && (
            <p className="text-xs text-text-muted mt-0.5">
              from {grouped.length} source file{grouped.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <span
          className="shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold"
          style={{ background: `${color}20`, color }}
        >
          {packages.length} package{packages.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div>
        <div className="flex items-center gap-3 px-5 py-2 border-b border-border/50 text-xs text-text-muted">
          <button onClick={expandAll} className="hover:text-neon transition-colors">
            Expand all
          </button>
          <span className="text-border">|</span>
          <button onClick={collapseAll} className="hover:text-neon transition-colors">
            Collapse all
          </button>
        </div>

        {grouped.map(([source, items]) => {
          const isExpanded = expandedSources.has(source);
          return (
            <div key={source} className="border-b border-border/50 last:border-b-0">
              <button
                onClick={() => toggleSource(source)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-surface-hover transition-colors"
              >
                <ChevronIcon open={isExpanded} />
                <span className="text-sm font-mono text-text-secondary flex-1 truncate">
                  {source}
                </span>
                <span className="text-xs text-text-muted tabular-nums shrink-0">
                  {items.length} package{items.length !== 1 ? 's' : ''}
                </span>
              </button>

              {isExpanded && (
                <div className="px-5 pb-3 pl-12 space-y-1">
                  {items
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((item, i) => (
                      <div
                        key={`${item.name}-${i}`}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface/50 text-xs"
                      >
                        <span className="font-medium text-text flex-1 truncate">{item.name}</span>
                        {item.version && (
                          <span className="font-mono text-neon/80 shrink-0">{item.version}</span>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Simple text icon for languages without SVG icons ─── */
function TextIcon({ label, color }: { label: string; color: string }) {
  return (
    <span className="text-xs font-bold" style={{ color }}>
      {label}
    </span>
  );
}

/* ─── Manifest Files (collapsible) ─── */
function ManifestFilesSection({ result }: Props) {
  const [open, setOpen] = useState(false);
  const { manifestFiles } = result;

  if (manifestFiles.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-surface-alt overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left p-5"
      >
        <ChevronIcon open={open} />
        <h3 className="text-sm font-semibold text-text-secondary">
          Files Scanned ({manifestFiles.length})
        </h3>
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-1">
          {manifestFiles.map((file) => (
            <div
              key={file}
              className="text-xs text-text-muted font-mono px-3 py-1.5 rounded bg-surface/50"
            >
              {file}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ─── Cloud provider icon helpers ─── */
const AWSIcon = () => (
  <svg className="h-5 w-5" style={{ color: '#FF9900' }} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 01-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 01-.287-.375 6.18 6.18 0 01-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.032-.862.104-.295.072-.583.16-.862.272a2.287 2.287 0 01-.28.104.488.488 0 01-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 01.224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 011.246-.152c.95 0 1.644.216 2.091.648.44.432.662 1.085.662 1.963v2.586zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.543-.271.75-.518a1.4 1.4 0 00.319-.567c.056-.216.096-.471.096-.767v-.37a6.69 6.69 0 00-.735-.136 6.024 6.024 0 00-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.095.655.295.846.191.2.47.296.782.296zm6.41.862c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.311L7.586 5.55a1.398 1.398 0 01-.072-.335c0-.128.064-.2.191-.2h.783c.151 0 .255.025.31.08.065.048.113.16.16.312l1.342 5.284 1.245-5.284c.04-.16.088-.264.151-.312a.549.549 0 01.32-.08h.638c.152 0 .256.025.32.08.063.048.12.16.151.312l1.261 5.348 1.381-5.348c.048-.16.104-.264.16-.312a.52.52 0 01.311-.08h.743c.128 0 .2.064.2.2 0 .04-.009.08-.017.128a1.137 1.137 0 01-.056.216l-1.923 6.17c-.048.16-.104.264-.168.312a.514.514 0 01-.303.08h-.687c-.151 0-.255-.024-.319-.08-.064-.056-.12-.16-.152-.32L13.71 6.947l-1.228 5.18c-.04.16-.088.264-.152.32-.064.056-.176.08-.32.08h-.687zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32-.128-.071-.216-.151-.248-.223a.504.504 0 01-.048-.224v-.407c0-.167.064-.247.183-.247.048 0 .096.008.144.024.048.016.12.048.2.08.271.12.566.215.878.279.319.064.63.096.95.096.502 0 .894-.088 1.165-.264a.86.86 0 00.415-.758.777.777 0 00-.215-.559c-.144-.151-.415-.287-.806-.415l-1.157-.36c-.583-.183-1.014-.454-1.277-.813a1.902 1.902 0 01-.4-1.158c0-.335.073-.63.216-.886.144-.255.335-.479.575-.654.24-.184.511-.32.83-.415a3.32 3.32 0 011.014-.152c.18 0 .367.008.559.032.2.024.383.056.559.096.168.048.327.096.479.152.151.056.263.112.335.168a.692.692 0 01.232.248.636.636 0 01.072.303v.375c0 .168-.064.256-.184.256a.83.83 0 01-.303-.096 3.652 3.652 0 00-1.532-.311c-.455 0-.815.072-1.062.223-.248.152-.375.383-.375.694 0 .224.08.415.247.567.168.152.479.303.926.44l1.133.358c.574.184.99.44 1.237.767.247.327.367.702.367 1.117 0 .343-.072.655-.207.926-.144.272-.335.511-.583.703-.248.2-.543.343-.886.447-.36.112-.735.168-1.142.168z" />
  </svg>
);

const AzureIcon = () => <TextIcon label="Az" color="#0078D4" />;
const GCPIcon = () => <TextIcon label="GCP" color="#4285F4" />;
const PythonIcon = () => (
  <svg className="h-5 w-5" style={{ color: '#3776AB' }} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.007 2.752h5.814v.826H3.9S0 5.789 0 11.969c0 6.18 3.403 5.96 3.403 5.96h2.03v-2.867s-.109-3.403 3.35-3.403h5.766s3.24.052 3.24-3.134V3.2S18.28 0 11.914 0zM8.708 1.85a1.06 1.06 0 110 2.12 1.06 1.06 0 010-2.12z" />
    <path d="M12.086 24c6.094 0 5.714-2.656 5.714-2.656l-.007-2.752h-5.814v-.826h8.121s3.9.445 3.9-5.735c0-6.18-3.403-5.96-3.403-5.96h-2.03v2.867s.109 3.403-3.35 3.403H9.451s-3.24-.052-3.24 3.134v5.325S5.72 24 12.086 24zm3.206-1.85a1.06 1.06 0 110-2.12 1.06 1.06 0 010 2.12z" />
  </svg>
);

/* ─── Main Results Component ─── */
export function TechDetectResults({ result }: Props) {
  const hasCloud = result.aws.length > 0 || result.azure.length > 0 || result.gcp.length > 0;
  const langSections: {
    title: string;
    color: string;
    packages: (DetectedPackage | DetectedPythonPackage)[];
    icon: React.ReactNode;
  }[] = [
    { title: 'Python Packages', color: '#3776AB', packages: result.python, icon: <PythonIcon /> },
    {
      title: 'Node Packages',
      color: '#339933',
      packages: result.node,
      icon: <TextIcon label="JS" color="#339933" />,
    },
    {
      title: 'Go Modules',
      color: '#00ADD8',
      packages: result.go,
      icon: <TextIcon label="Go" color="#00ADD8" />,
    },
    {
      title: 'Java Dependencies',
      color: '#ED8B00',
      packages: result.java,
      icon: <TextIcon label="J" color="#ED8B00" />,
    },
    {
      title: 'PHP Packages',
      color: '#777BB4',
      packages: result.php,
      icon: <TextIcon label="PHP" color="#777BB4" />,
    },
    {
      title: 'Rust Crates',
      color: '#DEA584',
      packages: result.rust,
      icon: <TextIcon label="Rs" color="#DEA584" />,
    },
    {
      title: 'Ruby Gems',
      color: '#CC342D',
      packages: result.ruby,
      icon: <TextIcon label="Rb" color="#CC342D" />,
    },
  ].filter((s) => s.packages.length > 0);

  const noResults = !hasCloud && langSections.length === 0;

  if (noResults) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted">No technologies detected in this repository.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cloud sections */}
      {hasCloud && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <CloudServiceSection<DetectedAWSService>
            title="AWS Services"
            color="#FF9900"
            items={result.aws}
            icon={<AWSIcon />}
          />
          <CloudServiceSection<DetectedAzureService>
            title="Azure Services"
            color="#0078D4"
            items={result.azure}
            icon={<AzureIcon />}
          />
          <CloudServiceSection<DetectedGCPService>
            title="GCP Services"
            color="#4285F4"
            items={result.gcp}
            icon={<GCPIcon />}
          />
        </div>
      )}

      {/* Language sections */}
      {langSections.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {langSections.map((s) => (
            <PackageSection
              key={s.title}
              title={s.title}
              color={s.color}
              packages={s.packages}
              icon={s.icon}
            />
          ))}
        </div>
      )}

      <ManifestFilesSection result={result} />
    </div>
  );
}
