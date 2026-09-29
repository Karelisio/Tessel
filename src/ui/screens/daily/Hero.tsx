import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useRef, useState } from 'react';
import { getCategory } from '@/content/categories';
import { dailyArtwork } from '@/content/daily';
import type { ProjectMeta } from '@/db/ProgressStore';
import { locale, tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { formatNumber } from '@/meta/format';
import type { DayKey } from '@/meta/time';
import { spring } from '@/theme/motion/tokens';
import { Button, Card, Skeleton } from '@/ui/kit';
import { Thumb } from '@/ui/library/Thumb';
import { ProjectThumb } from '@/ui/library/ProjectThumb';
import { dayLabel } from './common';
import { Burst, GiftBox, type GiftPhase } from './GiftBox';
import { openDaily } from './open';
import { giftOpened, markGiftOpened } from './storage';

const ART = 220;

/**
 * Œuvre du jour. La première fois, une boîte cadeau attend d'être ouverte ; ensuite
 * la carte montre l'aperçu, l'avancement et le bouton pour colorier.
 */
export function Hero({
  day,
  projects,
  index = 0,
}: {
  day: DayKey;
  projects: ProjectMeta[] | undefined;
  index?: number;
}) {
  const art = dailyArtwork(day);
  const [phase, setPhase] = useState<GiftPhase>(() => (giftOpened(day) ? 'open' : 'closed'));
  const stage = useRef<HTMLDivElement>(null);
  const load = useMemo(() => () => Promise.resolve(dailyArtwork(day).grid()), [day]);
  const project = projects?.find((p) => p.artworkId === art.id);
  const ratio = project && project.total > 0 ? Math.min(1, project.filled / project.total) : 0;
  const done = project?.completedAt != null;
  // « 100 % » est réservé à l'œuvre terminée
  const percent = done ? 100 : Math.min(99, Math.floor(ratio * 100));
  const started = project !== undefined && project.filled > 0;
  const revealed = phase === 'reveal' || phase === 'open';

  const openGift = () => {
    if (phase !== 'closed') return;
    setPhase('opening');
    markGiftOpened(day);
    window.setTimeout(() => {
      setPhase('reveal');
    }, 620);
    window.setTimeout(() => {
      setPhase('open');
    }, 1500);
  };

  const category = getCategory(art.category);
  const n = (v: number) => formatNumber(v, locale());

  return (
    <Card index={index} className="daily-hero">
      <div className="daily-hero__top">
        <span className="daily-pill">{tr(t('Œuvre du jour', 'Artwork of the day'))}</span>
        <span className="daily-hero__date">
          {dayLabel(day, { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      <div className="daily-hero__stage" ref={stage} data-gift={!revealed}>
        <span className="daily-hero__halo" aria-hidden />
        {(phase === 'opening' || phase === 'reveal') && <Burst delay={0.28} />}
        {phase !== 'open' && <GiftBox phase={phase} onOpen={openGift} />}
        {revealed &&
          (projects === undefined ? (
            <Skeleton width={ART} height={ART} radius={14} />
          ) : (
            <motion.div
              className="daily-hero__art"
              initial={phase === 'reveal' ? { scale: 0.35, opacity: 0, y: 40, rotate: -8 } : false}
              animate={{ scale: 1, opacity: 1, y: 0, rotate: 0 }}
              transition={{ type: 'spring', ...spring.bouncy }}
              whileTap={{ scale: 0.97 }}
              role="button"
              tabIndex={0}
              aria-label={`${tr(t('Colorier', 'Color'))} : ${tr(art.title)}`}
              onClick={() => {
                openDaily(day, stage.current);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') openDaily(day, stage.current);
              }}
            >
              {project ? (
                <ProjectThumb id={project.id} size={ART} />
              ) : (
                <Thumb id={art.id} load={load} size={ART} />
              )}
              {done && (
                <motion.span
                  className="daily-hero__done"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', ...spring.bouncy, delay: 0.3 }}
                >
                  {tr(t('Terminée', 'Done'))}
                </motion.span>
              )}
            </motion.div>
          ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {revealed ? (
          <motion.div
            key="info"
            className="daily-hero__info"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: phase === 'reveal' ? 0.3 : 0 }}
          >
            <h2 className="daily-hero__title">{tr(art.title)}</h2>
            <p className="daily-hero__meta">
              {tr(category.name)} · {art.width} × {art.height}
            </p>
            {started && !done && (
              <div className="daily-hero__progress">
                <div
                  className="daily-bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                  aria-label={tr(t('Avancement de l’œuvre du jour', 'Progress on today’s artwork'))}
                >
                  <motion.span
                    className="daily-bar__fill"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: ratio }}
                    transition={{ type: 'spring', ...spring.gentle }}
                  />
                </div>
                <span className="daily-hero__pct">
                  {percent} % · {n(project.filled)} / {n(project.total)}
                </span>
              </div>
            )}
            <div className="daily-cta">
              <Button
                variant="filled"
                onClick={() => {
                  openDaily(day, stage.current);
                }}
              >
                {done
                  ? tr(t('Revoir mon œuvre', 'View my artwork'))
                  : started
                    ? tr(t('Continuer', 'Continue'))
                    : tr(t('Colorier', 'Color'))}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="teaser" className="daily-hero__info" exit={{ opacity: 0, y: -6 }}>
            <h2 className="daily-hero__title">{tr(t('Une surprise t’attend', 'A surprise awaits'))}</h2>
            <p className="daily-hero__meta">
              {tr(
                t(
                  'Touche le cadeau pour découvrir l’œuvre du jour',
                  'Tap the gift to reveal today’s artwork',
                ),
              )}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
