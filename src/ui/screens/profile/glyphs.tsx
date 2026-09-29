import type { ReactNode } from 'react';
import type { AchievementIcon } from '@/meta/achievements';

const P = ({ d }: { d: string }) => <path d={d} />;

const GLYPHS: Readonly<Record<AchievementIcon, ReactNode>> = {
  brush: (
    <>
      <P d="M10 15L19 6a2.1 2.1 0 013 3l-9 9" />
      <P d="M10 15c-2.8-.3-4.5 1.2-4.5 3.5 0 1-.6 1.6-1.5 2 3.5.8 7-.3 7-3.5" />
    </>
  ),
  pixel: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
      <P d="M14 6h5M14 9h3M5 15h3M5 18h5" />
    </>
  ),
  diamond: <P d="M6 4h12l3.5 5L12 21 2.5 9zM2.5 9h19M9 4L7 9l5 12 5-12-2-5" />,
  stitch: <P d="M5 5l14 14M19 5L5 19M3 12h2M19 12h2M12 3v2M12 19v2" />,
  tile: (
    <>
      <rect x="3.5" y="3.5" width="9" height="8" rx="1.5" />
      <rect x="14.5" y="3.5" width="6" height="8" rx="1.5" />
      <rect x="3.5" y="13.5" width="6" height="7" rx="1.5" />
      <rect x="11.5" y="13.5" width="9" height="7" rx="1.5" />
    </>
  ),
  frame: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <rect x="7" y="8" width="10" height="8" rx="1" />
    </>
  ),
  expand: <P d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  mountain: <P d="M3 19l6-10 4 6 2-3 6 7z" />,
  palette: (
    <>
      <P d="M12 3a9 9 0 100 18c1.5 0 2-1 1.5-2-.6-1.2.2-2.5 1.5-2.5h2A3.5 3.5 0 0021 13 9 9 0 0012 3z" />
      <circle cx="8" cy="11" r=".6" />
      <circle cx="12" cy="7.5" r=".6" />
      <circle cx="16" cy="10" r=".6" />
    </>
  ),
  camera: (
    <>
      <P d="M4 8h3l1.5-2.5h7L17 8h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <P d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" />
    </>
  ),
  flame: <P d="M12 3c1 4 5 5.5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z" />,
  star: <P d="M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 17l-5.6 3 1.3-6.2L3 9.5l6.3-.7z" />,
  check: <P d="M5 12.5l4.5 4.5L19 7.5" />,
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <P d="M4 10h16M8 3v4M16 3v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <P d="M12 7v5l3 2" />
    </>
  ),
  album: <P d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h11" />,
  leaf: <P d="M5 19c0-9 5-14 15-14 0 9-4 14-12 14M5 19c2-4 5-7 9-9" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <P d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  sunrise: <P d="M3 18h18M7 18a5 5 0 0110 0M12 6v3M5 11l1.5 1.5M19 11l-1.5 1.5" />,
  pencil: <P d="M4 20l1-4L16 5a2.1 2.1 0 013 3L8 19zM14 7l3 3" />,
  share: (
    <>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <P d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" />
    </>
  ),
  play: <P d="M8 5v14l11-7z" />,
  bucket: <P d="M6 10l6-6 7 7-6 6zM4 20c1-1 2-2 2-3.5M19 14c1 1.5 2 2.5 2 4a2 2 0 01-4 0c0-1.5 1-2.5 2-4" />,
  wand: <P d="M5 19L15 9M14 3.5v3M12.5 5h3M19 10v3M17.5 11.5h3M5 6v2M4 7h2" />,
  loupe: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <P d="M15 15l5 5" />
    </>
  ),
  chest: <P d="M4 10a2 2 0 012-2h12a2 2 0 012 2v9H4zM4 13h16M10.5 12v3h3v-3" />,
  snowflake: <P d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 6.5l2.5-2M9.5 19.5L12 17.5l2.5 2" />,
  phone: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2.5" />
      <P d="M11 18h2" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <P d="M3 17l5-5 4 4 3-3 6 6" />
    </>
  ),
  film: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <P d="M8 4v16M16 4v16M4 9h4M4 15h4M16 9h4M16 15h4" />
    </>
  ),
  inbox: <P d="M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5" />,
  qr: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <P d="M14 14h3v3M20 14v.5M14 20h2M19 17v3h-2" />
    </>
  ),
  wall: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <P d="M3 9.3h18M3 14.6h18M9 4v5.3M15 9.3v5.3M9 14.6V20" />
    </>
  ),
  rain: <P d="M7 15a4 4 0 01.5-8 5 5 0 019.5 1.5A3.3 3.3 0 0117 15zM9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5" />,
  sparkle: <P d="M12 3l2 6 6 3-6 3-2 6-2-6-6-3 6-3z" />,
  grid: <P d="M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16" />,
  gift: (
    <>
      <rect x="4" y="9" width="16" height="11" rx="2" />
      <P d="M3 9h18M12 9v11M12 9C9 9 8 4 10.5 4 12 4 12 7 12 9c0-2 0-5 1.5-5C16 4 15 9 12 9" />
    </>
  ),
  owl: (
    <>
      <P d="M7 9a5 5 0 0110 0v6a5 5 0 01-10 0zM7 6L6 3l3 1.5M17 6l1-3-3 1.5" />
      <circle cx="10" cy="10" r="1.3" />
      <circle cx="14" cy="10" r="1.3" />
      <P d="M12 12.5v1.5" />
    </>
  ),
  feather: <P d="M20 4c-9 0-14 5-14 12l-2 4M20 4c0 8-5 13-12 12M9 15l6-6" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  dot: <circle cx="12" cy="12" r="3.5" />,
  rainbow: <P d="M3 18a9 9 0 0118 0M6 18a6 6 0 0112 0M9 18a3 3 0 016 0" />,
  hourglass: <P d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9" />,
  moon: <P d="M20 14.5A8.5 8.5 0 019.5 4 8.5 8.5 0 1020 14.5z" />,
  clover: (
    <>
      <circle cx="9" cy="9" r="3" />
      <circle cx="15" cy="9" r="3" />
      <circle cx="9" cy="14" r="3" />
      <circle cx="15" cy="14" r="3" />
      <P d="M12 13l4 8" />
    </>
  ),
  firework: (
    <P d="M12 3v5M12 16v5M3 12h5M16 12h5M5.6 5.6l3.5 3.5M14.9 14.9l3.5 3.5M18.4 5.6l-3.5 3.5M9.1 14.9l-3.5 3.5" />
  ),
  cake: (
    <P d="M4 12h16v8H4zM4 16c2 1.5 4-1.5 6 0s4-1.5 6 0 3 .5 4 0M12 12V8M12 3.5c-1 1.5 0 3 0 3s1-1.5 0-3z" />
  ),
  heart: <P d="M12 20s-8-5-8-11a4.5 4.5 0 018-2.5A4.5 4.5 0 0120 9c0 6-8 11-8 11z" />,
};

export function AchievementGlyph({ icon, size = 22 }: { icon: AchievementIcon; size?: number }) {
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
      {GLYPHS[icon]}
    </svg>
  );
}
