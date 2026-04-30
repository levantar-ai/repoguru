// Compact inline SVGs used for section-nav glyphs. We use stroke-current
// so the active/inactive color flows through from the surrounding button.
// Keep them visually consistent: 24x24 viewBox, stroke 1.8.

const baseProps = {
  className: 'h-full w-full',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const OverviewIcon = () => (
  <svg {...baseProps}><path d="M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" /></svg>
);

export const CategoriesIcon = () => (
  <svg {...baseProps}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

export const StrengthsIcon = () => (
  <svg {...baseProps}>
    <path d="M7 11l3 3 7-7" />
    <path d="M21 12a9 9 0 11-9-9" />
  </svg>
);

export const RisksIcon = () => (
  <svg {...baseProps}>
    <path d="M12 3l10 18H2L12 3z" />
    <path d="M12 10v5M12 18v.01" />
  </svg>
);

export const NextStepsIcon = () => (
  <svg {...baseProps}>
    <path d="M9 18h6M10 22h4" />
    <path d="M12 2a7 7 0 00-4 12.7c.6.6 1 1.4 1 2.3v1h6v-1c0-.9.4-1.7 1-2.3A7 7 0 0012 2z" />
  </svg>
);

export const ActivityIcon = () => (
  <svg {...baseProps}><path d="M3 12h4l3-9 4 18 3-9h4" /></svg>
);

export const HealthIcon = () => (
  <svg {...baseProps}>
    <polygon points="12,3 21,8 21,16 12,21 3,16 3,8" />
    <polygon points="12,7 17,9.5 17,14.5 12,17 7,14.5 7,9.5" />
  </svg>
);

export const CodeIcon = () => (
  <svg {...baseProps}><path d="M16 18l6-6-6-6M8 6l-6 6 6 6" /></svg>
);

export const ContributorsIcon = () => (
  <svg {...baseProps}>
    <circle cx="9" cy="8" r="3.5" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
    <path d="M14 14.5c2.7 0 8 1.3 8 5.5" />
  </svg>
);

export const HotspotsIcon = () => (
  <svg {...baseProps}>
    <path d="M12 2c2 4 5 5 5 9a5 5 0 11-10 0c0-2 1-3 2-4 0-2 1-4 3-5z" />
  </svg>
);

export const DistributionIcon = () => (
  <svg {...baseProps}>
    <path d="M3 21V8M9 21V3M15 21v-9M21 21v-5" />
  </svg>
);

export const PatternsIcon = () => (
  <svg {...baseProps}>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="18" cy="6" r="2.5" />
    <circle cx="6" cy="18" r="2.5" />
    <circle cx="18" cy="18" r="2.5" />
    <path d="M8.5 6h7M8.5 18h7M6 8.5v7M18 8.5v7" />
  </svg>
);

export const NetworkIcon = () => (
  <svg {...baseProps}>
    <circle cx="12" cy="12" r="2" />
    <circle cx="4" cy="6" r="2" />
    <circle cx="20" cy="6" r="2" />
    <circle cx="4" cy="18" r="2" />
    <circle cx="20" cy="18" r="2" />
    <path d="M5.5 7l5 4M18.5 7l-5 4M5.5 17l5-4M18.5 17l-5-4" />
  </svg>
);

export const MessagesIcon = () => (
  <svg {...baseProps}>
    <path d="M3 5h18v12H8l-5 5V5z" />
  </svg>
);

export const FilesIcon = () => (
  <svg {...baseProps}>
    <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
  </svg>
);

export const ReleasesIcon = () => (
  <svg {...baseProps}>
    <path d="M3 4h12l5 5-5 5H3V4z" />
    <circle cx="7" cy="9" r="1.5" />
  </svg>
);
