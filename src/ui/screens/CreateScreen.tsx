import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getServices } from '@/app/services';
import type { CreationMeta } from '@/create/CreationStore';
import { readTesselFile } from '@/create/incoming';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { useNav } from '@/store/nav';
import { spring, staggerDelay } from '@/theme/motion/tokens';
import { IconPlay } from '@/ui/kit/icons';
import { Button, EmptyState, Screen, SectionHeader, Sheet, Skeleton } from '@/ui/kit';
import { CreationCard } from './create/CreationCard';
import {
  IconCamera,
  IconCopy,
  IconFile,
  IconPencil,
  IconPhoto,
  IconPlus,
  IconQr,
  IconRename,
  IconShare,
  IconTrash,
} from './create/icons';
import { NewSheet } from './create/NewSheet';
import { usePlayFlow } from './create/usePlayFlow';
import { ScanSheet } from './create/ScanSheet';
import { ShareSheet, type ShareSource } from './create/ShareSheet';
import { useEditorStore } from './create/store';
import { ActionRow, ConfirmSheet } from './create/ui';
import { useToast } from './create/useToast';
import './create/create.css';

type Dialog = 'menu' | 'rename' | 'delete' | 'receive' | 'new' | null;

function useCreations(): CreationMeta[] | undefined {
  const version = useEditorStore((s) => s.version);
  const [list, setList] = useState<CreationMeta[] | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void getServices()
      .then((s) => s.creations.list())
      .then((l) => {
        if (alive) setList(l);
      })
      .catch((e: unknown) => {
        console.error(e);
        if (alive) setList([]);
      });
    return () => {
      alive = false;
    };
  }, [version]);
  return list;
}

