import type { Engine } from '@/engine/Engine';
import type { OpenRequest } from '@/store/nav';

type Origin = NonNullable<OpenRequest['origin']>;

const OPEN_MS = 460;
const CLOSE_MS = 340;
const EASE_OPEN = 'cubic-bezier(0.2, 0.9, 0.25, 1)';
const EASE_CLOSE = 'cubic-bezier(0.4, 0, 0.6, 1)';

function inset(r: DOMRect, radius: number): string {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const v = (n: number) => `${Math.max(0, n).toFixed(1)}px`;
  return `inset(${v(r.top)} ${v(w - r.right)} ${v(h - r.bottom)} ${v(r.left)} round ${String(radius)}px)`;
}

/** Carré occupé à l'écran par l'œuvre (vue d'ensemble), comme la vignette letterboxée. */
function artworkSquare(engine: Engine): DOMRect | null {
  const game = engine.game;
  if (!game) return null;
  const cam = engine.camera;
  const { width, height } = game.grid;
  const [cx, cy] = cam.cellToScreen(width / 2, height / 2);
  const side = Math.max(width, height) * cam.fitScale;
  return new DOMRect(cx - side / 2, cy - side / 2, side, side);
}

/**
 * Transition partagée vignette → grille : l'écran de jeu s'ouvre depuis la vignette touchée,
 * et l'image de la vignette s'envole jusqu'à la place de l'œuvre avant de s'effacer.
 */
export function openFrom(root: HTMLElement, engine: Engine, origin: Origin | undefined): void {
  if (!origin) return;
  root.animate(
    [
      { clipPath: inset(origin.rect, 18) },
      { clipPath: inset(new DOMRect(0, 0, innerWidth, innerHeight), 0) },
    ],
    {
      duration: OPEN_MS,
      easing: EASE_OPEN,
    },
  );
  const target = artworkSquare(engine);
  if (!origin.image || !target) return;
  const img = document.createElement('img');
  img.src = origin.image;
  img.alt = '';
  img.className = 'play__ghost';
  const r = origin.rect;
  Object.assign(img.style, {
    left: `${String(target.left)}px`,
    top: `${String(target.top)}px`,
    width: `${String(target.width)}px`,
    height: `${String(target.height)}px`,
  });
  root.appendChild(img);
  const dx = r.left + r.width / 2 - (target.left + target.width / 2);
  const dy = r.top + r.height / 2 - (target.top + target.height / 2);
  const k = r.width / target.width;
  img
    .animate(
      [
        { transform: `translate(${String(dx)}px, ${String(dy)}px) scale(${String(k)})`, opacity: 1 },
        { transform: 'none', opacity: 1, offset: 0.72 },
        { transform: 'none', opacity: 0 },
      ],
      { duration: OPEN_MS + 220, easing: EASE_OPEN },
    )
    .finished.finally(() => {
      img.remove();
    })
    .catch(() => undefined);
}

/** Retour : l'écran de jeu se referme vers la vignette d'origine (ou s'efface). */
export function closeTo(root: HTMLElement, origin: Origin | undefined): void {
  if (!origin) return;
  root.animate(
    [
      { clipPath: inset(new DOMRect(0, 0, innerWidth, innerHeight), 0) },
      { clipPath: inset(origin.rect, 18) },
    ],
    { duration: CLOSE_MS, easing: EASE_CLOSE },
  );
}
