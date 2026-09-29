import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type Variants,
} from 'framer-motion';
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLibrary } from '@/app/queries';
import { refForProject } from '@/content/refs';
import type { ProjectMeta } from '@/db/ProgressStore';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import type { UnlockKey } from '@/meta/catalog';
import { renderHd, isCancel, isNative, useCanExportMp4 } from './actions';
import { shareFile, saveToDevice } from '@/render/exports';
import { useNav } from '@/store/nav';
import { duration, easing, spring } from '@/theme/motion/tokens';
import { Button, IconButton } from '@/ui/kit';
import { useBackClose } from '@/ui/kit/backClose';
import { IconClose } from '@/ui/kit/icons';
import { IconFrame, IconReplay } from '../profile/icons';
import { fmt, formatDate, formatDuration } from '../profile/format';
import { Glint } from './ArtFrame';
import { FrameSheet } from './FrameSheet';
import { IconDownload, IconGif, IconPhone, IconShare, IconVideo } from './icons';
import { categoryName, displayTitle, frameGeometry, modeName } from './model';
import { TimelapseSheet, type TimelapseRequest } from './TimelapseSheet';
import type { Notify } from './Toast';
import { useThumb } from './thumbs';
import { WallpaperSheet } from './WallpaperSheet';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

type Sheet = 'frame' | 'wallpaper' | 'timelapse' | null;

function Tile({
  icon,
  label,
  busy = false,
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      className="gg-tile"
      data-busy={busy}
      disabled={disabled}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', ...spring.snappy }}
      onClick={onClick}
    >
      <span className="gg-tile__icon">
        {busy ? (
          <motion.span
            className="gg-spinner"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
          />
        ) : (
          icon
        )}
      </span>
      <span className="gg-tile__label">{label}</span>
    </motion.button>
  );
}

const rise: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: 'spring', ...spring.gentle, delay: 0.16 + i * 0.05 },
  }),
};

