import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { lazy, Suspense, useEffect, useState } from 'react';
import { getServices } from '@/app/services';
import { createDoc } from '@/create/document';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { useNav } from '@/store/nav';
import { spring } from '@/theme/motion/tokens';
import { Skeleton } from '@/ui/kit';
import type { EditorInitial } from './editor/EditorView';
import { useEditorStore, type EditorTarget } from './store';
import './create.css';

// l'éditeur (canvas, feuilles) ne se charge que quand on l'ouvre
const EditorView = lazy(() => import('./editor/EditorView'));

function EditorSkeleton() {
  return (
    <div className="cr-view" aria-busy="true">
      <div className="cr-top">
        <Skeleton width={44} height={44} radius={22} />
        <div className="cr-top__title">
          <Skeleton width="60%" height={20} />
        </div>
      </div>
      <div className="cr-main">
        <div className="cr-stage">
          <Skeleton width="100%" height="100%" radius={22} />
        </div>
      </div>
      <div className="cr-dock" style={{ height: 150 }} />
    </div>
  );
}

/** Charge la création (ou prépare la toile vierge), puis monte l'éditeur. */
function Loader({ target }: { target: EditorTarget }) {
  const [loaded, setLoaded] = useState<EditorInitial | 'missing' | null>(() =>
    target.kind === 'new'
      ? {
          id: null,
          title: target.spec.title.trim() || tr(t('Ma création', 'My creation')),
          doc: createDoc(
            target.spec.width,
            target.spec.height,
            target.spec.palette,
            `${tr(t('Calque', 'Layer'))} 1`,
          ),
          createdAt: Date.now(),
        }
      : null,
  );
  useEffect(() => {
    if (target.kind !== 'saved') return;
    let alive = true;
    void getServices()
      .then((s) => s.creations.get(target.id))
      .then((c) => {
        if (!alive) return;
        setLoaded(
          c ? { id: c.meta.id, title: c.meta.title, doc: c.doc, createdAt: c.meta.createdAt } : 'missing',
        );
      })
      .catch(() => {
        if (alive) setLoaded('missing');
      });
    return () => {
      alive = false;
    };
  }, [target]);
  useEffect(() => {
    if (loaded === 'missing') useEditorStore.getState().close();
  }, [loaded]);
  if (!loaded || loaded === 'missing') return <EditorSkeleton />;
  return <EditorView initial={loaded} />;
}

/**
 * Éditeur plein écran, monté une fois pour toute l'application : au-dessus de la barre d'onglets
 * (comme le jeu, mais dessous : lancer une partie depuis l'éditeur passe devant).
 */
export function EditorHost() {
  const target = useEditorStore((s) => s.target);
  const playing = useNav((s) => s.playing);
  const reduced = useReducedMotion();
  return (
    <AnimatePresence>
      {target && (
        <motion.div
          key={target.token}
          className="cr-editor"
          role="dialog"
          aria-label={tr(t('Éditeur de pixel art', 'Pixel art editor'))}
          aria-hidden={playing}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.98 }}
          transition={{ type: 'spring', ...spring.sheet }}
        >
          <Suspense fallback={<EditorSkeleton />}>
            <Loader target={target} />
          </Suspense>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
