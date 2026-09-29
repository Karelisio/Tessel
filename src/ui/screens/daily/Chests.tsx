import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { CHEST_SIZES, mergeRewards, type ChestSize, type Reward } from '@/meta/rewards';
import { useMetaStore } from '@/store/meta';
import { spring } from '@/theme/motion/tokens';
import { Button, Card, IconButton } from '@/ui/kit';
import { IconClose } from '@/ui/kit/icons';
import { IconBucket, IconChest, IconLoupe, IconSnow, IconStar, IconTrophy, IconWand } from '@/ui/meta/icons';
import { CHEST_NAMES, rewardLabel } from '@/ui/meta/labels';
import { Burst } from './GiftBox';

/** Coffre illustré : trois tailles, couvercle qui se soulève sur un flot de lumière. */
export function ChestArt({ size, open = false }: { size: ChestSize; open?: boolean }) {
  const scale = size === 'small' ? 0.86 : size === 'large' ? 1.06 : 0.97;
  const clip = `${useId().replace(/:/g, '')}lid`;
  return (
    <svg viewBox="0 0 120 110" className="daily-chest-art" data-size={size} aria-hidden>
      <g transform={`translate(60 100) scale(${scale}) translate(-60 -100)`}>
        <ellipse cx="60" cy="100" rx="44" ry="6" style={{ fill: 'var(--on-surface)', opacity: 0.12 }} />
        <motion.ellipse
          cx="60"
          cy="52"
          rx="34"
          ry="9"
          style={{ fill: 'var(--daily-flame-core)' }}
          initial={false}
          animate={{ opacity: open ? 1 : 0, scaleX: open ? 1.15 : 0.5 }}
          transition={{ duration: 0.5 }}
        />
        <rect x="14" y="50" width="92" height="46" rx="9" className="daily-chest__body" />
        <rect x="14" y="50" width="92" height="12" rx="6" className="daily-chest__shade" />
        <rect x="27" y="50" width="10" height="46" className="daily-chest__band" />
        <rect x="83" y="50" width="10" height="46" className="daily-chest__band" />
        <motion.g
          initial={false}
          animate={open ? { y: -26, rotate: -22 } : { y: 0, rotate: 0 }}
          transition={{ type: 'spring', ...spring.bouncy }}
          style={{ originX: 0, originY: 1 }}
        >
          <clipPath id={clip}>
            <path d="M14 54V44a30 30 0 0130-30h32a30 30 0 0130 30v10z" />
          </clipPath>
          <path d="M14 54V44a30 30 0 0130-30h32a30 30 0 0130 30v10z" className="daily-chest__lid" />
          <g clipPath={`url(#${clip})`}>
            <rect x="27" y="14" width="10" height="40" className="daily-chest__band" />
            <rect x="83" y="14" width="10" height="40" className="daily-chest__band" />
          </g>
        </motion.g>
        <motion.g
          initial={false}
          animate={{ y: open ? 9 : 0 }}
          transition={{ type: 'spring', ...spring.bouncy }}
        >
          <rect x="51" y="46" width="18" height="20" rx="5" className="daily-chest__lock" />
          <circle cx="60" cy="55" r="2.6" className="daily-chest__keyhole" />
        </motion.g>
      </g>
    </svg>
  );
}

function RewardIcon({ r }: { r: Reward }) {
  switch (r.kind) {
    case 'xp':
      return <IconStar size={30} />;
    case 'tool':
      return r.tool === 'loupe' ? (
        <IconLoupe size={30} />
      ) : r.tool === 'bucket' ? (
        <IconBucket size={30} />
      ) : (
        <IconWand size={30} />
      );
    case 'freeze':
      return <IconSnow size={30} />;
    case 'chest':
      return <IconChest size={30} />;
    case 'unlock':
      return <IconTrophy size={30} />;
  }
}

