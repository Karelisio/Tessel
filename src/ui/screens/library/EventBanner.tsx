import { motion } from 'framer-motion';
import type { LibraryEntry } from '@/content/library/types';
import type { SeasonalEvent } from '@/content/events';
import { locale, tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { spring, staggerDelay } from '@/theme/motion/tokens';
import { Card } from '@/ui/kit';
import { IconCheck, IconStar } from '@/ui/meta/icons';
import { Thumb } from '@/ui/library/Thumb';
import { statusOf, type WorkState } from './data';

/** Bandeau d'un événement saisonnier en cours, avec ses œuvres. */
export function EventBanner({
  event,
  left,
  entries,
  states,
  onPick,
}: {
  event: SeasonalEvent;
  left: number;
  entries: readonly LibraryEntry[];
  states: ReadonlyMap<string, WorkState>;
  onPick: (entry: LibraryEntry, from: Element | null) => void;
}) {
  const lang = locale();
  const done = entries.filter((e) => statusOf(states.get(e.id), null).status === 'done').length;
  const timeLeft =
    left <= 1 ? tr(t('Dernier jour !', 'Last day!')) : tr(t(`Plus que ${left} jours`, `${left} days left`));
  return (
    <Card className="lib-event" index={1}>
      <div className="lib-event__head">
        <span className="lib-event__icon">
          <IconStar size={22} />
        </span>
        <div className="lib-event__text">
          <strong>{event.name[lang]}</strong>
          <small>
            {timeLeft}
            <span aria-hidden> · </span>
            {tr(t(`${done} sur ${entries.length} terminées`, `${done} of ${entries.length} finished`))}
          </small>
        </div>
      </div>
      <div className="lib-rail lib-rail--inset">
        {entries.map((e, i) => {
          const finished = statusOf(states.get(e.id), null).status === 'done';
          return (
            <motion.button
              key={e.id}
              className="lib-event__work"
              aria-label={e.title[lang]}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', ...spring.gentle, delay: staggerDelay(i + 2) / 1000 }}
              onClick={(ev) => {
                onPick(e, ev.currentTarget.querySelector('.lib-event__art'));
              }}
            >
              <span className="lib-event__art">
                <Thumb id={e.id} size={84} />
                {finished && (
                  <span className="lib-check lib-check--sm">
                    <IconCheck size={12} />
                  </span>
                )}
              </span>
              <span className="lib-event__title">{e.title[lang]}</span>
            </motion.button>
          );
        })}
      </div>
    </Card>
  );
}
