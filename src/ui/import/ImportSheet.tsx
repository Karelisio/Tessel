import { App as CapApp } from '@capacitor/app';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Grid } from '@/content/grid';
import { ConvertClient } from '@/convert/client';
import { pickPhoto, type PhotoSource } from '@/convert/photo';
import { gridSizeFor } from '@/convert/resample';
import type { ModeId } from '@/modes/types';
import { duration, spring } from '@/theme/motion/tokens';
import { cropAspect, FORMATS, FULL_CROP, fitRatio, normalizedRatio, toCropRect } from './crop';
import type { FormatId, NormRect } from './crop';
import { PickView } from './PickView';
import { Segmented } from './Segmented';
import { SettingsPanel } from './SettingsPanel';
import { buildParams, DEFAULT_SETTINGS, type Output, type Settings } from './settings';
import { Stage, type LoadedPhoto, type StageView } from './Stage';
import './import.css';

/** Ce que l'écran d'import remet au jeu quand la personne appuie sur « Colorier ». */
export interface ImportResult {
  grid: Grid;
  mode: ModeId;
  title: string;
}

interface ImportSheetProps {
  open: boolean;
  initialMode: ModeId;
  /** Photo déjà choisie : l'édition s'ouvre dessus sans passer par le sélecteur (outils de test). */
  initialPhoto?: Blob | null;
  onClose: () => void;
  onConfirm: (result: ImportResult) => void;
}

const VIEWS = [
  { id: 'photo', label: 'Photo' },
  { id: 'preview', label: 'Aperçu' },
] as const satisfies readonly { id: StageView; label: string }[];

const FORMAT_OPTIONS = FORMATS.map(({ id, label }) => ({ id, label }));

const NOTICE_UNREADABLE = 'Cette image n’a pas pu être lue. Une autre photo peut être choisie.';
const NOTICE_NO_CAMERA = 'L’appareil photo n’est pas disponible ici. La galerie reste accessible.';
const NOTICE_NO_GALLERY = 'La galerie n’a pas pu être ouverte. Un nouvel essai est possible.';

/** Délai sans nouveau changement avant de relancer la conversion. */
const DEBOUNCE_MS = 80;

/**
 * Numérote les demandes de conversion. Un résultat `null` veut dire « abandonnée » (une demande plus récente
 * a pris sa place) ou « échec » : seule la demande la plus récente peut être un échec. Invalider fait taire
 * les demandes en cours (client arrêté, feuille refermée).
 */
function createRequestCounter() {
  let last = 0;
  return {
    next: () => ++last,
    invalidate: () => {
      last++;
    },
    isLatest: (id: number) => id === last,
  };
}

/** Feuille plein écran d'import photo : choix de la source, recadrage, réglages et aperçu en direct. */
export function ImportSheet({ open, ...sheet }: ImportSheetProps) {
  return <AnimatePresence>{open && <Sheet key="sheet" {...sheet} />}</AnimatePresence>;
}

/** Coque animée : entrée par le bas (ressort de la charte), ou simple fondu si « Réduire les animations ». */
function Sheet({ initialMode, initialPhoto = null, onClose, onConfirm }: Omit<ImportSheetProps, 'open'>) {
  // lue à chaque ouverture : la préférence du système est respectée sans redémarrer l'application
  const reduced = useReducedMotion();
  return (
    <motion.div
      className="imp"
      role="dialog"
      aria-modal="true"
      aria-label="Importer une photo"
      initial={reduced ? { opacity: 0 } : { y: '100%' }}
      animate={reduced ? { opacity: 1 } : { y: 0 }}
      exit={reduced ? { opacity: 0 } : { y: '100%' }}
      transition={reduced ? { duration: duration.xs / 1000 } : { type: 'spring', ...spring.sheet }}
    >
      {/* « Réduire les animations » : les transformations des contrôles sont appliquées d'un coup */}
      <MotionConfig reducedMotion="user">
        <SheetBody
          initialMode={initialMode}
          initialPhoto={initialPhoto}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      </MotionConfig>
    </motion.div>
  );
}

interface SheetBodyProps {
  initialMode: ModeId;
  initialPhoto: Blob | null;
  onClose: () => void;
  onConfirm: (result: ImportResult) => void;
}

