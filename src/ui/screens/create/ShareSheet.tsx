import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { paintedCount, toGrid, type CreationDoc } from '@/create/document';
import { encodeTessel, qrMatrix, drawQr, TESSEL_MIME } from '@/create/format';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { canvasBlob, fileName, saveToDevice, shareFile } from '@/render/exports';
import { spring } from '@/theme/motion/tokens';
import { Button, Segmented, Sheet } from '@/ui/kit';
import { IconDownload, IconShare } from './icons';
import { docRgba, renderPng } from './render';
import { PixelThumb } from './ui';
import type { Notify } from './useToast';

export interface ShareSource {
  title: string;
  doc: CreationDoc;
  createdAt: number;
}

type Tab = 'file' | 'qr' | 'image';

const kb = (n: number) => `${(n / 1024).toFixed(1).replace('.', tr(t(',', '.')))} ${tr(t('Ko', 'KB'))}`;

/** Erreur « l'utilisateur a refermé le menu de partage » : pas un vrai échec. */
const cancelled = (e: unknown) => e instanceof Error && /cancel|abort/i.test(`${e.name} ${e.message}`);

function QrView({ matrix }: { matrix: boolean[][] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const px = Math.max(2, Math.ceil((280 * dpr) / (matrix.length + 8)));
    const src = drawQr(matrix, px);
    el.width = src.width;
    el.height = src.height;
    el.getContext('2d')?.drawImage(src, 0, 0);
  }, [matrix]);
  return (
    <canvas
      ref={canvas}
      className="cr-qr"
      role="img"
      aria-label={tr(t('QR code de la création', 'QR code of the creation'))}
    />
  );
}