/** Feuille de renommage. */
function RenamePanel({
  initial,
  onSubmit,
  onClose,
}: {
  initial: string;
  onSubmit: (title: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <form
      className="cr-rename"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
    >
      <div className="cr-sheet-head">
        <h3>{tr(t('Renommer', 'Rename'))}</h3>
      </div>
      <input
        className="cr-input"
        value={value}
        maxLength={60}
        autoFocus
        aria-label={tr(t('Titre de la création', 'Creation title'))}
        onFocus={(e) => {
          e.currentTarget.select();
        }}
        onChange={(e) => {
          setValue(e.target.value);
        }}
      />
      <div className="cr-rename__buttons">
        <Button variant="filled" type="submit">
          {tr(t('Enregistrer', 'Save'))}
        </Button>
        <Button variant="text" type="button" onClick={onClose}>
          {tr(t('Annuler', 'Cancel'))}
        </Button>
      </div>
    </form>
  );
}

/** Onglet « Créer » : nouvelle création, import de photo, œuvres reçues et créations enregistrées. */
export default function CreateScreen() {
  const reduced = useReducedMotion();
  const list = useCreations();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<CreationMeta | null>(null);
  const [share, setShare] = useState<ShareSource | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { notify, toast } = useToast();
  const play = usePlayFlow(notify);

  const refresh = () => {
    useEditorStore.getState().touch();
  };
  const close = () => {
    setDialog(null);
  };
  const withDoc = async (c: CreationMeta) => {
    const { creations } = await getServices();
    const found = await creations.get(c.id);
    if (!found) throw new Error('Création introuvable');
    return found;
  };
  const failed = () => {
    notify(
      tr(
        t(
          'Ça n’a pas marché cette fois. Tu peux réessayer.',
          'That did not work this time. You can try again.',
        ),
      ),
      'soft',
    );
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    void readTesselFile(file).catch(() => {
      notify(
        tr(
          t(
            'Ce fichier n’est pas une œuvre Tessel. Un fichier .tessel est attendu.',
            'This file is not a Tessel artwork. A .tessel file is expected.',
          ),
        ),
        'soft',
      );
    });
  };

  const hero = (
    <motion.button
      className="cr-hero"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', ...spring.gentle }}
      onClick={() => {
        setDialog('new');
      }}
    >
      <span className="cr-hero__pixels" aria-hidden>
        {Array.from({ length: 16 }, (_, i) => (
          <i key={i} style={{ animationDelay: `${String((i * 137) % 1800)}ms` }} />
        ))}
      </span>
      <span className="cr-hero__text">
        <strong>{tr(t('Nouvelle création', 'New creation'))}</strong>
        <small>
          {tr(t('Une toile vierge, tes couleurs, ton rythme.', 'A blank canvas, your colors, your pace.'))}
        </small>
      </span>
      <span className="cr-hero__plus" aria-hidden>
        <IconPlus size={26} />
      </span>
    </motion.button>
  );

  const shortcut = (icon: ReactNode, title: string, sub: string, index: number, onClick: () => void) => (
    <motion.button
      className="cr-shortcut"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', ...spring.gentle, delay: staggerDelay(index) / 1000 }}
      onClick={onClick}
    >
      <span className="cr-shortcut__icon">{icon}</span>
      <strong>{title}</strong>
      <small>{sub}</small>
    </motion.button>
  );

  return (
    <>
      <Screen title={tr(t('Créer', 'Create'))} className="cr-screen">
        <div className="cr-root">
          {hero}
          <div className="cr-shortcuts">
            {shortcut(
              <IconPhoto size={24} />,
              tr(t('Importer une photo', 'Import a photo')),
              tr(t('Un souvenir en coloriage', 'A memory, colored in')),
              1,
              () => {
                useNav.getState().openImport();
              },
            )}
            {shortcut(
              <IconQr size={24} />,
              tr(t('Recevoir une œuvre', 'Receive an artwork')),
              tr(t('QR code ou fichier .tessel', 'QR code or .tessel file')),
              2,
              () => {
                setDialog('receive');
              },
            )}
          </div>

          <SectionHeader
            title={tr(t('Mes créations', 'My creations'))}
            action={list && list.length > 0 ? <span className="cr-count">{list.length}</span> : undefined}
          />

          {list === undefined && (
            <div className="cr-grid" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="cr-card cr-card--ghost">
                  <span className="cr-ghost-thumb">
                    <Skeleton width="100%" height="100%" radius={18} />
                  </span>
                  <Skeleton width="70%" height={14} />
                  <Skeleton width="45%" height={12} />
                </div>
              ))}
            </div>
          )}

          {list?.length === 0 && (
            <EmptyState
              icon={<IconPencil size={34} />}
              title={tr(t('Ta première œuvre t’attend', 'Your first artwork awaits'))}
              text={tr(
                t(
                  'Pose une couleur, puis une autre : ici, tout ce que tu crées est gardé au chaud, prêt à être colorié ou partagé.',
                  'Lay down a color, then another: everything you create is kept safe here, ready to play or share.',
                ),
              )}
              action={
                <Button
                  variant="filled"
                  onClick={() => {
                    setDialog('new');
                  }}
                >
                  {tr(t('Commencer', 'Get started'))}
                </Button>
              }
            />
          )}

          {list && list.length > 0 && (
            <div className="cr-grid">
              <AnimatePresence initial={false}>
                {list.map((c, i) => (
                  <CreationCard
                    key={c.id}
                    meta={c}
                    index={i}
                    onOpen={() => {
                      useEditorStore.getState().open(c.id);
                    }}
                    onMenu={() => {
                      setSelected(c);
                      setDialog('menu');
                    }}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </Screen>

      <NewSheet open={dialog === 'new'} onClose={close} />

      <Sheet
        open={dialog === 'receive'}
        onClose={close}
        label={tr(t('Recevoir une œuvre', 'Receive an artwork'))}
      >
        <div className="cr-sheet-head">
          <h3>{tr(t('Recevoir une œuvre', 'Receive an artwork'))}</h3>
          <p>
            {tr(
              t(
                'Un ami t’a partagé une création ? Ouvre-la ici.',
                'A friend shared a creation? Open it here.',
              ),
            )}
          </p>
        </div>
        <div className="cr-actions">
          <ActionRow
            icon={<IconCamera size={22} />}
            label={tr(t('Scanner un QR code', 'Scan a QR code'))}
            hint={tr(t('Avec l’appareil photo', 'With the camera'))}
            onClick={() => {
              close();
              setScanning(true);
            }}
          />
          <ActionRow
            icon={<IconFile size={22} />}
            label={tr(t('Ouvrir un fichier .tessel', 'Open a .tessel file'))}
            hint={tr(t('Depuis les fichiers du téléphone', 'From your phone’s files'))}
            onClick={() => {
              close();
              fileInput.current?.click();
            }}
          />
        </div>
      </Sheet>
      <input
        ref={fileInput}
        type="file"
        accept=".tessel,application/x-tessel,application/octet-stream"
        hidden
        aria-label={tr(t('Fichier .tessel', '.tessel file'))}
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <ScanSheet
        open={scanning}
        onClose={() => {
          setScanning(false);
        }}
      />

      <Sheet open={dialog === 'menu'} onClose={close} label={selected?.title ?? ''}>
        {selected && (
          <>
            <div className="cr-sheet-head">
              <h3>{selected.title}</h3>
              <p>
                {selected.width}×{selected.height}
              </p>
            </div>
            <div className="cr-actions">
              <ActionRow
                icon={<IconPencil size={22} />}
                label={tr(t('Ouvrir dans l’éditeur', 'Open in the editor'))}
                onClick={() => {
                  close();
                  useEditorStore.getState().open(selected.id);
                }}
              />
              <ActionRow
                icon={<IconPlay size={22} />}
                label={tr(t('Jouer', 'Play'))}
                hint={tr(t('La colorier comme une œuvre', 'Color it like an artwork'))}
                onClick={() => {
                  close();
                  void withDoc(selected)
                    .then((c) => {
                      play.start(c.meta.title, c.doc);
                    })
                    .catch(failed);
                }}
              />
              <ActionRow
                icon={<IconShare size={22} />}
                label={tr(t('Partager', 'Share'))}
                hint={tr(t('Fichier, QR code ou image', 'File, QR code or image'))}
                onClick={() => {
                  close();
                  void withDoc(selected)
                    .then((c) => {
                      setShare({ title: c.meta.title, doc: c.doc, createdAt: c.meta.createdAt });
                    })
                    .catch(failed);
                }}
              />
              <ActionRow
                icon={<IconRename size={22} />}
                label={tr(t('Renommer', 'Rename'))}
                onClick={() => {
                  setDialog('rename');
                }}
              />
              <ActionRow
                icon={<IconCopy size={22} />}
                label={tr(t('Dupliquer', 'Duplicate'))}
                onClick={() => {
                  close();
                  void getServices()
                    .then((s) =>
                      s.creations.duplicate(
                        selected.id,
                        `${selected.title} ${tr(t('(copie)', '(copy)'))}`.slice(0, 60),
                      ),
                    )
                    .then(() => {
                      refresh();
                      notify(tr(t('Création dupliquée', 'Creation duplicated')));
                    })
                    .catch(failed);
                }}
              />
              <ActionRow
                icon={<IconTrash size={22} />}
                label={tr(t('Supprimer', 'Delete'))}
                tone="danger"
                onClick={() => {
                  setDialog('delete');
                }}
              />
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={dialog === 'rename'} onClose={close} label={tr(t('Renommer', 'Rename'))}>
        {selected && (
          <RenamePanel
            initial={selected.title}
            onClose={close}
            onSubmit={(title) => {
              close();
              void getServices()
                .then((s) => s.creations.rename(selected.id, title))
                .then(refresh)
                .catch(failed);
            }}
          />
        )}
      </Sheet>

      <ConfirmSheet
        open={dialog === 'delete'}
        onClose={close}
        danger
        title={tr(t('Supprimer cette création ?', 'Delete this creation?'))}
        text={
          selected
            ? tr(
                t(
                  `« ${selected.title} » sera supprimée définitivement. Cette action est irréversible.`,
                  `“${selected.title}” will be deleted for good. This cannot be undone.`,
                ),
              )
            : ''
        }
        confirm={tr(t('Supprimer', 'Delete'))}
        cancel={tr(t('Garder', 'Keep'))}
        onConfirm={() => {
          close();
          if (!selected) return;
          void getServices()
            .then((s) => s.creations.remove(selected.id))
            .then(() => {
              refresh();
              notify(tr(t('Création supprimée', 'Creation deleted')));
            })
            .catch(failed);
        }}
      />

      <ShareSheet
        source={share}
        notify={notify}
        onClose={() => {
          setShare(null);
        }}
      />
      {play.sheet}
      {toast}
    </>
  );
}