/** Une œuvre de près : zoom depuis le mur, légère rotation 3D qui suit le doigt, infos et actions. */
export function Detail({
  project,
  from,
  unlockedFrames,
  notify,
  onClose,
}: {
  project: ProjectMeta;
  /** Où l'œuvre était accrochée : elle s'en détache, et y retourne à la fermeture. */
  from: DOMRect | null;
  unlockedFrames: readonly UnlockKey[];
  notify: Notify;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  const library = useLibrary();
  const mp4 = useCanExportMp4();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [request, setRequest] = useState<TimelapseRequest | null>(null);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const run = useRef(0);
  const stage = useRef<HTMLDivElement>(null);
  const plate = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);

  // transition partagée : le cadre quitte le mur et vient se poser au centre (et inversement)
  const fx = useMotionValue(0);
  const fy = useMotionValue(0);
  const fs = useMotionValue(1);
  const fo = useMotionValue(from && !reduced ? 0 : 1);
  useLayoutEffect(() => {
    const el = plate.current;
    if (!el || !from || reduced) {
      fo.set(1);
      return;
    }
    const to = el.getBoundingClientRect();
    fx.set(from.left + from.width / 2 - (to.left + to.width / 2));
    fy.set(from.top + from.height / 2 - (to.top + to.height / 2));
    fs.set(from.width / to.width);
    fo.set(1);
    const cfg = { type: 'spring', ...spring.gentle } as const;
    const runs = [animate(fx, 0, cfg), animate(fy, 0, cfg), animate(fs, 1, cfg)];
    return () => {
      runs.forEach((r) => {
        r.stop();
      });
    };
  }, [from, reduced, fx, fy, fs, fo]);

  const base = { id: project.id, updatedAt: project.updatedAt, frame: project.frame };
  const small = useThumb({ ...base, size: 480 }, true);
  const large = useThumb({ ...base, size: 900 }, true);
  const url = large.url ?? small.url;
  const geometry = useMemo(
    () => frameGeometry(project.width, project.height),
    [project.width, project.height],
  );

  // rotation 3D qui suit le doigt, reflet de lumière qui glisse avec lui
  const rx = useSpring(useMotionValue(0), { stiffness: 190, damping: 20, mass: 0.8 });
  const ry = useSpring(useMotionValue(0), { stiffness: 190, damping: 20, mass: 0.8 });
  const gx = useSpring(useMotionValue(38), { stiffness: 220, damping: 26 });
  const gy = useSpring(useMotionValue(24), { stiffness: 220, damping: 26 });
  const glare = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.62), rgba(255,255,255,0) 52%)`;
  const follow = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = clamp01((e.clientX - r.left) / r.width);
    const py = clamp01((e.clientY - r.top) / r.height);
    ry.set((px - 0.5) * 30);
    rx.set(-(py - 0.5) * 26);
    gx.set(px * 100);
    gy.set(py * 100);
  };
  const rest = () => {
    rx.set(0);
    ry.set(0);
    gx.set(38);
    gy.set(24);
  };

  const close = () => {
    if (leaving.current) return;
    leaving.current = true;
    const el = plate.current;
    const target = document.querySelector(`[data-art="${project.id}"]`)?.getBoundingClientRect();
    if (!el || !target || reduced || target.bottom < 0 || target.top > window.innerHeight) {
      onClose();
      return;
    }
    const now = el.getBoundingClientRect();
    const cfg = { duration: duration.lg / 1000, ease: easing.standard } as const;
    rx.set(0);
    ry.set(0);
    animate(fx, fx.get() + target.left + target.width / 2 - (now.left + now.width / 2), cfg);
    animate(fy, fy.get() + target.top + target.height / 2 - (now.top + now.height / 2), cfg);
    animate(fs, fs.get() * (target.width / now.width), cfg).then(onClose, onClose);
  };
  useBackClose(true, close);

  const title = displayTitle(project);
  const mode = modeName(project.mode);
  const category = categoryName(project.category);

  const replay = () => {
    const rect = stage.current?.querySelector('img')?.getBoundingClientRect();
    useNav.getState().open(refForProject(project, library), {
      timelapse: true,
      ...(rect && { origin: { rect, image: url } }),
    });
    onClose();
  };

  const startExport = (format: TimelapseRequest['format']) => {
    run.current += 1;
    setRequest({ run: run.current, format });
    setSheet('timelapse');
  };

  const hd = async (kind: 'save' | 'share') => {
    setBusy(kind);
    try {
      const { blob, name, title: label } = await renderHd(project);
      if (kind === 'save') {
        await saveToDevice(blob, name);
        notify(
          isNative()
            ? tr(
                t(
                  'Image enregistrée dans ta galerie, dossier Tessel.',
                  'Image saved to your gallery, Tessel folder.',
                ),
              )
            : tr(t('Image téléchargée.', 'Image downloaded.')),
        );
      } else {
        await shareFile(blob, name, label);
      }
    } catch (e) {
      if (!isCancel(e))
        notify(
          tr(
            t(
              'Ça n’a pas fonctionné cette fois. Réessaie dans un instant.',
              'That didn’t work this time. Try again in a moment.',
            ),
          ),
          'soft',
        );
    } finally {
      setBusy(null);
    }
  };

  const facts: [string, string][] = [
    [tr(t('Dimensions', 'Dimensions')), `${fmt(project.width)} × ${fmt(project.height)}`],
    [tr(t('Couleurs', 'Colors')), fmt(project.colors)],
    [tr(t('Terminée le', 'Finished on')), formatDate(project.completedAt ?? project.updatedAt)],
    [tr(t('Temps passé', 'Time spent')), formatDuration(project.timeMs)],
  ];

  return (
    <>
      <motion.div
        className="gg-detail"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.26 }}
      >
        <div className="gg-detail__spot" aria-hidden />
        <header className="gg-detail__bar">
          <IconButton label={tr(t('Fermer', 'Close'))} onClick={close}>
            <IconClose size={22} />
          </IconButton>
        </header>
        <div className="gg-detail__scroll">
          <div
            ref={stage}
            className="gg-stage"
            style={geometry}
            onPointerMove={follow}
            onPointerDown={follow}
            onPointerUp={rest}
            onPointerCancel={rest}
            onPointerLeave={rest}
          >
            <motion.div className="gg-tilt" style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}>
              <motion.div
                ref={plate}
                style={{ x: fx, y: fy, scale: fs, opacity: fo }}
                className="gg-plate gg-plate--detail"
              >
                <span className="gg-cast gg-cast--detail" aria-hidden />
                <div className="gg-plate__in">
                  {url ? (
                    <img className="gg-art" src={url} alt={title} draggable={false} />
                  ) : (
                    <span className="gg-ghost" />
                  )}
                  {url && <motion.span className="gg-glare" aria-hidden style={{ background: glare }} />}
                  {url && project.mode === 'diamond' && <Glint />}
                </div>
              </motion.div>
            </motion.div>
          </div>

          <motion.section className="gg-info" initial="hidden" animate="show">
            <motion.p className="gg-eyebrow" variants={rise} custom={0}>
              {mode}
              {category !== null && <span> · {category}</span>}
            </motion.p>
            <motion.h2 className="gg-info__title" variants={rise} custom={1}>
              {title}
            </motion.h2>
            <motion.dl className="gg-facts" variants={rise} custom={2}>
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </motion.dl>

            <motion.div className="gg-actions" variants={rise} custom={3}>
              <Button variant="filled" onClick={replay}>
                <span className="gg-btn">
                  <IconReplay size={20} />
                  {tr(t('Revoir la création', 'Replay the creation'))}
                </span>
              </Button>
              <div className="gg-tiles">
                <Tile
                  icon={<IconFrame size={22} />}
                  label={tr(t('Changer le cadre', 'Change frame'))}
                  onClick={() => {
                    setSheet('frame');
                  }}
                />
                <Tile
                  icon={<IconDownload size={22} />}
                  label={tr(t('Image HD', 'HD image'))}
                  busy={busy === 'save'}
                  disabled={busy !== null}
                  onClick={() => {
                    void hd('save');
                  }}
                />
                <Tile
                  icon={<IconShare size={22} />}
                  label={tr(t('Partager', 'Share'))}
                  busy={busy === 'share'}
                  disabled={busy !== null}
                  onClick={() => {
                    void hd('share');
                  }}
                />
                {mp4 === true && (
                  <Tile
                    icon={<IconVideo size={22} />}
                    label={tr(t('Vidéo MP4', 'MP4 video'))}
                    onClick={() => {
                      startExport('mp4');
                    }}
                  />
                )}
                <Tile
                  icon={<IconGif size={22} />}
                  label={tr(t('GIF animé', 'Animated GIF'))}
                  onClick={() => {
                    startExport('gif');
                  }}
                />
                <Tile
                  icon={<IconPhone size={22} />}
                  label={tr(t('Fond d’écran', 'Wallpaper'))}
                  onClick={() => {
                    setSheet('wallpaper');
                  }}
                />
              </div>
            </motion.div>
          </motion.section>
        </div>
      </motion.div>

      <FrameSheet
        open={sheet === 'frame'}
        onClose={() => {
          setSheet(null);
        }}
        project={project}
        unlocked={unlockedFrames}
        notify={notify}
      />
      <TimelapseSheet
        open={sheet === 'timelapse'}
        onClose={() => {
          setSheet(null);
        }}
        project={project}
        request={request}
        thumb={small.url}
        notify={notify}
      />
      <WallpaperSheet
        open={sheet === 'wallpaper'}
        onClose={() => {
          setSheet(null);
        }}
        project={project}
        notify={notify}
      />
    </>
  );
}