/** Tout l'état de l'import vit ici : il disparaît (client, URL d'objet) quand la feuille est refermée. */
function SheetBody({ initialMode, initialPhoto, onClose, onConfirm }: SheetBodyProps) {
  const body = useRef<HTMLDivElement>(null);
  // photo : blob choisi → photo décodée (client de conversion + URL d'affichage)
  const [source, setSource] = useState<Blob | null>(initialPhoto);
  const [loaded, setLoaded] = useState<LoadedPhoto | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [picking, setPicking] = useState<PhotoSource | null>(null);
  // édition
  const [view, setView] = useState<StageView>('photo');
  const [format, setFormat] = useState<FormatId>('free');
  const [crop, setCrop] = useState<NormRect>(FULL_CROP);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [mode, setMode] = useState<ModeId>(initialMode);
  // conversion
  const [output, setOutput] = useState<Output | null>(null);
  const [failed, setFailed] = useState(false);
  const [requests] = useState(createRequestCounter);
  /** La feuille est en train de se refermer : plus aucune action n'est prise en compte (double appui). */
  const settled = useRef(false);

  /** Repart de zéro pour une nouvelle photo (les réglages de conversion sont conservés). */
  const startPhoto = (blob: Blob | null) => {
    setSource(blob);
    setView('photo');
    setFormat('free');
    setCrop(FULL_CROP);
    setOutput(null);
    setFailed(false);
  };

  // photo transmise après l'ouverture (outils de test) : elle remplace la précédente
  const [seenInitial, setSeenInitial] = useState(initialPhoto);
  if (initialPhoto !== seenInitial) {
    setSeenInitial(initialPhoto);
    startPhoto(initialPhoto);
  }

  const photo = loaded !== null && loaded.blob === source ? loaded : null;

  // décodage de la photo : un client de conversion (Web Worker) et une URL d'affichage par photo
  useEffect(() => {
    if (!source) return;
    let alive = true;
    const client = new ConvertClient();
    const url = URL.createObjectURL(source);
    void client.loadImage(source).then(
      ({ width, height }) => {
        if (alive) setLoaded({ blob: source, client, url, width, height });
      },
      (err: unknown) => {
        if (!alive) return;
        console.error('Lecture de la photo impossible', err);
        setNotice(NOTICE_UNREADABLE);
        setSource(null);
      },
    );
    return () => {
      alive = false;
      requests.invalidate(); // le client arrêté ne doit pas passer pour un échec de conversion
      client.dispose();
      URL.revokeObjectURL(url);
    };
  }, [source, requests]);

  // dimensions de la grille : côté le plus long = taille choisie, format du recadrage
  const aspect = photo ? cropAspect(crop, photo.width, photo.height) : 1;
  const { width: gridW, height: gridH } = gridSizeFor(aspect, settings.size);

  const params = useMemo(
    () =>
      photo
        ? buildParams(settings, { width: gridW, height: gridH }, toCropRect(crop, photo.width, photo.height))
        : null,
    [photo, settings, crop, gridW, gridH],
  );

  // chaque changement relance la conversion, après un court silence
  useEffect(() => {
    if (!photo || !params) return;
    const { client } = photo;
    const timer = window.setTimeout(() => {
      const id = requests.next();
      setFailed(false);
      void client.request(params).then((result) => {
        if (result) setOutput({ client, params, result });
        else if (requests.isLatest(id)) setFailed(true); // ni remplacée ni arrêtée : échec
      });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [photo, params, requests]);

  const current = photo && output?.client === photo.client ? output : null;
  const fresh = current !== null && current.params === params;
  const waiting = photo !== null && !fresh && !failed;

  const pick = async (from: PhotoSource) => {
    setNotice(null);
    setPicking(from);
    try {
      const blob = await pickPhoto(from);
      if (blob) startPhoto(blob);
    } catch (err) {
      console.error('Sélection de photo impossible', err);
      setNotice(from === 'camera' ? NOTICE_NO_CAMERA : NOTICE_NO_GALLERY);
    } finally {
      setPicking(null);
    }
  };

  const chooseFormat = (id: FormatId) => {
    setFormat(id);
    const pixelRatio = FORMATS.find((f) => f.id === id)?.ratio ?? null;
    if (pixelRatio !== null && photo) {
      const ratio = normalizedRatio(pixelRatio, photo.width, photo.height);
      setCrop((c) => fitRatio(c, ratio));
    }
  };
  const pixelRatio = FORMATS.find((f) => f.id === format)?.ratio ?? null;
  const lockedRatio =
    photo && pixelRatio !== null ? normalizedRatio(pixelRatio, photo.width, photo.height) : null;

  const confirm = () => {
    if (!current || !fresh || settled.current) return;
    settled.current = true;
    const date = new Date().toLocaleDateString('fr-FR', { dateStyle: 'short' });
    onConfirm({ grid: current.result.grid, mode, title: `Photo du ${date}` });
  };

  /** Ferme la feuille ; le calcul en cours est arrêté sans attendre la fin de l'animation de sortie. */
  const close = () => {
    if (settled.current) return;
    settled.current = true;
    requests.invalidate();
    photo?.client.dispose();
    onClose();
  };

  // Échap (navigateur) et bouton retour (Android) referment la feuille
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    const back = CapApp.addListener('backButton', () => {
      closeRef.current();
    });
    return () => {
      window.removeEventListener('keydown', onKey);
      void back.then((h) => h.remove());
    };
  }, []);

  // le focus entre dans la feuille (lecteurs d'écran, clavier)
  useEffect(() => {
    body.current?.focus({ preventScroll: true });
  }, []);

  const cells = current ? current.result.grid.cells.length - current.result.stats.transparent : 0;

  return (
    <div className="imp-body" ref={body} tabIndex={-1}>
      <div className="imp-col">
        <header className="imp-bar">
          {source ? (
            <>
              <Segmented
                variant="segmented"
                layoutId="imp-view"
                label="Affichage"
                options={VIEWS}
                value={view}
                onChange={setView}
              />
              <span className="spacer" />
              <button
                type="button"
                className="imp-link"
                onClick={() => {
                  setNotice(null);
                  startPhoto(null);
                }}
              >
                Changer de photo
              </button>
            </>
          ) : (
            <h2 className="imp-bar__title">Importer une photo</h2>
          )}
        </header>

        {source ? (
          <>
            <Stage
              view={view}
              photo={photo}
              crop={crop}
              ratio={lockedRatio}
              onCrop={setCrop}
              output={current}
              waiting={waiting}
              failed={failed}
            />
            <div className="imp-row">
              {photo && view === 'photo' && (
                <Segmented
                  variant="chips"
                  layoutId="imp-format"
                  label="Format du recadrage"
                  options={FORMAT_OPTIONS}
                  value={format}
                  onChange={chooseFormat}
                />
              )}
              {photo && view === 'preview' && (
                <p className="imp-stats" aria-live="polite">
                  {current
                    ? `${cells.toLocaleString('fr-FR')} cases à colorier · ${current.result.stats.colors} couleurs`
                    : 'Calcul de l’aperçu…'}
                </p>
              )}
            </div>
            {photo && (
              <SettingsPanel
                settings={settings}
                onChange={(patch) => {
                  setSettings((s) => ({ ...s, ...patch }));
                }}
                onReset={() => {
                  setSettings(DEFAULT_SETTINGS);
                }}
                dims={{ width: gridW, height: gridH }}
                output={current}
                mode={mode}
                onMode={setMode}
              />
            )}
          </>
        ) : (
          <PickView
            picking={picking}
            notice={notice}
            onPick={(from) => {
              void pick(from);
            }}
          />
        )}
      </div>

      <footer className="imp-foot">
        <motion.button type="button" className="btn imp-foot__btn" whileTap={{ scale: 0.95 }} onClick={close}>
          Annuler
        </motion.button>
        {source && (
          <motion.button
            type="button"
            className="btn btn--primary imp-foot__btn"
            whileTap={{ scale: 0.95 }}
            disabled={!fresh}
            onClick={confirm}
          >
            Colorier
          </motion.button>
        )}
      </footer>
    </div>
  );
}
