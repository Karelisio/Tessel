import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef } from 'react';
import type { ProjectMeta } from '@/db/ProgressStore';
import { spring, staggerDelay } from '@/theme/motion/tokens';
import { Skeleton } from '@/ui/kit';
import { GLITTER_BOLD, GLITTER_FINE } from './glitter';
import { trackFrame, trackGlint } from './light';
import { displayTitle, frameGeometry, modeName, withVars } from './model';
import { useSeen, useThumb } from './thumbs';

/** Reflets d'un diamant : trois couches en surimpression, découpées dans la silhouette de l'œuvre. */
export function Glint() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    return el ? trackGlint(el) : undefined;
  }, []);
  return (
    <span
      ref={ref}
      className="gg-glint"
      style={withVars({
        '--glitter-a': GLITTER_FINE,
        '--glitter-b': GLITTER_BOLD,
      })}
      aria-hidden
    >
      <i className="gg-glint__prism" />
      <i className="gg-glint__band" />
      <i className="gg-glint__dust" />
    </span>
  );
}

/** Espace réservé pendant le rendu de la miniature. */
export function GhostFrame({ failed = false }: { failed?: boolean }) {
  return (
    <span className="gg-ghost" data-failed={failed}>
      <Skeleton width="100%" height="100%" radius={6} />
    </span>
  );
}

/** Une œuvre accrochée au mur : cadre, ombre portée, reflets (diamant) et cartel. */
export function ArtFrame({
  project,
  index,
  opened,
  onOpen,
}: {
  project: ProjectMeta;
  index: number;
  opened: boolean;
  onOpen: (id: string, from: DOMRect | null) => void;
}) {
  const reduced = useReducedMotion();
  const [seenRef, seen] = useSeen();
  const { url, failed } = useThumb(
    { id: project.id, updatedAt: project.updatedAt, frame: project.frame, size: 480 },
    seen,
  );
  const hang = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = hang.current;
    return el ? trackFrame(el) : undefined;
  }, []);
  const geometry = useMemo(
    () => frameGeometry(project.width, project.height),
    [project.width, project.height],
  );
  const title = displayTitle(project);
  const mode = modeName(project.mode);
  // les cadres tombent d'un côté puis de l'autre, comme accrochés à la main
  const swing = index % 2 === 0 ? 5 : -5;
  const delay = staggerDelay(index % 8, 55, 440) / 1000;
  return (
    <figure ref={seenRef} className="gg-item" style={geometry}>
      <motion.button
        ref={hang}
        type="button"
        className="gg-hang"
        aria-label={`${title}, ${mode}`}
        whileTap={{ scale: 0.965 }}
        transition={{ type: 'spring', ...spring.snappy }}
        onClick={(e) => {
          onOpen(project.id, e.currentTarget.querySelector('.gg-plate')?.getBoundingClientRect() ?? null);
        }}
      >
        <span className="gg-plate" data-art={project.id} data-open={opened}>
          {url ? (
            <>
              <span className="gg-cast" aria-hidden />
              <motion.span
                className="gg-swing"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: -26, rotate: swing, scale: 0.93 }}
                animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
                transition={{ type: 'spring', ...spring.bouncy, damping: 11, delay }}
              >
                <motion.img className="gg-art" src={url} alt="" draggable={false} />
                {project.mode === 'diamond' && <Glint />}
              </motion.span>
            </>
          ) : (
            <GhostFrame failed={failed} />
          )}
        </span>
      </motion.button>
      <figcaption className="gg-cartel">
        <strong>{title}</strong>
        <span>{mode}</span>
      </figcaption>
    </figure>
  );
}

/** Carte fantôme du chargement des données. */
export function GhostItem({ index }: { index: number }) {
  return (
    <figure
      className="gg-item"
      style={withVars({ '--ar': index % 3 === 1 ? 0.82 : index % 3 === 2 ? 1.25 : 1 })}
    >
      <div className="gg-hang">
        <span className="gg-plate">
          <GhostFrame />
        </span>
      </div>
      <figcaption className="gg-cartel gg-cartel--ghost">
        <Skeleton width="70%" height={12} radius={6} />
        <Skeleton width="40%" height={10} radius={5} />
      </figcaption>
    </figure>
  );
}
