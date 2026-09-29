import { useEffect, useRef } from 'react';
import { themeColor } from '@/theme/applyTheme';

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  round: boolean;
}

const GRAVITY = 900;
const DRAG = 0.985;

/**
 * Éclat de confettis doux (canvas 2D) depuis un point de l'écran, aux couleurs du thème.
 * `origin` en fraction de l'écran ; une nouvelle valeur de `burst` relance un éclat.
 */
export function Confetti({
  burst,
  origin = [0.5, 0.36],
  count = 90,
}: {
  burst: number;
  origin?: readonly [number, number];
  count?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ox, oy] = origin;

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx || burst <= 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = el.clientWidth;
    const h = el.clientHeight;
    el.width = Math.round(w * dpr);
    el.height = Math.round(h * dpr);
    ctx.scale(dpr, dpr);
    const palette = [
      themeColor('--primary'),
      themeColor('--tertiary'),
      themeColor('--primary-container'),
      themeColor('--secondary-container'),
      '#f5c16c',
      '#ffffff',
    ].filter(Boolean);
    const pieces: Piece[] = [];
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.25;
      const v = 380 + Math.random() * 520;
      pieces.push({
        x: ox * w,
        y: oy * h,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 14,
        w: 5 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        color: palette[i % palette.length] ?? '#f5c16c',
        round: Math.random() < 0.3,
      });
    }
    let last = performance.now();
    let raf = 0;
    const start = last;
    const frame = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const age = (now - start) / 1000;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = Math.max(0, Math.min(1, 3.2 - age));
      for (const p of pieces) {
        p.vx *= DRAG;
        p.vy = p.vy * DRAG + GRAVITY * dt * 0.55;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // flottement : la largeur apparente oscille comme un papier qui tourne
          ctx.fillRect(
            -p.w / 2,
            (-p.h / 2) * Math.abs(Math.cos(p.rot * 1.7)),
            p.w,
            p.h * Math.abs(Math.cos(p.rot * 1.7)),
          );
        }
        ctx.restore();
      }
      if (age < 3.3) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [burst, ox, oy, count]);

  return <canvas ref={canvas} className="confetti" aria-hidden />;
}
