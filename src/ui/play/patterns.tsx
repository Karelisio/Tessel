import { useId, type ReactNode } from 'react';

/** Côté d'une case en unités SVG (les motifs reprennent les proportions de ceux de la grille). */
const C = 36;
const W = 3.2;

function tile(k: number, ink: string): { size: [number, number]; transform?: string; body: ReactNode } {
  const line = { stroke: ink, strokeWidth: W, fill: 'none' } as const;
  const s = 0.34 * C;
  switch (k) {
    case 0:
      return { size: [C / 2, C / 2], body: <circle cx={C / 4} cy={C / 4} r={2.6} fill={ink} /> };
    case 1:
    case 3:
    case 4:
      return {
        size: [s, s],
        ...(k !== 1 && { transform: `rotate(${k === 3 ? -45 : 45})` }),
        body: <line x1={0} y1={s / 2} x2={s} y2={s / 2} {...line} />,
      };
    case 2:
      return { size: [s, s], body: <line x1={s / 2} y1={0} x2={s / 2} y2={s} {...line} /> };
    case 5:
    case 6:
      return {
        size: [C / 2, C / 2],
        ...(k === 6 && { transform: 'rotate(45)' }),
        body: <path d={`M${C / 4} 0V${C / 2}M0 ${C / 4}H${C / 2}`} {...line} strokeWidth={W * 0.8} />,
      };
    case 7:
      return {
        size: [C / 2, C / 2],
        body: <rect x={C / 4 - 3.6} y={C / 4 - 3.6} width={7.2} height={7.2} {...line} strokeWidth={2.2} />,
      };
    case 8:
      return {
        size: [C, C],
        body: (
          <g {...line} strokeWidth={W * 0.9}>
            <circle cx={C / 2} cy={C / 2} r={4} />
            <circle cx={C / 2} cy={C / 2} r={12} />
          </g>
        ),
      };
    case 9: {
      const h = 0.4 * C;
      return {
        size: [C / 2, h],
        body: (
          <path
            d={`M0 ${h / 2}C${C / 8} ${h / 2 - 5},${C / 8} ${h / 2 - 5},${C / 4} ${h / 2}S${(3 * C) / 8} ${h / 2 + 5},${C / 2} ${h / 2}`}
            {...line}
          />
        ),
      };
    }
    case 10: {
      const h = 0.4 * C;
      return {
        size: [C / 2, h],
        body: <path d={`M0 ${h / 2 - 2.2}L${C / 4} ${h / 2 + 2.2}L${C / 2} ${h / 2 - 2.2}`} {...line} />,
      };
    }
    default:
      return {
        size: [C / 2, C / 2],
        body: <path d={`M${C / 4} ${C / 4 - 3.6}l3.6 3.6l-3.6 3.6l-3.6-3.6z`} fill={ink} />,
      };
  }
}

/** Motif d'aide au daltonisme de la couleur `index` (le même que sur la grille), en surimpression. */
export function ColorPattern({ index, ink, className }: { index: number; ink: string; className?: string }) {
  const id = useId();
  const t = tile(index % 12, ink);
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern
          id={id}
          width={t.size[0]}
          height={t.size[1]}
          patternUnits="userSpaceOnUse"
          {...(t.transform !== undefined && { patternTransform: t.transform })}
        >
          {t.body}
        </pattern>
      </defs>
      <rect width="100" height="100" fill={`url(#${id})`} />
    </svg>
  );
}
