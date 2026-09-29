import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { getServices, useDataVersion } from '@/app/services';
import type { ProjectMeta } from '@/db/ProgressStore';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { CATALOG, catalogItem, type UnlockKey } from '@/meta/catalog';
import { spring, staggerDelay } from '@/theme/motion/tokens';
import { Sheet, Skeleton } from '@/ui/kit';
import { IconCheck } from '@/ui/meta/icons';
import type { Notify } from './Toast';
import { useSeen, useThumb } from './thumbs';

function FrameOption({
  project,
  frame,
  name,
  current,
  index,
  onPick,
}: {
  project: ProjectMeta;
  frame: string | null;
  name: string;
  current: boolean;
  index: number;
  onPick: () => void;
}) {
  const [ref, seen] = useSeen('120px');
  const { url } = useThumb({ id: project.id, updatedAt: project.updatedAt, frame, size: 240 }, seen);
  return (
    <motion.button
      ref={ref}
      type="button"
      className="gg-frameopt"
      data-current={current}
      aria-pressed={current}
      aria-label={name}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', ...spring.gentle, delay: staggerDelay(index % 9, 24) / 1000 }}
      onClick={onPick}
    >
      <span className="gg-frameopt__img">
        {url ? (
          <motion.img
            src={url}
            alt=""
            draggable={false}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', ...spring.gentle }}
          />
        ) : (
          <Skeleton width="72%" height="72%" radius={8} />
        )}
        {current && (
          <span className="gg-wallopt__check">
            <IconCheck size={14} />
          </span>
        )}
      </span>
      <span className="gg-frameopt__name">{name}</span>
    </motion.button>
  );
}

/** Sélecteur de cadres débloqués, avec l'aperçu de l'œuvre dans chacun. */
export function FrameSheet({
  open,
  onClose,
  project,
  unlocked,
  notify,
}: {
  open: boolean;
  onClose: () => void;
  project: ProjectMeta;
  unlocked: readonly UnlockKey[];
  notify: Notify;
}) {
  const options = useMemo(() => {
    const set = new Set<string>(unlocked);
    return CATALOG.filter((c) => c.key.startsWith('frame:') && set.has(c.key));
  }, [unlocked]);

  const pick = async (frame: string | null) => {
    if (frame === project.frame) {
      onClose();
      return;
    }
    try {
      const { store } = await getServices();
      await store.setFrame(project.id, frame);
      useDataVersion.getState().bump();
      onClose();
      notify(tr(t('Nouveau cadre accroché !', 'New frame hung!')));
    } catch {
      notify(
        tr(
          t(
            'Le cadre n’a pas pu être changé. Réessaie dans un instant.',
            'Couldn’t change the frame. Try again in a moment.',
          ),
        ),
        'soft',
      );
    }
  };

  return (
    <Sheet open={open} onClose={onClose} label={tr(t('Changer le cadre', 'Change frame'))}>
      <h2 className="gg-sheet__title">{tr(t('Changer le cadre', 'Change frame'))}</h2>
      <p className="gg-sheet__hint">
        {tr(
          t(
            'De nouveaux cadres se débloquent au fil de ta progression.',
            'New frames unlock as you progress.',
          ),
        )}
      </p>
      <div className="gg-frames">
        <FrameOption
          project={project}
          frame={null}
          name={tr(t('Selon le mode', 'By mode'))}
          current={project.frame === null}
          index={0}
          onPick={() => {
            void pick(null);
          }}
        />
        {options.map((c, i) => (
          <FrameOption
            key={c.key}
            project={project}
            frame={c.key}
            name={tr(catalogItem(c.key)?.name ?? c.name)}
            current={project.frame === c.key}
            index={i + 1}
            onPick={() => {
              void pick(c.key);
            }}
          />
        ))}
      </div>
    </Sheet>
  );
}
