import type { ReactNode } from 'react';

function Svg({ size = 24, children }: { size?: number | undefined; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

type P = { size?: number | undefined };

export const IconSliders = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4 7h9M19 7h1M4 17h1M11 17h9" />
    <circle cx="16" cy="7" r="2.4" />
    <circle cx="8" cy="17" r="2.4" />
  </Svg>
);

export const IconWall = ({ size }: P) => (
  <Svg size={size}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M3 9.3h18M3 14.7h18M9 4v5.3M15 9.3v5.4M9 14.7V20" />
  </Svg>
);

export const IconDownload = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />
  </Svg>
);

export const IconShare = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="6" cy="12" r="2.4" />
    <circle cx="17.5" cy="6" r="2.4" />
    <circle cx="17.5" cy="18" r="2.4" />
    <path d="m8.1 10.8 7.3-3.6M8.1 13.2l7.3 3.6" />
  </Svg>
);

export const IconVideo = ({ size }: P) => (
  <Svg size={size}>
    <rect x="3" y="6" width="13" height="12" rx="2.5" />
    <path d="m16 10.5 5-2.8v8.6l-5-2.8" />
  </Svg>
);

export const IconGif = ({ size }: P) => (
  <Svg size={size}>
    <rect x="3" y="5" width="18" height="14" rx="3.5" />
    <path d="M10.2 10.2a2.3 2.3 0 1 0 .1 3.6V12.2H9M13 9.8v4.4M15.6 14.2V9.8h2.6M15.6 12h2" />
  </Svg>
);

export const IconPhone = ({ size }: P) => (
  <Svg size={size}>
    <rect x="7" y="2.5" width="10" height="19" rx="2.6" />
    <path d="M11 18.5h2" />
  </Svg>
);

export const IconPlus = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
