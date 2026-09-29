import { motion } from 'framer-motion';
import { useRef, useState } from 'react';
import { getCategory } from '@/content/categories';
import { DIFFICULTIES, type Difficulty, type LibraryEntry, type LibraryIndex } from '@/content/library/types';
import { libraryRef } from '@/content/refs';
import { locale, tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { MODE_IDS, type ModeId } from '@/modes/types';
import { spring } from '@/theme/motion/tokens';
import { Button, Sheet } from '@/ui/kit';
import { IconPlay } from '@/ui/kit/icons';
import { Thumb } from '@/ui/library/Thumb';
import { IconLock } from '@/ui/meta/icons';
import { percent, projectDifficulty, type WorkState } from './data';
import { DIFFICULTY_NAMES, MODE_NAMES, modeLevel } from './labels';
import { openArtwork } from './origin';
import { useShake } from './shake';

function ModeOption({
  mode,
  selected,
  locked,
  onSelect,
  onLocked,
}: {
  mode: ModeId;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
  onLocked: (level: number | undefined) => void;
}) {
  const { controls, shake } = useShake();
  const level = modeLevel(mode);
  const name = MODE_NAMES[mode][locale()];
  return (
    <motion.button
      className="lib-opt lib-opt--mode"
      aria-pressed={selected}
      aria-disabled={locked}
      data-locked={locked}
      aria-label={
        locked
          ? tr(
              t(
                `${name}, verrouillé${level ? `, niveau ${level}` : ''}`,
                `${name}, locked${level ? `, level ${level}` : ''}`,
              ),
            )
          : name
      }
      animate={controls}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', ...spring.snappy }}
      onClick={() => {
        if (locked) {
          shake();
          onLocked(level);
        } else {
          onSelect();
        }
      }}
    >
      <strong>{name}</strong>
      {locked && (
        <small className="lib-opt__lock">
          <IconLock size={13} />
          {level === undefined ? tr(t('Verrouillé', 'Locked')) : tr(t(`Niveau ${level}`, `Level ${level}`))}
        </small>
      )}
    </motion.button>
  );
}

function SheetBody({
  entry,
  library,
  states,
  modes,
  level,
  preferred,
  from,
  onClose,
}: {
  entry: LibraryEntry;
  library: LibraryIndex;
  states: ReadonlyMap<string, WorkState>;
  modes: readonly ModeId[];
  level: number;
  preferred: Difficulty | null;
  from: Element | null;
  onClose: () => void;
}) {
  const lang = locale();
  const state = states.get(entry.id);
  const art = useRef<HTMLDivElement>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>(
    () => preferred ?? (state?.open[0] ? projectDifficulty(state.open[0]) : 'easy'),
  );
  const [mode, setMode] = useState<ModeId>(() => {
    const p = state?.open.find((o) => projectDifficulty(o) === (preferred ?? difficulty)) ?? state?.open[0];
    return p && modes.includes(p.mode) ? p.mode : 'pixel';
  });
  const [note, setNote] = useState<string | null>(null);

  const all = [...(state?.open ?? []), ...(state?.done ?? [])];
  const current = all
    .filter((p) => projectDifficulty(p) === difficulty && p.mode === mode)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const action = !current
    ? tr(t('Commencer', 'Start'))
    : current.completedAt === null
      ? tr(t('Continuer', 'Continue'))
      : tr(t('Revoir', 'View again'));
  const credit = entry.credit;

  return (
    <div className="lib-sheet">
      <div className="lib-sheet__art" ref={art}>
        <Thumb id={entry.id} size={136} />
      </div>
      <h2 className="lib-sheet__title">{entry.title[lang]}</h2>
      <p className="lib-sheet__meta">
        {getCategory(entry.category).name[lang]}
        {credit && (
          <>
            <span aria-hidden> · </span>
            {tr(t(`d’après ${credit.artist}`, `after ${credit.artist}`))}
          </>
        )}
      </p>

      <h3 className="lib-sheet__label">{tr(t('Difficulté', 'Difficulty'))}</h3>
      <div className="lib-opts" role="group" aria-label={tr(t('Difficulté', 'Difficulty'))}>
        {DIFFICULTIES.map((d) => {
          const v = entry.variants[d];
          const open = state?.open.filter((p) => projectDifficulty(p) === d) ?? [];
          const best = open[0];
          const finished = state?.done.some((p) => projectDifficulty(p) === d) ?? false;
          return (
            <motion.button
              key={d}
              className="lib-opt"
              aria-pressed={difficulty === d}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', ...spring.snappy }}
              onClick={() => {
                setDifficulty(d);
              }}
            >
              <strong>{DIFFICULTY_NAMES[d][lang]}</strong>
              <small>
                {v.width} × {v.height}
                <span aria-hidden> · </span>
                {tr(t(`${v.colors} couleurs`, `${v.colors} colours`))}
              </small>
              {(best !== undefined || finished) && (
                <small className="lib-opt__state">
                  {best
                    ? tr(t(`En cours · ${percent(best)} %`, `In progress · ${percent(best)}%`))
                    : tr(t('Terminée', 'Finished'))}
                </small>
              )}
            </motion.button>
          );
        })}
      </div>

      <h3 className="lib-sheet__label">{tr(t('Façon de colorier', 'Way to colour'))}</h3>
      <div className="lib-opts" role="group" aria-label={tr(t('Mode', 'Mode'))}>
        {MODE_IDS.map((m) => (
          <ModeOption
            key={m}
            mode={m}
            selected={mode === m}
            locked={!modes.includes(m)}
            onSelect={() => {
              setMode(m);
              setNote(null);
            }}
            onLocked={(lv) => {
              setNote(
                lv === undefined
                  ? tr(t('Ce mode n’est pas encore débloqué.', 'This mode is not unlocked yet.'))
                  : tr(
                      t(
                        `Ce mode se débloque au niveau ${lv}. Tu es au niveau ${level}, continue doucement !`,
                        `This mode unlocks at level ${lv}. You are at level ${level}, keep going gently!`,
                      ),
                    ),
              );
            }}
          />
        ))}
      </div>
      {note && (
        <p className="lib-note" role="status">
          <IconLock size={15} />
          <span>{note}</span>
        </p>
      )}

      <div className="lib-sheet__cta">
        <Button
          variant="filled"
          onClick={() => {
            // la vignette de la grille si elle est encore là, sinon l'aperçu de la feuille
            openArtwork(libraryRef(entry, difficulty, library), mode, from?.isConnected ? from : art.current);
            onClose();
          }}
        >
          <span className="lib-btn-inner">
            <IconPlay size={20} />
            {action}
          </span>
        </Button>
      </div>
    </div>
  );
}

/** Feuille « Choisir » : aperçu, difficulté, mode, puis Commencer / Continuer. */
export function ChooseSheet({
  entry,
  open,
  onClose,
  library,
  states,
  modes,
  level,
  preferred,
  from,
}: {
  entry: LibraryEntry | null;
  from: Element | null;
  open: boolean;
  onClose: () => void;
  library: LibraryIndex | null;
  states: ReadonlyMap<string, WorkState>;
  modes: readonly ModeId[];
  level: number;
  preferred: Difficulty | null;
}) {
  return (
    <Sheet open={open} onClose={onClose} label={tr(t('Choisir une œuvre', 'Choose an artwork'))}>
      {entry && library && (
        <SheetBody
          key={entry.id}
          entry={entry}
          library={library}
          states={states}
          modes={modes}
          level={level}
          preferred={preferred}
          from={from}
          onClose={onClose}
        />
      )}
    </Sheet>
  );
}
