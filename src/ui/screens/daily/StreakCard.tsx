import { motion } from 'framer-motion';
import { locale, tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { formatNumber } from '@/meta/format';
import { milestoneRewards, STREAK } from '@/meta/streak';
import { addDays, type DayKey } from '@/meta/time';
import type { MetaSnapshot } from '@/store/meta';
import { spring } from '@/theme/motion/tokens';
import { Card, ProgressRing, Skeleton } from '@/ui/kit';
import { IconCheck, IconSnow } from '@/ui/meta/icons';
import { rewardLabel } from '@/ui/meta/labels';
import { dayLabel, flameLevel } from './common';
import { Flame } from './Flame';

type History = { day: string; cells: number }[] | undefined;

/** Les 7 derniers jours (aujourd'hui en dernier), d'après l'historique quotidien. */
function WeekStrip({ snap, history }: { snap: MetaSnapshot; history: History }) {
  const days: DayKey[] = Array.from({ length: 7 }, (_, i) => addDays(snap.day, i - 6));
  return (
    <ol className="daily-week" aria-label={tr(t('Les 7 derniers jours', 'The last 7 days'))}>
      {days.map((d, i) => {
        const today = i === 6;
        const cells = today ? snap.streak.todayCells : (history?.find((h) => h.day === d)?.cells ?? 0);
        const ok = cells >= STREAK.cellsToValidate;
        const letter = dayLabel(d, { weekday: 'narrow' });
        const full = dayLabel(d, { weekday: 'long', day: 'numeric', month: 'long' });
        const state = ok
          ? tr(t('journée validée', 'day completed'))
          : today
            ? tr(t('aujourd’hui', 'today'))
            : tr(t('non validée', 'not completed'));
        return (
          <li key={d} className="daily-week__day" data-today={today} aria-label={`${full} : ${state}`}>
            <span className="daily-week__letter">{letter}</span>
            {today && !ok ? (
              <ProgressRing
                value={cells / STREAK.cellsToValidate}
                size={32}
                stroke={4}
                color="var(--tertiary)"
              />
            ) : (
              <motion.span
                className="daily-week__dot"
                data-ok={ok}
                initial={ok ? { scale: 0.4 } : false}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', ...spring.bouncy, delay: 0.25 + i * 0.05 }}
              >
                {ok && <IconCheck size={16} />}
              </motion.span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Série de jours : flamme vivante, record, jokers, progression du jour et semainier. */
export function StreakCard({
  snap,
  history,
  index = 0,
}: {
  snap: MetaSnapshot;
  history: History;
  index?: number;
}) {
  const { streak, freezes } = snap;
  const n = (v: number) => formatNumber(v, locale());
  const level = flameLevel(streak.current);
  const left = Math.max(0, STREAK.cellsToValidate - streak.todayCells);
  const ratio = Math.min(1, streak.todayCells / STREAK.cellsToValidate);
  const next = STREAK.milestones.find((m) => m > streak.current);
  const status =
    streak.status === 'done'
      ? tr(t('Journée validée : à demain !', 'Day complete: see you tomorrow!'))
      : streak.status === 'pending'
        ? tr(
            t(
              `Encore ${n(left)} cases pour garder ta série`,
              `${n(left)} more cells to keep your streak going`,
            ),
          )
        : tr(
            t(
              `Pose ${n(STREAK.cellsToValidate)} cases pour allumer ta flamme`,
              `Place ${n(STREAK.cellsToValidate)} cells to light your flame`,
            ),
          );
  return (
    <Card index={index} className="daily-streak">
      <div className="daily-streak__head">
        <div className="daily-streak__flame" data-status={streak.status}>
          <Flame level={level} size={58} dim={streak.status === 'pending'} />
        </div>
        <div className="daily-streak__count">
          <strong className="daily-streak__num">{n(streak.current)}</strong>
          <span className="daily-streak__label">
            {streak.current === 0
              ? tr(t('à allumer', 'to light up'))
              : tr(
                  streak.current > 1
                    ? t('jours de suite', 'days in a row')
                    : t('jour de suite', 'day in a row'),
                )}
          </span>
          <span className="daily-streak__best">
            {tr(t('Record', 'Best'))} : {n(Math.max(streak.best, streak.current))}
          </span>
        </div>
        <div
          className="daily-freezes"
          role="img"
          aria-label={tr(
            t(
              `${freezes} joker${freezes > 1 ? 's' : ''} sur ${STREAK.maxFreezes}`,
              `${freezes} of ${STREAK.maxFreezes} streak freezes`,
            ),
          )}
        >
          <span className="daily-freezes__row">
            {Array.from({ length: STREAK.maxFreezes }, (_, i) => (
              <span key={i} className="daily-freezes__icon" data-on={i < freezes}>
                <IconSnow size={18} />
              </span>
            ))}
          </span>
          <span className="daily-freezes__label">{tr(t('Jokers', 'Freezes'))}</span>
        </div>
      </div>

      <div className="daily-streak__today">
        <div className="daily-streak__today-text">
          <span>{status}</span>
          <span className="daily-streak__cells">
            {n(Math.min(streak.todayCells, STREAK.cellsToValidate))} / {STREAK.cellsToValidate}
          </span>
        </div>
        <div
          className="daily-bar daily-bar--warm"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={STREAK.cellsToValidate}
          aria-valuenow={Math.min(streak.todayCells, STREAK.cellsToValidate)}
          aria-label={tr(t('Cases posées aujourd’hui', 'Cells placed today'))}
        >
          <motion.span
            className="daily-bar__fill"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: ratio }}
            transition={{ type: 'spring', ...spring.gentle }}
          />
        </div>
      </div>

      {history === undefined ? (
        <div className="daily-week">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} width={32} height={50} radius={16} />
          ))}
        </div>
      ) : (
        <WeekStrip snap={snap} history={history} />
      )}

      {next !== undefined && (
        <p className="daily-streak__next">
          {tr(t('Prochain palier', 'Next milestone'))} : {next} {tr(t('jours', 'days'))} ·{' '}
          {milestoneRewards(next).map(rewardLabel).join(', ')}
        </p>
      )}
    </Card>
  );
}