function Panel({ source, notify, onClose }: { source: ShareSource; notify: Notify; onClose: () => void }) {
  const { title, doc, createdAt } = source;
  const [tab, setTab] = useState<Tab>('file');
  const [busy, setBusy] = useState<string | null>(null);
  const painted = paintedCount(doc) > 0;
  const shared = useMemo(
    () => (painted ? { title, grid: toGrid(doc), createdAt } : null),
    [painted, title, doc, createdAt],
  );
  const file = useMemo(
    () => (shared ? new Blob([encodeTessel(shared) as BlobPart], { type: TESSEL_MIME }) : null),
    [shared],
  );
  const matrix = useMemo(() => (shared ? qrMatrix(shared) : null), [shared]);
  const pixels = useMemo(() => ({ w: doc.width, h: doc.height, rgba: docRgba(doc) }), [doc]);

  const run = (id: string, job: () => Promise<void>, done?: string) => {
    if (busy) return;
    setBusy(id);
    void job()
      .then(() => {
        if (done) notify(done);
      })
      .catch((e: unknown) => {
        if (!cancelled(e))
          notify(
            tr(
              t(
                'Le partage n’a pas pu s’ouvrir. Tu peux réessayer.',
                'Sharing could not open. You can try again.',
              ),
            ),
            'soft',
          );
      })
      .finally(() => {
        setBusy(null);
      });
  };

  const saved = tr(t('Enregistré sur ton téléphone', 'Saved to your phone'));
  const tabs = [
    { id: 'file', label: tr(t('Fichier', 'File')) },
    { id: 'qr', label: 'QR code' },
    { id: 'image', label: tr(t('Image', 'Image')) },
  ] as const;

  let pane: ReactNode;
  if (!shared || !file) {
    pane = (
      <p className="cr-share__empty">
        {tr(
          t(
            'Ta toile est encore vide. Peins quelques cases, puis reviens la partager.',
            'Your canvas is still empty. Paint a few squares, then come back to share it.',
          ),
        )}
      </p>
    );
  } else if (tab === 'file') {
    const name = fileName(title, 'tessel');
    pane = (
      <>
        <div className="cr-share__card">
          <PixelThumb pixels={pixels} box={84} radius={16} />
          <div>
            <strong>{name}</strong>
            <small>{kb(file.size)}</small>
          </div>
        </div>
        <p className="cr-share__text">
          {tr(
            t(
              'Un petit fichier que tes proches ouvrent directement dans Tessel pour colorier ton œuvre.',
              'A small file your friends open right in Tessel to color your artwork.',
            ),
          )}
        </p>
        <div className="cr-share__buttons">
          <Button
            variant="filled"
            disabled={busy !== null}
            onClick={() => {
              run('file', () => shareFile(file, name, title));
            }}
          >
            <span className="cr-btn-in">
              <IconShare size={18} />
              {tr(t('Partager le fichier', 'Share the file'))}
            </span>
          </Button>
          <Button
            variant="tonal"
            disabled={busy !== null}
            onClick={() => {
              run('save', () => saveToDevice(file, name), saved);
            }}
          >
            <span className="cr-btn-in">
              <IconDownload size={18} />
              {tr(t('Enregistrer', 'Save'))}
            </span>
          </Button>
        </div>
      </>
    );
  } else if (tab === 'qr') {
    pane = matrix ? (
      <>
        <div className="cr-share__qr">
          <QrView matrix={matrix} />
        </div>
        <p className="cr-share__text">
          {tr(
            t(
              'Ton ami le scanne depuis Créer › Recevoir une œuvre.',
              'Your friend scans it from Create › Receive an artwork.',
            ),
          )}
        </p>
        <div className="cr-share__buttons">
          <Button
            variant="filled"
            disabled={busy !== null}
            onClick={() => {
              run('qr', async () => {
                const blob = await canvasBlob(drawQr(matrix, 12));
                await shareFile(blob, fileName(`${title} qr`, 'png'), title);
              });
            }}
          >
            <span className="cr-btn-in">
              <IconShare size={18} />
              {tr(t('Partager l’image du QR', 'Share the QR image'))}
            </span>
          </Button>
        </div>
      </>
    ) : (
      <div className="cr-share__toobig">
        <strong>{tr(t('Trop grande pour un QR code', 'Too big for a QR code'))}</strong>
        <p>
          {tr(
            t(
              'Cette création est trop grande pour un QR code, partage le fichier.',
              'This creation is too big for a QR code, share the file instead.',
            ),
          )}
        </p>
        <Button
          variant="tonal"
          onClick={() => {
            setTab('file');
          }}
        >
          {tr(t('Voir le fichier', 'See the file'))}
        </Button>
      </div>
    );
  } else {
    const name = fileName(title, 'png');
    pane = (
      <>
        <div className="cr-share__image">
          <PixelThumb pixels={pixels} box={220} radius={18} />
        </div>
        <p className="cr-share__text">
          {tr(
            t(
              'Une image PNG nette, agrandie case par case, fond transparent.',
              'A crisp PNG, enlarged square by square, with a transparent background.',
            ),
          )}
        </p>
        <div className="cr-share__buttons">
          <Button
            variant="filled"
            disabled={busy !== null}
            onClick={() => {
              run('png', async () => {
                await shareFile(await canvasBlob(renderPng(doc)), name, title);
              });
            }}
          >
            <span className="cr-btn-in">
              <IconShare size={18} />
              {tr(t('Partager l’image', 'Share the image'))}
            </span>
          </Button>
          <Button
            variant="tonal"
            disabled={busy !== null}
            onClick={() => {
              run('pngsave', async () => saveToDevice(await canvasBlob(renderPng(doc)), name), saved);
            }}
          >
            <span className="cr-btn-in">
              <IconDownload size={18} />
              {tr(t('Enregistrer', 'Save'))}
            </span>
          </Button>
        </div>
      </>
    );
  }

  return (
    <div className="cr-share">
      <div className="cr-sheet-head">
        <h3>{tr(t('Partager', 'Share'))}</h3>
        <p>« {title} »</p>
      </div>
      {shared && (
        <Segmented
          options={tabs}
          value={tab}
          onChange={setTab}
          label={tr(t('Façon de partager', 'Way to share'))}
          variant="segmented"
          layoutId="cr-share-tab"
        />
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={shared ? tab : 'empty'}
          className="cr-share__pane"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ type: 'spring', ...spring.snappy }}
        >
          {pane}
        </motion.div>
      </AnimatePresence>
      {!shared && (
        <Button variant="tonal" onClick={onClose}>
          {tr(t('Compris', 'Got it'))}
        </Button>
      )}
    </div>
  );
}

/** Partager une création : fichier .tessel, QR code ou image PNG. */
export function ShareSheet({
  source,
  onClose,
  notify,
}: {
  source: ShareSource | null;
  onClose: () => void;
  notify: Notify;
}) {
  const [shown, setShown] = useState(source);
  if (source && source !== shown) setShown(source);
  return (
    <Sheet open={source !== null} onClose={onClose} label={tr(t('Partager', 'Share'))}>
      {shown && <Panel source={shown} notify={notify} onClose={onClose} />}
    </Sheet>
  );
}
