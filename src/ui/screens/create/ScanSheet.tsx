import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { scanQr, type SharedArtwork } from '@/create/format';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { useNav } from '@/store/nav';
import { spring } from '@/theme/motion/tokens';
import { Button, IconButton } from '@/ui/kit';
import { useBackClose } from '@/ui/kit/backClose';
import { IconClose } from '@/ui/kit/icons';
import { IconCheckSmall, IconPhoto, IconQr } from './icons';

const SCAN_EVERY = 160; // ms : ~6 analyses par seconde
const SCAN_SIDE = 640;

type Status = 'starting' | 'scanning' | 'denied' | 'found';

/** Cherche un QR code d'œuvre dans une photo choisie (repli quand la caméra n'est pas disponible). */
async function scanPhoto(file: Blob) {
  const bitmap = await createImageBitmap(file);
  try {
    for (const side of [1400, 900, 500]) {
      const k = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * k));
      const h = Math.max(1, Math.round(bitmap.height * k));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;
      ctx.drawImage(bitmap, 0, 0, w, h);
      const found = scanQr(ctx.getImageData(0, 0, w, h));
      if (found) return found;
    }
    return null;
  } finally {
    bitmap.close();
  }
}

function ScanView({ onClose }: { onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>('starting');
  const [notice, setNotice] = useState<string | null>(null);
  useBackClose(true, onClose);

  const found = (art: SharedArtwork) => {
    setStatus('found');
    if ('vibrate' in navigator) navigator.vibrate(30);
    window.setTimeout(() => {
      useNav.getState().receiveShared(art);
      onClose();
    }, 380);
  };

  // caméra arrière + analyse régulière d'une image réduite
  useEffect(() => {
    const run = { stopped: false };
    let stream: MediaStream | null = null;
    let timer = 0;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const tick = () => {
      if (run.stopped) return;
      const v = video.current;
      if (v && ctx && v.readyState >= 2 && v.videoWidth > 0) {
        const k = Math.min(1, SCAN_SIDE / Math.max(v.videoWidth, v.videoHeight));
        canvas.width = Math.round(v.videoWidth * k);
        canvas.height = Math.round(v.videoHeight * k);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const art = scanQr(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (art) {
          run.stopped = true;
          found(art);
          return;
        }
      }
      timer = window.setTimeout(tick, SCAN_EVERY);
    };
    void (async () => {
      try {
        const media = (navigator as Partial<Navigator>).mediaDevices;
        if (!media) throw new Error('Pas de caméra');
        stream = await media.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (run.stopped) {
          for (const tk of stream.getTracks()) tk.stop();
          return;
        }
        const v = video.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play().catch(() => undefined);
        setStatus('scanning');
        tick();
      } catch {
        if (!run.stopped) setStatus('denied');
      }
    })();
    return () => {
      run.stopped = true;
      window.clearTimeout(timer);
      if (stream) for (const tk of stream.getTracks()) tk.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPhoto = (file: File | undefined) => {
    if (!file) return;
    setNotice(null);
    void scanPhoto(file)
      .then((art) => {
        if (art) found(art);
        else
          setNotice(
            tr(
              t(
                'Aucun QR code Tessel n’a été trouvé dans cette photo. Une autre photo, plus nette, peut être choisie.',
                'No Tessel QR code was found in this photo. You can pick another, sharper one.',
              ),
            ),
          );
      })
      .catch(() => {
        setNotice(tr(t('Cette image n’a pas pu être lue.', 'This image could not be read.')));
      });
  };

  const denied = status === 'denied';
  return (
    <motion.div
      className="cr-scan"
      role="dialog"
      aria-modal="true"
      aria-label={tr(t('Scanner un QR code', 'Scan a QR code'))}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <video ref={video} className="cr-scan__video" playsInline muted autoPlay />
      <div className="cr-scan__shade" />
      <header className="cr-scan__bar">
        <IconButton label={tr(t('Fermer', 'Close'))} onClick={onClose}>
          <IconClose />
        </IconButton>
        <h2>{tr(t('Scanner un QR code', 'Scan a QR code'))}</h2>
      </header>
      {denied && (
        <div className="cr-scan__denied">
          <span>
            <IconQr size={44} />
          </span>
          <strong>{tr(t('Pas de caméra pour le moment', 'No camera for now'))}</strong>
        </div>
      )}
      {!denied && (
        <div className="cr-scan__frame-wrap" aria-hidden>
          <motion.div
            className="cr-scan__frame"
            data-found={status === 'found'}
            animate={status === 'found' ? { scale: 1.06 } : { scale: [1, 1.03, 1] }}
            transition={
              status === 'found'
                ? { type: 'spring', ...spring.bouncy }
                : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
            }
          >
            <i />
            <i />
            <i />
            <i />
            {status === 'scanning' && <span className="cr-scan__line" />}
            {status === 'found' && (
              <span className="cr-scan__ok">
                <IconCheckSmall size={38} />
              </span>
            )}
          </motion.div>
        </div>
      )}
      <div className="cr-scan__foot">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={denied ? 'denied' : notice ? 'notice' : status}
            role="status"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {denied
              ? tr(
                  t(
                    'La caméra n’est pas accessible. Tu peux choisir une photo qui contient le QR code.',
                    'The camera is not available. You can pick a photo that contains the QR code.',
                  ),
                )
              : (notice ??
                (status === 'found'
                  ? tr(t('Œuvre trouvée !', 'Artwork found!'))
                  : status === 'starting'
                    ? tr(t('Ouverture de la caméra…', 'Opening the camera…'))
                    : tr(
                        t(
                          'Place le QR code d’une œuvre Tessel dans le cadre.',
                          'Place a Tessel artwork QR code inside the frame.',
                        ),
                      )))}
          </motion.p>
        </AnimatePresence>
        <Button
          variant={denied ? 'filled' : 'tonal'}
          onClick={() => {
            picker.current?.click();
          }}
        >
          <span className="cr-btn-in">
            <IconPhoto size={18} />
            {tr(t('Choisir une photo', 'Choose a photo'))}
          </span>
        </Button>
        <input
          ref={picker}
          type="file"
          accept="image/*"
          hidden
          aria-label={tr(t('Photo contenant un QR code', 'Photo containing a QR code'))}
          onChange={(e) => {
            onPhoto(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
    </motion.div>
  );
}

/** Scanner de QR code plein écran (caméra arrière), avec repli sur une photo. */
export function ScanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return createPortal(
    <AnimatePresence>{open && <ScanView key="scan" onClose={onClose} />}</AnimatePresence>,
    document.body,
  );
}
