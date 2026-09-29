import type { ReactNode } from 'react';

type P = { size?: number | undefined };

function Svg({ size = 24, children }: P & { children: ReactNode }) {
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

export const IconPencil = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4 20l1.2-4.2L16.6 4.4a2.1 2.1 0 013 3L8.2 18.8 4 20z" />
    <path d="M14.5 6.5l3 3" />
  </Svg>
);

export const IconEraser = ({ size }: P) => (
  <Svg size={size}>
    <path d="M9.5 19.5H20" />
    <path d="M13.2 5.3l5.5 5.5a1.8 1.8 0 010 2.5l-5.4 5.4a1.8 1.8 0 01-1.3.5H9.8a1.8 1.8 0 01-1.3-.5L4.8 15a1.8 1.8 0 010-2.5l6-6a1.8 1.8 0 012.4-.2z" />
    <path d="M8 10.5l6 6" />
  </Svg>
);

export const IconBucket = ({ size }: P) => (
  <Svg size={size}>
    <path d="M5.5 11.5l6-6.2a1.8 1.8 0 012.6 0l4.6 4.7a1.8 1.8 0 010 2.5l-5.6 5.6a1.8 1.8 0 01-2.5 0l-5.1-5.1a1.8 1.8 0 010-1.5z" />
    <path d="M5.4 11.6h13.2" />
    <path d="M20.2 15.2c1 1.4 1.5 2.3 1.5 3a1.5 1.5 0 01-3 0c0-.7.5-1.6 1.5-3z" />
  </Svg>
);

export const IconPipette = ({ size }: P) => (
  <Svg size={size}>
    <path d="M14.5 5.5l4 4" />
    <path d="M16.2 3.8a2.1 2.1 0 013 3l-2.1 2.1-3-3 2.1-2.1z" />
    <path d="M14 7.5l-8.3 8.3a1.8 1.8 0 00-.5 1.1L5 19.3 4 20l.7-1 2.4-.2a1.8 1.8 0 001.1-.5L16.5 10" />
  </Svg>
);

export const IconUndo = ({ size }: P) => (
  <Svg size={size}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 010 11H11" />
  </Svg>
);

export const IconRedo = ({ size }: P) => (
  <Svg size={size}>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 000 11H13" />
  </Svg>
);

export const IconLayers = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 3.5l8.5 4.6-8.5 4.6-8.5-4.6L12 3.5z" />
    <path d="M3.5 12.2L12 16.8l8.5-4.6" />
    <path d="M3.5 16.2L12 20.8l8.5-4.6" />
  </Svg>
);

export const IconPalette = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 3.5a8.5 8.5 0 100 17c1.3 0 2-.9 2-1.8 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a3.5 3.5 0 003.5-3.5C20.5 6.6 16.7 3.5 12 3.5z" />
    <circle cx="7.6" cy="11.2" r="1" />
    <circle cx="10.2" cy="7.4" r="1" />
    <circle cx="14.6" cy="7.4" r="1" />
  </Svg>
);

export const IconPlus = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconEye = ({ size }: P) => (
  <Svg size={size}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const IconEyeOff = ({ size }: P) => (
  <Svg size={size}>
    <path d="M9.9 5.8A9 9 0 0112 5.5C18 5.5 21.5 12 21.5 12a16 16 0 01-2.6 3.4M6.2 7.2A15.6 15.6 0 002.5 12S6 18.5 12 18.5a9 9 0 004-.9" />
    <path d="M9.9 9.9a3 3 0 004.2 4.2" />
    <path d="M4 4l16 16" />
  </Svg>
);

export const IconTrash = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12a1.5 1.5 0 001.5 1.4h6.4a1.5 1.5 0 001.5-1.4l.8-12" />
    <path d="M10 11v5.5M14 11v5.5" />
  </Svg>
);

export const IconCopy = ({ size }: P) => (
  <Svg size={size}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
    <path d="M15.5 8.5V6.5a2 2 0 00-2-2h-7a2 2 0 00-2 2v7a2 2 0 002 2h2" />
  </Svg>
);

export const IconRename = ({ size }: P) => (
  <Svg size={size}>
    <path d="M5 7.5V5.5h14v2M12 5.5v13M9 18.5h6" />
  </Svg>
);

