import { motion } from 'framer-motion';
import { activeEvents, daysLeft, nextEvent, type EventDecor, type SeasonalEvent } from '@/content/events';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import type { DayKey } from '@/meta/time';
import { useNav } from '@/store/nav';
import { spring } from '@/theme/motion/tokens';
import { IconChevron } from '@/ui/kit/icons';

/** Petit motif de l'événement (étoiles, cœurs, pétales…), dessiné en traits doux. */
function Glyph({ decor }: { decor: EventDecor }) {
  const common = {
    width: 26,
    height: 26,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (decor) {
    case 'stars':
      return (
        <svg {...common}>
          <path d="M12 3l2 5.5 5.5 2-5.5 2-2 5.5-2-5.5-5.5-2 5.5-2z" />
          <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
        </svg>
      );
    case 'hearts':
      return (
        <svg {...common}>
          <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.6-7 10-7 10z" />
        </svg>
      );
    case 'petals':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="2" />
          <path d="M12 10c-2-2-2-5 0-7 2 2 2 5 0 7zM14 12c2-2 5-2 7 0-2 2-5 2-7 0zM12 14c2 2 2 5 0 7-2-2-2-5 0-7zM10 12c-2 2-5 2-7 0 2-2 5-2 7 0z" />
        </svg>
      );
    case 'sun':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
        </svg>
      );
    case 'leaves':
      return (
        <svg {...common}>
          <path d="M5 19C4 11 9 5 20 4c0 10-5 16-13 15z" />
          <path d="M5 19l8-8" />
        </svg>
      );
    case 'snow':
      return (
        <svg {...common}>
          <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />
        </svg>
      );
  }
}

function ActiveEvent({ event, day, index }: { event: SeasonalEvent; day: DayKey; index: number }) {
  const left = daysLeft(event, day);
  const text =
    left <= 1 ? tr(t('Dernier jour !', 'Last day!')) : tr(t(`Encore ${left} jours`, `${left} days left`));
  return (
    <motion.button
      type="button"
      className="daily-event"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', ...spring.gentle, delay: index * 0.05 }}
      whileTap={{ scale: 0.98 }}
      aria-label={`${tr(event.name)} : ${text}`}
      onClick={() => {
        useNav.getState().push('collections');
      }}
    >
      <motion.span
        className="daily-event__glyph"
        animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Glyph decor={event.decor} />
      </motion.span>
      <span className="daily-event__text">
        <strong>{tr(event.name)}</strong>
        <small>
          {tr(t('Événement en cours', 'Event in progress'))} · {text}
        </small>
      </span>
      <IconChevron size={18} />
    </motion.button>
  );
}

/** Bandeau des événements saisonniers en cours. */
export function EventBanners({ day }: { day: DayKey }) {
  const events = activeEvents(day);
  if (events.length === 0) return null;
  return (
    <div className="daily-events">
      {events.map((e, i) => (
        <ActiveEvent key={e.id} event={e} day={day} index={i} />
      ))}
    </div>
  );
}

/** Mention discrète du prochain événement quand aucun n'est en cours. */
export function NextEvent({ day }: { day: DayKey }) {
  if (activeEvents(day).length > 0) return null;
  const { event, inDays } = nextEvent(day);
  const when = inDays <= 1 ? tr(t('demain', 'tomorrow')) : tr(t(`dans ${inDays} jours`, `in ${inDays} days`));
  return (
    <p className="daily-next-event">
      <span className="daily-next-event__glyph">
        <Glyph decor={event.decor} />
      </span>
      {tr(t('Prochain événement', 'Next event'))} : {tr(event.name)}, {when}
    </p>
  );
}
