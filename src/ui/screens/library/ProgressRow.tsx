import { motion } from 'framer-motion';
import type { LibraryIndex } from '@/content/library/types';
import { refForProject } from '@/content/refs';
import type { ProjectMeta } from '@/db/ProgressStore';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { spring, staggerDelay } from '@/theme/motion/tokens';
import { Badge, SectionHeader } from '@/ui/kit';
import { ProjectThumb } from '@/ui/library/ProjectThumb';
import { percent } from './data';
import { openArtwork } from './origin';

/** Rangée « En cours » : les autres parties non terminées, défilement horizontal. */
export function InProgressRow({
  projects,
  library,
}: {
  projects: readonly ProjectMeta[];
  library: LibraryIndex | null;
}) {
  return (
    <section aria-label={tr(t('Parties en cours', 'In progress'))}>
      <SectionHeader title={tr(t('En cours', 'In progress'))} action={<Badge>{projects.length}</Badge>} />
      <div className="lib-rail">
        {projects.map((p, i) => {
          const title = p.title ?? tr(t('Œuvre sans titre', 'Untitled artwork'));
          return (
            <motion.button
              key={p.id}
              className="lib-mini"
              aria-label={tr(t(`${title}, ${percent(p)} % terminé`, `${title}, ${percent(p)}% complete`))}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', ...spring.gentle, delay: staggerDelay(i) / 1000 }}
              onClick={(e) => {
                openArtwork(
                  refForProject(p, library),
                  p.mode,
                  e.currentTarget.querySelector('.lib-mini__art'),
                );
              }}
            >
              <span className="lib-mini__art">
                <ProjectThumb id={p.id} size={112} />
                <span className="lib-pct">{percent(p)}%</span>
              </span>
              <span className="lib-mini__title">{title}</span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
