import { useState, useSyncExternalStore } from 'react';
import type { Rgb } from '@/content/grid';
import type { Editor, Symmetry, Tool } from '@/create/Editor';

/** Ce que l'interface affiche de l'éditeur (le modèle, lui, est modifié en place). */
export interface EditorSnap {
  tool: Tool;
  symmetry: Symmetry;
  brush: number;
  color: number;
  active: number;
  canUndo: boolean;
  canRedo: boolean;
  palette: readonly Rgb[];
  layers: readonly { id: string; name: string; visible: boolean }[];
}

function read(editor: Editor): EditorSnap {
  return {
    tool: editor.tool,
    symmetry: editor.symmetry,
    brush: editor.brush,
    color: editor.color,
    active: editor.active,
    canUndo: editor.canUndo,
    canRedo: editor.canRedo,
    palette: editor.doc.palette.map((c) => [c[0], c[1], c[2]] as const),
    layers: editor.doc.layers.map((l) => ({ id: l.id, name: l.name, visible: l.visible })),
  };
}

/** Instantané stable : un nouvel objet seulement quand quelque chose d'affiché a vraiment changé. */
function createSnapStore(editor: Editor) {
  let snap = read(editor);
  let key = JSON.stringify(snap);
  const subs = new Set<() => void>();
  let off: (() => void) | null = null;
  const refresh = () => {
    const next = read(editor);
    const k = JSON.stringify(next);
    if (k === key) return false;
    key = k;
    snap = next;
    return true;
  };
  return {
    subscribe: (cb: () => void) => {
      subs.add(cb);
      if (subs.size === 1) {
        refresh();
        off = editor.on((change) => {
          // un trait ne change l'affichage que s'il active ou grise annuler / rétablir
          if (change === 'cells' && editor.canUndo === snap.canUndo && editor.canRedo === snap.canRedo)
            return;
          if (refresh()) for (const s of subs) s();
        });
      }
      return () => {
        subs.delete(cb);
        if (subs.size === 0) {
          off?.();
          off = null;
        }
      };
    },
    getSnapshot: () => snap,
  };
}

export function useEditorSnap(editor: Editor): EditorSnap {
  const [store] = useState(() => createSnapStore(editor));
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
