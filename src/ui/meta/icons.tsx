import type { ReactNode } from 'react';

interface IconProps {
  size?: number | undefined;
}

function Svg({ size = 24, children, fill = 'none' }: IconProps & { children: ReactNode; fill?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
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

export function IconLoupe({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
      <path d="M8 9.2a3 3 0 012.4-1.6" />
    </Svg>
  );
}

export function IconBucket({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M5.5 9.5l6-6 7 7-6 6a2 2 0 01-2.8 0l-4.2-4.2a2 2 0 010-2.8z" />
      <path d="M5 11h13" />
      <path d="M19.5 14.5s1.8 2.1 1.8 3.3a1.8 1.8 0 01-3.6 0c0-1.2 1.8-3.3 1.8-3.3z" />
    </Svg>
  );
}

export function IconWand({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M4 20L14.5 9.5" />
      <path d="M13 8l3 3" />
      <path d="M18 3v3M16.5 4.5h3M20.5 9v2M19.5 10h2M11 3.5v1.6M10.2 4.3h1.6" />
    </Svg>
  );
}

export function IconFlame({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M12 21a6 6 0 006-6c0-3.6-2.6-5.9-3.6-8.9-.2-.6-1-.8-1.4-.3C11.4 7.8 9 9.6 9 12.6c0 .6-.7.9-1.1.4-.3-.4-.5-.9-.6-1.4-.1-.5-.8-.7-1.1-.2A6 6 0 0012 21z" />
    </Svg>
  );
}

export function IconSnow({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />
      <path d="M10 4.5l2 1.8 2-1.8M10 19.5l2-1.8 2 1.8" />
    </Svg>
  );
}

export function IconStar({ size }: IconProps) {
  return (
    <Svg size={size} fill="currentColor">
      <path d="M12 3.5l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.5l-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.5z" />
    </Svg>
  );
}

export function IconChest({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M4 10h16v8.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18.5V10z" />
      <path d="M4 10V8a4 4 0 014-4h8a4 4 0 014 4v2" />
      <path d="M10.5 10v3h3v-3M4 14h6.5M13.5 14H20" />
    </Svg>
  );
}

export function IconTrophy({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M8 4h8v5a4 4 0 01-8 0V4z" />
      <path d="M8 6H5.5a2 2 0 002 3.8M16 6h2.5a2 2 0 01-2 3.8M12 13v3.5M8.5 20h7M10 16.5h4l.5 3.5h-5l.5-3.5z" />
    </Svg>
  );
}

export function IconCheck({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M5 12.5l4.2 4.2L19 7" />
    </Svg>
  );
}

export function IconReroll({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M19 12a7 7 0 11-2.1-5" />
      <path d="M19 4v4h-4" />
    </Svg>
  );
}

export function IconLock({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" />
    </Svg>
  );
}
