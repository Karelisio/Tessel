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

export const IconChart = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Svg>
);

export const IconCollections = ({ size }: P) => (
  <Svg size={size}>
    <rect x="3" y="7" width="12" height="13" rx="2.5" />
    <path d="M7 4h11a3 3 0 013 3v10" />
    <path d="M6.5 15.5l2.5-2.5 2 2 1.5-1.5" />
  </Svg>
);

export const IconClock = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);

export const IconBrush = ({ size }: P) => (
  <Svg size={size}>
    <path d="M10 15L19 6a2.1 2.1 0 013 3l-9 9" />
    <path d="M10 15c-2.8-.3-4.5 1.2-4.5 3.5 0 1-.6 1.6-1.5 2 3.5.8 7-.3 7-3.5" />
  </Svg>
);

export const IconFrame = ({ size }: P) => (
  <Svg size={size}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <rect x="7" y="8" width="10" height="8" rx="1" />
  </Svg>
);

export const IconLockSmall = ({ size }: P) => (
  <Svg size={size}>
    <rect x="5" y="11" width="14" height="9" rx="2.5" />
    <path d="M8 11V8a4 4 0 018 0v3" />
  </Svg>
);

export const IconSpark = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 3l2 6 6 3-6 3-2 6-2-6-6-3 6-3z" />
  </Svg>
);

export const IconInfo = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Svg>
);

export const IconGlobe = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
  </Svg>
);

export const IconSound = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4 10v4h4l5 4V6L8 10z" />
    <path d="M16.5 9a4.5 4.5 0 010 6M19 6.5a8 8 0 010 11" />
  </Svg>
);

export const IconHand = ({ size }: P) => (
  <Svg size={size}>
    <path d="M9 11V5.5a1.5 1.5 0 013 0V10M12 10V4.5a1.5 1.5 0 013 0V10M15 10V6.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1a6 6 0 01-5-2.7L4 14.5a1.6 1.6 0 012.6-1.8L9 15.5" />
  </Svg>
);

export const IconEye = ({ size }: P) => (
  <Svg size={size}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const IconBell = ({ size }: P) => (
  <Svg size={size}>
    <path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15zM10 21h4" />
  </Svg>
);

export const IconRefresh = ({ size }: P) => (
  <Svg size={size}>
    <path d="M20 11a8 8 0 00-14-4.5L4 9M4 4v5h5M4 13a8 8 0 0014 4.5l2-2.5M20 20v-5h-5" />
  </Svg>
);

export const IconPalette = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 3a9 9 0 100 18c1.5 0 2-1 1.5-2-.6-1.2.2-2.5 1.5-2.5h2A3.5 3.5 0 0021 13 9 9 0 0012 3z" />
    <circle cx="8" cy="11" r=".7" />
    <circle cx="12" cy="7.5" r=".7" />
    <circle cx="16" cy="10" r=".7" />
  </Svg>
);

export const IconReplay = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4 12a8 8 0 108-8H8M8 1l-3 3 3 3" />
  </Svg>
);

export const IconCheckBold = ({ size }: P) => (
  <Svg size={size}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