/** Carte de récompense : arrive face cachée, puis se retourne. */
function RewardCard({ r, i }: { r: Reward; i: number }) {
  const delay = 0.55 + i * 0.16;
  return (
    <motion.li
      className="daily-loot"
      initial={{ opacity: 0, y: 40, scale: 0.6 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', ...spring.bouncy, delay }}
    >
      <motion.div
        className="daily-loot__flip"
        initial={{ rotateY: 180 }}
        animate={{ rotateY: 0 }}
        transition={{ type: 'spring', stiffness: 150, damping: 17, delay: delay + 0.32 }}
      >
        <div className="daily-loot__face daily-loot__face--front" data-kind={r.kind}>
          <span className="daily-loot__icon">
            <RewardIcon r={r} />
          </span>
          <strong className="daily-loot__label">{rewardLabel(r)}</strong>
        </div>
        <div className="daily-loot__face daily-loot__face--back" aria-hidden>
          <IconStar size={26} />
        </div>
      </motion.div>
    </motion.li>
  );
}

type Phase = 'idle' | 'shaking' | 'open';

/** Ouverture plein écran : le coffre tremble, s'ouvre sur un éclat de lumière, les récompenses se dévoilent. */
function ChestOpener({ initial, onClose }: { initial: ChestSize; onClose: () => void }) {
  const size = initial;
  const service = useMetaStore((s) => s.service);
  const refresh = useMetaStore((s) => s.refresh);
  const remaining = useMetaStore((s) => s.snap?.chests[size] ?? 0);
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('idle');
  const [loot, setLoot] = useState<Reward[]>([]);
  const [round, setRound] = useState(0);

  const openIt = () => {
    if (phase !== 'idle' || !service) return;
    setPhase('shaking');
    window.setTimeout(
      () => {
        const got = service.openChest(size);
        refresh();
        if (!got) {
          onClose();
          return;
        }
        setLoot(mergeRewards(got));
        setPhase('open');
      },
      reduced ? 200 : 900,
    );
  };
  const again = () => {
    setLoot([]);
    setPhase('idle');
    setRound((r) => r + 1);
  };
  const name = tr(CHEST_NAMES[size]);
  const opened = phase === 'open';

  return createPortal(
    <motion.div
      className="daily-opener daily-portal"
      role="dialog"
      aria-modal="true"
      aria-label={name}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="daily-opener__scrim"
        onClick={() => {
          if (phase !== 'shaking') onClose();
        }}
      />
      <div className="daily-opener__close">
        <IconButton label={tr(t('Fermer', 'Close'))} onClick={onClose}>
          <IconClose size={24} />
        </IconButton>
      </div>

      <div className="daily-opener__body">
        <motion.div
          className="daily-opener__stage"
          animate={opened ? { y: -8, scale: 0.72 } : { y: 0, scale: 1 }}
          transition={{ type: 'spring', ...spring.gentle }}
        >
          {opened && <span className="daily-opener__rays" aria-hidden />}
          {opened && <Burst count={24} radius={150} />}
          <motion.button
            key={round}
            type="button"
            className="daily-opener__chest"
            aria-label={`${tr(t('Ouvrir', 'Open'))} : ${name}`}
            disabled={phase !== 'idle'}
            onClick={openIt}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={
              phase === 'shaking'
                ? {
                    opacity: 1,
                    rotate: [0, -7, 7, -9, 9, -5, 5, 0],
                    scale: [1, 1.03, 1.06, 1.09, 1.12, 1.16, 1.2, 1.22],
                    y: [0, -2, 0, -3, 0, -4, 0, -6],
                  }
                : opened
                  ? { opacity: 1, scale: [1.22, 0.94, 1], rotate: 0, y: 0 }
                  : { opacity: 1, scale: [1, 1.04, 1], rotate: 0, y: 0 }
            }
            transition={
              phase === 'shaking'
                ? { duration: 0.9, ease: 'easeInOut' }
                : phase === 'idle'
                  ? {
                      scale: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' },
                      opacity: { duration: 0.3 },
                    }
                  : { duration: 0.5 }
            }
          >
            <ChestArt size={size} open={opened} />
            {phase === 'shaking' && <span className="daily-opener__glow" aria-hidden />}
          </motion.button>
        </motion.div>

        <AnimatePresence mode="wait">
          {opened ? (
            <motion.div key="loot" className="daily-opener__result" initial={{ opacity: 1 }}>
              <motion.h2
                className="daily-opener__title"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {tr(t('Un joli butin !', 'What a haul!'))}
              </motion.h2>
              <ul className="daily-loot-grid">
                {loot.map((r, i) => (
                  <RewardCard key={rewardLabel(r)} r={r} i={i} />
                ))}
              </ul>
              <motion.div
                className="daily-opener__actions"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 + loot.length * 0.16 + 0.5 }}
              >
                <Button variant="filled" onClick={onClose}>
                  {tr(t('Super !', 'Great!'))}
                </Button>
                {remaining > 0 && (
                  <Button variant="text" onClick={again}>
                    {tr(t(`Ouvrir un autre (${remaining})`, `Open another (${remaining})`))}
                  </Button>
                )}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div key="hint" className="daily-opener__hint" exit={{ opacity: 0 }}>
              <h2 className="daily-opener__title">{name}</h2>
              <p>
                {phase === 'shaking'
                  ? tr(t('Il se passe quelque chose…', 'Something is happening…'))
                  : tr(t('Touche le coffre pour l’ouvrir', 'Tap the chest to open it'))}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>,
    document.body,
  );
}

/** Les trois coffres avec leurs compteurs ; toucher un coffre l'ouvre. */
export function ChestTiles({ chests, index = 0 }: { chests: Record<ChestSize, number>; index?: number }) {
  const [opening, setOpening] = useState<ChestSize | null>(null);
  const total = CHEST_SIZES.reduce((s, k) => s + chests[k], 0);
  const tile = (size: ChestSize): ReactNode => {
    const count = chests[size];
    return (
      <motion.button
        key={size}
        type="button"
        className="daily-chest"
        data-empty={count === 0}
        disabled={count === 0}
        aria-label={`${tr(CHEST_NAMES[size])} : ${count}. ${tr(t('Ouvrir', 'Open'))}`}
        whileTap={{ scale: 0.94 }}
        onClick={() => {
          setOpening(size);
        }}
      >
        <span className="daily-chest__art">
          <ChestArt size={size} />
          {count > 0 && (
            <motion.span
              className="daily-chest__ping"
              aria-hidden
              animate={{ opacity: [0, 0.7, 0], scale: [0.8, 1.15, 1.3] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
        </span>
        <span className="daily-chest__name">{tr(CHEST_NAMES[size])}</span>
        <span className="daily-chest__count" aria-hidden>
          ×{count}
        </span>
      </motion.button>
    );
  };
  return (
    <>
      <Card index={index} className="daily-chests">
        <div className="daily-chests__row">{CHEST_SIZES.map(tile)}</div>
        {total === 0 && (
          <p className="daily-chests__empty">
            {tr(
              t(
                'Les quêtes et les séries de jours te rapportent des coffres.',
                'Quests and day streaks earn you chests.',
              ),
            )}
          </p>
        )}
      </Card>
      <AnimatePresence>
        {opening && (
          <ChestOpener
            key={opening}
            initial={opening}
            onClose={() => {
              setOpening(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
