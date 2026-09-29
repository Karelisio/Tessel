import type { ReactNode } from 'react';

interface IconProps {
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
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconGallery({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="3" y="4.5" width="18" height="15" rx="3.5" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M4 17.2l4.6-4.6a1.6 1.6 0 012.3 0l5.1 5.1" />
      <path d="M14.2 15.4l1.4-1.4a1.6 1.6 0 012.3 0l2.6 2.6" />
    </Svg>
  );
}

export function IconCamera({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M4.5 8h2.2l1.4-2h7.8l1.4 2h2.2A1.5 1.5 0 0121 9.5v8a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5v-8A1.5 1.5 0 014.5 8z" />
      <circle cx="12" cy="13.2" r="3.6" />
    </Svg>
  );
}

export function IconInfo({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 7.6v.1" />
    </Svg>
  );
}

/** Indicateur de calcul : arc qui tourne (animation CSS, désactivée si « réduire les animations »). */
export function Spinner({ size = 18 }: IconProps) {
  return (
    <svg className="imp-spinner" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.22" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const SCENE_COLS = 16;
const SCENE_ROWS = 10;
type SceneTone = 'sky0' | 'sky1' | 'sky2' | 'sun' | 'far' | 'near';

/** Teinte d'une case du paysage : ciel en dégradé, soleil, deux lignes de collines. */
function sceneTone(col: number, row: number): SceneTone {
  const x = col + 0.5;
  const y = row + 0.5;
  if ((x - 11.6) ** 2 + (y - 3.2) ** 2 <= 2.5 ** 2) return 'sun';
  if (y >= 7.4 + 1.2 * Math.sin(x * 0.75 + 1.1)) return 'near';
  if (y >= 5 + 1.5 * Math.sin(x * 0.5 + 0.3) + 0.6 * Math.sin(x * 1.3)) return 'far';
  return y < 3 ? 'sky0' : y < 5 ? 'sky1' : 'sky2';
}

const SCENE_CELLS = Array.from({ length: SCENE_COLS * SCENE_ROWS }, (_, i) => {
  const col = i % SCENE_COLS;
  const row = Math.floor(i / SCENE_COLS);
  return { col, row, tone: sceneTone(col, row) };
});

/** Petit paysage en mosaïque : une photo devenue tableau à colorier (décoratif). */
export function PixelScene() {
  return (
    <svg className="imp-art" viewBox={`0 0 ${SCENE_COLS * 10} ${SCENE_ROWS * 10}`} aria-hidden>
      {SCENE_CELLS.map(({ col, row, tone }) => (
        <rect
          key={`${col}-${row}`}
          className={`imp-art__${tone}`}
          x={col * 10 + 0.5}
          y={row * 10 + 0.5}
          width={9}
          height={9}
          rx={1.6}
        />
      ))}
    </svg>
  );
}
