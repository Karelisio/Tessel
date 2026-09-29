import { motion } from 'framer-motion';
import { useState } from 'react';
import { locale, tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { formatNumber } from '@/meta/format';
import { PERIOD_BONUS, questRewards, type Quest, type QuestPeriod } from '@/meta/quests';
import { spring, staggerDelay } from '@/theme/motion/tokens';
import { IconCheck, IconReroll } from '@/ui/meta/icons';
import { questLabel, rewardLabel } from '@/ui/meta/labels';

/**
 * Une quête : titre, barre de progression, récompenses. Le remplacement retourne la carte
 * (elle se met de chant, change de quête, puis se déplie).
 */
export function QuestItem({
  q,
  level,
  canReroll,
  onReroll,
  index = 0,
  detailed = false,
}: {
  q: Quest;
  level: number;
  canReroll: boolean;
  onReroll: (id: string) => void;
  index?: number;
  /** Version large (page des quêtes) : récompense visible même une fois la quête faite. */
  detailed?: boolean;
}) {
  const [flipping, setFlipping] = useState(false);
  const n = (v: number) => formatNumber(v, locale());
  const done = q.doneAt !== null;
  const ratio = Math.min(1, q.progress / q.target);
  const rewards = questRewards(q.slot, level);

  const reroll = () => {
    if (flipping) return;
    setFlipping(true);
    window.setTimeout(() => {
      onReroll(q.id);
      setFlipping(false);
    }, 200);
  };

  return (
    <li className="daily-quest-wrap">
      <motion.div
        className="daily-quest"
        data-done={done}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0, rotateY: flipping ? 90 : 0 }}
        transition={{
          type: 'spring',
          ...spring.gentle,
          delay: staggerDelay(index) / 1000,
          rotateY: { duration: 0.2, ease: flipping ? 'easeIn' : 'easeOut' },
        }}
      >
        <div className="daily-quest__head">
          <span className="daily-quest__mark" data-done={done} aria-hidden>
            {done && (
              <motion.span
                initial={{ scale: 0, rotate: -40 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', ...spring.bouncy }}
              >
                <IconCheck size={16} />
              </motion.span>
            )}
          </span>
          <span className="daily-quest__title">{questLabel(q)}</span>
          {!done && canReroll && (
            <motion.button
              type="button"
              className="daily-quest__reroll"
              aria-label={`${tr(t('Remplacer cette quête', 'Replace this quest'))} : ${questLabel(q)}`}
              whileTap={{ rotate: -180, scale: 0.9 }}
              onClick={reroll}
            >
              <IconReroll size={18} />
            </motion.button>
          )}
        </div>
        <div
          className="daily-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={q.target}
          aria-valuenow={q.progress}
          aria-label={questLabel(q)}
        >
          <motion.span
            className="daily-bar__fill"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: ratio }}
            transition={{ type: 'spring', ...spring.gentle, delay: 0.1 + staggerDelay(index) / 1000 }}
          />
        </div>
        <div className="daily-quest__foot">
          <span className="daily-quest__count">
            {n(q.progress)} / {n(q.target)}
          </span>
          <span className="daily-quest__rewards" data-claimed={done}>
            {(!done || detailed) &&
              rewards.map((r) => (
                <span key={rewardLabel(r)} className="daily-reward-chip">
                  {rewardLabel(r)}
                </span>
              ))}
            {done && <span className="daily-quest__got">{tr(t('Récompense reçue', 'Reward received'))}</span>}
          </span>
        </div>
      </motion.div>
    </li>
  );
}

/** Bonus pour l'ensemble des quêtes d'une période. */
export function PeriodBonus({ period, done, total }: { period: QuestPeriod; done: number; total: number }) {
  const complete = total > 0 && done >= total;
  return (
    <p className="daily-bonus" data-complete={complete}>
      <span>
        {complete
          ? tr(t('Toutes accomplies, bravo !', 'All done, well played!'))
          : tr(t(`Toutes les quêtes (${done}/${total}) :`, `Complete them all (${done}/${total}):`))}
      </span>
      {PERIOD_BONUS[period].map((r) => (
        <span key={rewardLabel(r)} className="daily-reward-chip daily-reward-chip--bonus">
          {rewardLabel(r)}
        </span>
      ))}
    </p>
  );
}
