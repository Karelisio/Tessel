import { motion } from 'framer-motion';
import { useState } from 'react';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { addDays } from '@/meta/time';
import { spring } from '@/theme/motion/tokens';
import { fmt, formatDay, formatDuration } from './format';
import './stats.css';

export interface DonutPart {
  id: string;
  label: string;
  value: number;
  color: string;
}

const R = 44;
const C = 2 * Math.PI * R;

/** Répartition en anneau ; le total s'affiche au centre, la légende à côté. */
export function Donut({ parts, unit }: { parts: readonly DonutPart[]; unit: string }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  let offset = 0;
  return (
    <div className="st-donut">
      <svg
        viewBox="0 0 120 120"
        role="img"
        aria-label={parts.map((p) => `${p.label} : ${fmt(p.value)}`).join(', ')}
      >
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="16" />
        {total > 0 &&
          parts.map((p, i) => {
            const share = p.value / total;
            const len = Math.max(0, share * C - (parts.filter((x) => x.value > 0).length > 1 ? 3 : 0));
            const start = offset;
            offset += share * C;
            if (p.value <= 0) return null;
            return (
              <motion.circle
                key={p.id}
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={p.color}
                strokeWidth="16"
                strokeDashoffset={-start}
                transform="rotate(-90 60 60)"
                initial={{ strokeDasharray: `0 ${C}` }}
                animate={{ strokeDasharray: `${len} ${C - len}` }}
                transition={{ type: 'spring', ...spring.gentle, delay: 0.1 + i * 0.08 }}
              />
            );
          })}
        <text x="60" y="58" textAnchor="middle" className="st-donut__total">
          {fmt(total)}
        </text>
        <text x="60" y="74" textAnchor="middle" className="st-donut__unit">
          {unit}
        </text>
      </svg>
      <ul className="st-legend">
        {parts.map((p) => (
          <li key={p.id}>
            <i style={{ background: p.color }} />
            <span>{p.label}</span>
            <b>{total > 0 ? `${Math.round((p.value / total) * 100)} %` : '–'}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface DayPoint {
  day: string;
  cells: number;
  timeMs: number;
}

/** Derniers jours en barres arrondies ; toucher une barre en donne le détail. */
export function ActivityChart({
  history,
  today,
  days = 14,
  metric,
}: {
  history: readonly DayPoint[];
  today: string;
  days?: number;
  metric: 'cells' | 'time';
}) {
  const byDay = new Map(history.map((h) => [h.day, h]));
  const points: DayPoint[] = Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i - (days - 1));
    return byDay.get(day) ?? { day, cells: 0, timeMs: 0 };
  });
  const value = (p: DayPoint) => (metric === 'cells' ? p.cells : p.timeMs);
  const max = Math.max(1, ...points.map(value));
  const [picked, setPicked] = useState<number | null>(null);
  const sel = points[picked ?? days - 1];
  const W = 336;
  const H = 132;
  const col = W / days;
  const bw = Math.min(18, col - 6);
  const label = (p: DayPoint) =>
    metric === 'cells' ? `${fmt(p.cells)} ${tr(t('cases', 'cells'))}` : formatDuration(p.timeMs);
  return (
    <div className="st-activity">
      <div className="st-activity__tip" aria-live="polite">
        <span>{sel ? formatDay(sel.day, { weekday: 'long', day: 'numeric', month: 'long' }) : ''}</span>
        <b>{sel ? label(sel) : ''}</b>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H + 22}`}
        className="st-activity__svg"
        role="group"
        aria-label={tr(t('Activité des derniers jours', 'Activity over recent days'))}
      >
        <line x1="0" x2={W} y1={H} y2={H} stroke="var(--outline)" />
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="var(--outline)" strokeDasharray="2 5" />
        {points.map((p, i) => {
          const h = value(p) > 0 ? Math.max(6, (value(p) / max) * (H - 8)) : 3;
          const x = i * col + (col - bw) / 2;
          const active = (picked ?? days - 1) === i;
          const [y = 1970, m = 1, d = 1] = p.day.split('-').map(Number);
          const wd = new Intl.DateTimeFormat(tr(t('fr-FR', 'en-US')), { weekday: 'narrow' }).format(
            new Date(y, m - 1, d),
          );
          return (
            <g
              key={p.day}
              role="button"
              tabIndex={0}
              aria-label={`${formatDay(p.day)} : ${label(p)}`}
              className="st-bar"
              onClick={() => {
                setPicked(i);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setPicked(i);
              }}
            >
              <rect x={i * col} y={0} width={col} height={H + 22} fill="transparent" />
              <motion.rect
                x={x}
                width={bw}
                rx={Math.min(6, bw / 2)}
                fill={value(p) > 0 ? 'var(--primary)' : 'var(--surface-3)'}
                opacity={active || value(p) === 0 ? 1 : 0.55}
                initial={{ y: H, height: 0 }}
                animate={{ y: H - h, height: h }}
                transition={{ type: 'spring', ...spring.gentle, delay: i * 0.025 }}
              />
              <text
                x={i * col + col / 2}
                y={H + 16}
                textAnchor="middle"
                className="st-bar__day"
                data-today={i === days - 1}
              >
                {wd}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Barre horizontale d'une répartition (nom, valeur, remplissage relatif au maximum). */
export function RowBar({
  label,
  value,
  max,
  text,
  color = 'var(--primary)',
}: {
  label: string;
  value: number;
  max: number;
  text: string;
  color?: string;
}) {
  return (
    <div className="st-rowbar">
      <div className="st-rowbar__head">
        <span>{label}</span>
        <b>{text}</b>
      </div>
      <span className="st-rowbar__track">
        <motion.span
          className="st-rowbar__fill"
          style={{ background: color }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: max > 0 ? Math.min(1, value / max) : 0 }}
          transition={{ type: 'spring', ...spring.gentle }}
        />
      </span>
    </div>
  );
}
