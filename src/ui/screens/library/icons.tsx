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

export const IconFilter = ({ size }: { size?: number | undefined }) => (
  <Svg size={size}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Svg>
);

export const IconPhoto = ({ size }: { size?: number | undefined }) => (
  <Svg size={size}>
    <rect x="3.5" y="5.5" width="17" height="14" rx="3" />
    <circle cx="9" cy="11" r="1.6" />
    <path d="M4 17l4.5-4 3.5 3 3-2.5 5 4" />
  </Svg>
);
