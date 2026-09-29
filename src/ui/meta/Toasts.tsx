import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import type { MetaNotice } from '@/meta/MetaService';
import { mergeRewards } from '@/meta/rewards';
import { useMetaStore, type Toast } from '@/store/meta';
import { spring } from '@/theme/motion/tokens';
import { IconCheck, IconChest, IconFlame, IconStar, IconTrophy } from './icons';
import { achievementTitle, questLabel, rewardLabel } from './labels';

interface Content {
  tone: 'level' | 'achievement' | 'quest' | 'streak';
  icon: ReactNode;
  kicker: string;
  title: string;
  rewards: string[];
}

function content(n: MetaNotice): Content {
  const rewards = mergeRewards(n.rewards).map(rewardLabel);
  switch (n.type) {
    case 'levelUp':
      return {
        tone: 'level',
        icon: <IconStar size={22} />,
        kicker: tr(t('Nouveau niveau', 'Level up')),
        title: `${tr(t('Niveau', 'Level'))} ${n.level}`,
        rewards,
      };
    case 'achievement':
      return {
        tone: 'achievement',
        icon: <IconTrophy size={20} />,
        kicker: tr(
          n.def.kind === 'secret' ? t('Succès secret', 'Secret achievement') : t('Succès', 'Achievement'),
        ),
        title: achievementTitle(n.def.id),
        rewards,
      };
    case 'quest':
      return {
        tone: 'quest',
        icon: <IconCheck size={20} />,
        kicker: tr(
          n.quest.period === 'daily'
            ? t('Quête du jour', 'Daily quest')
            : t('Quête de la semaine', 'Weekly quest'),
        ),
        title: questLabel(n.quest),
        rewards,
      };
    case 'questsAll':
      return {
        tone: 'quest',
        icon: <IconChest size={20} />,
        kicker: tr(t('Bravo', 'Well done')),
        title: tr(
          n.period === 'daily'
            ? t('Toutes les quêtes du jour', 'All daily quests done')
            : t('Toutes les quêtes de la semaine', 'All weekly quests done'),
        ),
        rewards,
      };
    case 'collection':
      return {
        tone: 'quest',
        icon: <IconChest size={20} />,
        kicker: tr(
          n.event
            ? t('Collection d’événement', 'Event collection')
            : t('Collection terminée', 'Collection complete'),
        ),
        title: tr(n.name),
        rewards,
      };
    case 'streak': {
      const u = n.update;
      const days = u.state.current;
      let title = tr(t(`Série de ${days} jours`, `${days}-day streak`));
      if (u.freezesUsed > 0) title = tr(t('Un joker a protégé ta série', 'A freeze saved your streak'));
      else if (u.broken) title = tr(t('Nouvelle série, tout en douceur', 'A fresh streak begins'));
      else if (days === 1) title = tr(t('Série commencée', 'Streak started'));
      return {
        tone: 'streak',
        icon: <IconFlame size={20} />,
        kicker: tr(u.milestone !== null ? t('Palier de série', 'Streak milestone') : t('Série', 'Streak')),
        title,
        rewards: u.milestone !== null ? rewards : rewards.slice(0, 1),
      };
    }
  }
}

function ToastCard({ toast }: { toast: Toast }) {
  const dismiss = useMetaStore((s) => s.dismiss);
  const c = content(toast.notice);
  useEffect(() => {
    const h = setTimeout(
      () => {
        dismiss(toast.id);
      },
      c.tone === 'level' ? 5000 : 3600,
    );
    return () => {
      clearTimeout(h);
    };
  }, [toast.id, c.tone, dismiss]);
  return (
    <motion.li
      layout
      className={`toast toast--${c.tone}`}
      initial={{ opacity: 0, y: -24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.96, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', ...spring.snappy }}
      onClick={() => {
        dismiss(toast.id);
      }}
    >
      <motion.span
        className="toast__icon"
        initial={{ rotate: -30, scale: 0.4 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: 'spring', ...spring.bouncy, delay: 0.08 }}
      >
        {c.icon}
      </motion.span>
      <span className="toast__body">
        <span className="toast__kicker">{c.kicker}</span>
        <strong className="toast__title">{c.title}</strong>
        {c.rewards.length > 0 && (
          <span className="toast__rewards">
            {c.rewards.slice(0, 3).map((r, i) => (
              <motion.span
                key={r}
                className="toast__reward"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.06 }}
              >
                {r}
              </motion.span>
            ))}
            {c.rewards.length > 3 && <span className="toast__reward">+{c.rewards.length - 3}</span>}
          </span>
        )}
      </span>
    </motion.li>
  );
}

/** Notifications de progression : niveau, succès, quêtes, série. */
export function Toasts() {
  const toasts = useMetaStore((s) => s.toasts);
  return (
    <ul className="toasts" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.slice(-2).map((toast) => (
          <ToastCard key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </ul>
  );
}