export const IconShare = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="6.5" cy="12" r="2.4" />
    <circle cx="17.5" cy="6" r="2.4" />
    <circle cx="17.5" cy="18" r="2.4" />
    <path d="M8.6 10.8l6.8-3.6M8.6 13.2l6.8 3.6" />
  </Svg>
);

export const IconQr = ({ size }: P) => (
  <Svg size={size}>
    <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5" />
    <path d="M14 14h2.5v2.5H14zM19 14h1.5M14 19.5v1M17.5 18.5H20.5v2" />
  </Svg>
);

export const IconCamera = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4 8.5A2 2 0 016 6.5h1.6a1 1 0 00.8-.4l.9-1.2a1 1 0 01.8-.4h3.8a1 1 0 01.8.4l.9 1.2a1 1 0 00.8.4H18a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2v-9z" />
    <circle cx="12" cy="13" r="3.4" />
  </Svg>
);

export const IconFile = ({ size }: P) => (
  <Svg size={size}>
    <path
      d="M6.5 3.5h7L18.5 8.5v10a2 2 0 01-2 2h-10a2 2 0 01-2-2v-13a2 2 0 012-2z"
      transform="translate(-0.5 0)"
    />
    <path d="M13 3.5V8.5h5.5" transform="translate(-0.5 0)" />
    <path d="M8.5 13.5h6M8.5 16.5h4" />
  </Svg>
);

export const IconPhoto = ({ size }: P) => (
  <Svg size={size}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M4 17l4.6-4.4a1.5 1.5 0 012.1 0L14 16l2-2a1.5 1.5 0 012.1 0L20.5 16.5" />
  </Svg>
);

export const IconImage = IconPhoto;

export const IconDownload = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" />
  </Svg>
);

export const IconUp = ({ size }: P) => (
  <Svg size={size}>
    <path d="M6 14.5l6-6 6 6" />
  </Svg>
);

export const IconDown = ({ size }: P) => (
  <Svg size={size}>
    <path d="M6 9.5l6 6 6-6" />
  </Svg>
);

export const IconMerge = ({ size }: P) => (
  <Svg size={size}>
    <path d="M7 4.5v5a5 5 0 005 5 5 5 0 005-5v-5" />
    <path d="M12 14.5V20M9 17.5l3 3 3-3" />
  </Svg>
);

export const IconFit = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4.5 9V5.5a1 1 0 011-1H9M15 4.5h3.5a1 1 0 011 1V9M19.5 15v3.5a1 1 0 01-1 1H15M9 19.5H5.5a1 1 0 01-1-1V15" />
  </Svg>
);

export const IconCheckSmall = ({ size }: P) => (
  <Svg size={size}>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </Svg>
);

export const IconSparkle = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8L12 3.5z" />
    <path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
  </Svg>
);

/** Symétrie : axes en pointillés sur une petite toile. */
export function IconSymmetry({ kind, size = 24 }: { kind: 'none' | 'x' | 'y' | 'xy'; size?: number }) {
  return (
    <Svg size={size}>
      <rect x="4.5" y="4.5" width="15" height="15" rx="3" strokeWidth="1.8" />
      {(kind === 'x' || kind === 'xy') && <path d="M12 2.8v18.4" strokeDasharray="2.4 2.4" />}
      {(kind === 'y' || kind === 'xy') && <path d="M2.8 12h18.4" strokeDasharray="2.4 2.4" />}
      {kind === 'none' && <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />}
    </Svg>
  );
}

/** Taille du pinceau : un, quatre ou neuf carrés. */
export function IconBrush({ n, size = 24 }: { n: 1 | 2 | 3; size?: number }) {
  const cells = n === 1 ? 1 : n === 2 ? 2 : 3;
  const step = n === 1 ? 6 : n === 2 ? 5 : 4.6;
  const start = 12 - (cells * step) / 2;
  const items: ReactNode[] = [];
  for (let y = 0; y < cells; y++)
    for (let x = 0; x < cells; x++)
      items.push(
        <rect
          key={`${String(x)}-${String(y)}`}
          x={start + x * step + 0.5}
          y={start + y * step + 0.5}
          width={step - 1}
          height={step - 1}
          rx="1"
          fill="currentColor"
          stroke="none"
        />,
      );
  return <Svg size={size}>{items}</Svg>;
}
