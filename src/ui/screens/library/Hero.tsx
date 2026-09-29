import { motion } from 'framer-motion';
import { useRef, useState } from 'react';
import { getCategory } from '@/content/categories';
import type { LibraryEntry, LibraryIndex } from '@/content/library/types';
import { refForProject } from '@/content/refs';
import type { ProjectMeta } from '@/db/ProgressStore';
import { locale, tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { spring } from '@/theme/motion/tokens';
import { Button, Card, ProgressRing } from '@/ui/kit';
import { IconPlay } from '@/ui/kit/icons';
import { ProjectThumb } from '@/ui/library/ProjectThumb';
import { Thumb } from '@/ui/library/Thumb';
import { fraction, percent } from './data';
import { ago, MODE_NAMES } from './labels';
import { openArtwork } from './origin';

/** Héros « Reprendre » : la dernière partie en cours, en grand. */
export function ResumeHero({ project, library }: { project: ProjectMeta; library: LibraryIndex | null }) {
  const art = useRef<HTMLButtonElement>(null);
  const [now] = useState(() => Date.now());
  const pct = percent(project);
  const title = project.title ?? tr(t('Œuvre sans titre', 'Untitled artwork'));
  const go = () => {
    openArtwork(refForProject(project, library), project.mode, art.current);
  };
  return (
    <Card className="lib-hero" index={0}>
      <div className="lib-hero__row">
        <motion.button
          ref={art}
          className="lib-hero__art"
          aria-label={tr(t(`Continuer ${title}`, `Continue ${title}`))}
          whileTap={{ scale: 0.96 }}
          transition={{ type: 'spring', ...spring.snappy }}
          onClick={go}
        >
          <ProjectThumb id={project.id} size={148} />
          <span className="lib-hero__ring">
            <ProgressRing value={fraction(project)} size={54} stroke={5} color="var(--primary)">
              {pct}%
            </ProgressRing>
          </span>
        </motion.button>
        <div className="lib-hero__body">
          <span className="lib-kicker">{tr(t('Reprendre', 'Pick up again'))}</span>
          <h2 className="lib-hero__title">{title}</h2>
          <p className="lib-hero__sub">
            {MODE_NAMES[project.mode][locale()]}
            <span aria-hidden> · </span>
            {ago(project.updatedAt, now, locale())}
          </p>
          <Button variant="filled" onClick={go}>
            <span className="lib-btn-inner">
              <IconPlay size={18} />
              {tr(t('Continuer', 'Continue'))}
            </span>
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Sans partie en cours : une œuvre à essayer, choisie chaque jour. */
export function SuggestHero({
  entry,
  first,
  onPick,
}: {
  entry: LibraryEntry;
  first: boolean;
  onPick: (entry: LibraryEntry, from: Element | null) => void;
}) {
  const art = useRef<HTMLButtonElement>(null);
  const lang = locale();
  const go = () => {
    onPick(entry, art.current);
  };
  return (
    <Card className="lib-hero" index={0}>
      <div className="lib-hero__row">
        <motion.button
          ref={art}
          className="lib-hero__art"
          aria-label={tr(t(`Choisir ${entry.title.fr}`, `Choose ${entry.title.en}`))}
          whileTap={{ scale: 0.96 }}
          transition={{ type: 'spring', ...spring.snappy }}
          onClick={go}
        >
          <Thumb id={entry.id} size={148} />
        </motion.button>
        <div className="lib-hero__body">
          <span className="lib-kicker">
            {first ? tr(t('Pour commencer', 'To begin')) : tr(t('Une idée pour toi', 'An idea for you'))}
          </span>
          <h2 className="lib-hero__title">{entry.title[lang]}</h2>
          <p className="lib-hero__sub">{getCategory(entry.category).name[lang]}</p>
          <Button variant="filled" onClick={go}>
            <span className="lib-btn-inner">
              <IconPlay size={18} />
              {tr(t('Commencer', 'Start'))}
            </span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
