import { useCallback, useEffect, useRef, useState } from 'react';
import { getServices } from '@/app/services';
import { paintedCount } from '@/create/document';
import type { Editor } from '@/create/Editor';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

const DELAY = 1500;

/**
 * Enregistrement automatique : ~1,5 s après la dernière modification, et tout de suite quand on
 * quitte, qu'on lance une partie ou que l'application passe en arrière-plan.
 * La création n'est écrite en base qu'à partir du premier trait (pas de toile vide oubliée).
 */
export function useAutosave(editor: Editor, initialId: string | null, title: { current: string }) {
  const [status, setStatus] = useState<SaveStatus>(initialId ? 'saved' : 'idle');
  const [hasId, setHasId] = useState(initialId !== null);
  const id = useRef(initialId);
  const dirty = useRef(false);
  const timer = useRef(0);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const alive = useRef(true);

  const write = useCallback((): Promise<void> => {
    chain.current = chain.current.then(async () => {
      if (!dirty.current) return;
      if (id.current === null && paintedCount(editor.doc) === 0) {
        dirty.current = false;
        if (alive.current) setStatus('idle');
        return;
      }
      dirty.current = false;
      if (alive.current) setStatus('saving');
      try {
        const { creations } = await getServices();
        id.current = await creations.save(id.current, title.current, editor.doc);
        if (alive.current) setHasId(true);
        if (alive.current) setStatus((dirty.current as boolean) ? 'pending' : 'saved');
      } catch (e) {
        console.error('Enregistrement impossible', e);
        dirty.current = true;
        if (alive.current) setStatus('error');
      }
    });
    return chain.current;
  }, [editor, title]);

  const flush = useCallback((): Promise<void> => {
    window.clearTimeout(timer.current);
    return write();
  }, [write]);

  const markDirty = useCallback(() => {
    dirty.current = true;
    setStatus('pending');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void write();
    }, DELAY);
  }, [write]);

  useEffect(() => {
    alive.current = true;
    const off = editor.on((c) => {
      if (c !== 'state') markDirty();
    });
    const leave = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', leave);
    window.addEventListener('pagehide', leave);
    return () => {
      off();
      document.removeEventListener('visibilitychange', leave);
      window.removeEventListener('pagehide', leave);
      void flush();
      alive.current = false;
    };
  }, [editor, markDirty, flush]);

  // en cas d'échec, un nouvel essai discret
  useEffect(() => {
    if (status !== 'error') return;
    const retry = window.setTimeout(() => {
      void write();
    }, 4000);
    return () => {
      window.clearTimeout(retry);
    };
  }, [status, write]);

  return { status, hasId, markDirty, flush, id };
}
