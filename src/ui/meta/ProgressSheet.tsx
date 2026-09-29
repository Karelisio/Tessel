import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { locale, tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { formatNumber } from '@/meta/format';
import { questRewards, type Quest } from '@/meta/quests';
import { mergeRewards, type ChestSize, type Reward } from '@/meta/rewards';
import { STREAK } from '@/meta/streak';
import { useMetaStore } from '@/store/meta';
import { spring } from '@/theme/motion/tokens';
import { IconCheck, IconChest, IconFlame, IconReroll, IconSnow, IconTrophy } from './icons';
import { CHEST_NAMES, questLabel, rewardLabel } from './labels';

interface QuestRowProps {
  q: Quest;
  level: number;
  canReroll: boolean;
  onReroll: () => void;
}

function QuestRow({ q, level, canReroll, onReroll }: QuestRowProps) {
  const done = q.doneAt !== null;
  const ratio = Math.min(1, q.progress / q.target);
  return (
    <motion.li layout className="quest" data-done={done}>
      <div className="quest__head">
        <span className="quest__title">{questLabel(q)}</span>
        {done ? (
          <motion.span
            className="quest__check"
            initial={{ scale: 0, rotate: -40 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', ...spring.bouncy }}
          >
            <IconCheck size={16} />
          </motion.span>
        ) : (
          canReroll && (
            <motion.button
              className="quest__reroll"
              aria-label={tr(t('Remplacer cette quête', 'Replace this quest'))}
              whileTap={{ rotate: -180, scale: 0.9 }}
              onClick={onReroll}
            >
              <IconReroll size={16} />
            </motion.button>
          )
        )}
      </div>
      <div className="quest__bar">
        <motion.span
          className="quest__fill"
          initial={false}
          animate={{ scaleX: ratio }}
          transition={{ type: 'spring', ...spring.gentle }}
        />
      </div>
      <div className="quest__meta">
        <span>
          {formatNumber(q.progress, locale())} / {formatNumber(q.target, locale())}
        </span>
        <span>{questRewards(q.slot, level).map(rewardLabel).join(' · ')}</span>
      </div>
    </motion.li>
  );
}

function ChestRow({ size, count }: { size: ChestSize; count: number }) {
  const service = useMetaStore((s) => s.service);
  const refresh = useMetaStore((s) => s.refresh);
  const [opened, setOpened] = useState<Reward[] | null>(null);
  const [shaking, setShaking] = useState(false);
  const open = () => {
    if (!service || shaking) return;
    setShaking(true);
    // secousse, puis ouverture : les objets jaillissent un par un
    setTimeout(() => {
      const got = service.openChest(size);
      setShaking(false);
      setOpened(got ? mergeRewards(got) : null);
      refresh();
    }, 520);
  };
  return (
    <li className="chest">
      <motion.span
        className="chest__icon"
        animate={
          shaking
            ? { rotate: [0, -12, 10, -8, 6, 0], scale: [1, 1.05, 1.1, 1.12, 1.15, 1.2] }
            : { rotate: 0, scale: 1 }
        }
        transition={{ duration: 0.5 }}
      >
        <IconChest size={26} />
      </motion.span>
      <span className="chest__name">
        {tr(CHEST_NAMES[size])} <strong>×{count}</strong>
      </span>
      <motion.button
        className="btn btn--small btn--primary"
        whileTap={{ scale: 0.92 }}
        disabled={count === 0 || shaking}
        onClick={open}
      >
        {tr(t('Ouvrir', 'Open'))}
      </motion.button>
      <AnimatePresence>
        {opened && (
          <motion.ul
            className="chest__loot"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onClick={() => {
              setOpened(null);
            }}
          >
            {opened.map((r, i) => (
              <motion.li
                key={rewardLabel(r)}
                initial={{ opacity: 0, y: 14, scale: 0.6 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', ...spring.bouncy, delay: 0.05 + i * 0.09 }}
              >
                {rewardLabel(r)}
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}

/** Panneau de progression (version minimale avant l'écran Profil) : niveau, série, quêtes, coffres. */
export function ProgressSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const snap = useMetaStore((s) => s.snap);
  const service = useMetaStore((s) => s.service);
  const refresh = useMetaStore((s) => s.refresh);
  if (!snap) return null;
  const { level, streak, quests, canReroll, chests, freezes } = snap;
  const weekLeft = snap.weekDaysLeft;
  const reroll = (id: string) => {
    service?.rerollQuest(id);
    refresh();
  };
  const daily = quests.filter((q) => q.period === 'daily');
  const weekly = quests.filter((q) => q.period === 'weekly');
  const n = (v: number) => formatNumber(v, locale());
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.section
            className="progress-sheet"
            role="dialog"
            aria-label={tr(t('Progression', 'Progress'))}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', ...spring.sheet }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="sheet-grip" />
            <header className="ps-level">
              <span className="ps-level__badge">{level.level}</span>
              <div className="ps-level__info">
                <strong>
                  {tr(t('Niveau', 'Level'))} {level.level}
                </strong>
                <div className="ps-bar">
                  <motion.span
                    className="ps-bar__fill"
                    initial={false}
                    animate={{ scaleX: level.progress }}
                    transition={{ type: 'spring', ...spring.gentle }}
                  />
                </div>
                <span className="ps-muted">
                  {n(level.into)} / {n(level.span)} XP
                </span>
              </div>
            </header>

            <div className="ps-card ps-streak">
              <span className={`ps-streak__flame ps-streak__flame--${streak.status}`}>
                <IconFlame size={30} />
              </span>
              <div>
                <strong>
                  {streak.current}{' '}
                  {tr(
                    streak.current > 1 ? t('jours de série', 'day streak') : t('jour de série', 'day streak'),
                  )}
                </strong>
                <span className="ps-muted">
                  {streak.status === 'done'
                    ? tr(t('Journée validée, à demain', 'Day complete, see you tomorrow'))
                    : tr(
                        t(
                          `Pose ${STREAK.cellsToValidate - Math.min(streak.todayCells, STREAK.cellsToValidate)} cases pour valider aujourd’hui`,
                          `Place ${STREAK.cellsToValidate - Math.min(streak.todayCells, STREAK.cellsToValidate)} cells to complete today`,
                        ),
                      )}
                </span>
              </div>
              <span className="ps-freezes" aria-label={tr(t('Jokers', 'Streak freezes'))}>
                {Array.from({ length: STREAK.maxFreezes }, (_, i) => (
                  <span key={i} data-on={i < freezes}>
                    <IconSnow size={16} />
                  </span>
                ))}
              </span>
            </div>

            <h3 className="ps-title">{tr(t('Quêtes du jour', 'Daily quests'))}</h3>
            <ul className="quests">
              {daily.map((q) => (
                <QuestRow
                  key={q.id + q.template}
                  q={q}
                  level={level.level}
                  canReroll={canReroll}
                  onReroll={() => {
                    reroll(q.id);
                  }}
                />
              ))}
            </ul>

            <h3 className="ps-title">
              {tr(t('Quêtes de la semaine', 'Weekly quests'))}
              <span className="ps-muted"> · {tr(t(`encore ${weekLeft} j`, `${weekLeft} days left`))}</span>
            </h3>
            <ul className="quests">
              {weekly.map((q) => (
                <QuestRow
                  key={q.id + q.template}
                  q={q}
                  level={level.level}
                  canReroll={canReroll}
                  onReroll={() => {
                    reroll(q.id);
                  }}
                />
              ))}
            </ul>

            {(chests.small > 0 || chests.medium > 0 || chests.large > 0) && (
              <>
                <h3 className="ps-title">{tr(t('Coffres', 'Chests'))}</h3>
                <ul className="chests">
                  {(['small', 'medium', 'large'] as const)
                    .filter((size) => chests[size] > 0)
                    .map((size) => (
                      <ChestRow key={size} size={size} count={chests[size]} />
                    ))}
                </ul>
              </>
            )}

            <div className="ps-card ps-achievements">
              <IconTrophy size={22} />
              <span>
                {tr(t('Succès', 'Achievements'))} <strong>{snap.achievements}</strong> / 150
              </span>
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}
