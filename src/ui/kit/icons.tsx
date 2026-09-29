import type { ReactNode } from 'react';

export interface IconProps {
  size?: number | undefined;
}

function Svg({ size = 24, children }: IconProps & { children: ReactNode }) {
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

export const IconLibrary = ({ size }: IconProps) => (
  <Svg size={size}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </Svg>
);

export const IconDaily = ({ size }: IconProps) => (
  <Svg size={size}>
    <rect x="3.5" y="9" width="17" height="11.5" rx="2" />
    <path d="M2.5 9h19M12 9v11.5M12 9c-1.5-3.5-6-4.5-6-1.5S12 9 12 9zM12 9c1.5-3.5 6-4.5 6-1.5S12 9 12 9z" />
  </Svg>
);

export const IconGallery = ({ size }: IconProps) => (
  <Svg size={size}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <rect x="6.5" y="7.5" width="11" height="9" rx="1" />
    <path d="M8 15l2.5-2.5 2 2 1.5-1.5 2 2" />
  </Svg>
);

export const IconCreate = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M4 20l1-4L16 5a2.1 2.1 0 013 3L8 19l-4 1z" />
    <path d="M14 7l3 3" />
  </Svg>
);

export const IconProfile = ({ size }: IconProps) => (
  <Svg size={size}>
    <circle cx="12" cy="8.5" r="4" />
    <path d="M4.5 20.5c1.2-4 4.1-6 7.5-6s6.3 2 7.5 6" />
  </Svg>
);

export const IconBack = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
);

export const IconChevron = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
);

export const IconSettings = ({ size }: IconProps) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
  </Svg>
);

export const IconMore = ({ size }: IconProps) => (
  <Svg size={size}>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </Svg>
);

export const IconSearch = ({ size }: IconProps) => (
  <Svg size={size}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </Svg>
);

export const IconPlay = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M8 5.5v13l10-6.5z" />
  </Svg>
);

export const IconClose = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
