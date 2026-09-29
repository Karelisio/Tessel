import { create } from 'zustand';
import { CreationStore } from '@/create/CreationStore';
import { loadLibrary } from '@/content/library';
import type { LibraryIndex } from '@/content/library/types';
import { openDatabase } from '@/db';
import type { DbDriver } from '@/db/driver';
import { ProgressStore } from '@/db/ProgressStore';
import { MetaService } from '@/meta/MetaService';
import { OffsetClock } from '@/meta/time';
import { Preferences } from '@capacitor/preferences';
import { useMetaStore } from '@/store/meta';

export interface Services {
  db: DbDriver;
  store: ProgressStore;
  creations: CreationStore;
  meta: MetaService;
  library: LibraryIndex | null;
}

/** Horloge de la méta-progression : décalable depuis le menu debug (« forcer la date »). */
export const debugClock = new OffsetClock(0);
export const DEBUG_OFFSET_KEY = 'tessel.debug.offsetMs';

let pending: Promise<Services> | null = null;

/** Services de l'application (base, progression, bibliothèque), ouverts une seule fois. */
export function getServices(): Promise<Services> {
  pending ??= (async () => {
    const db = await openDatabase();
    const store = new ProgressStore(db);
    const saved = await Preferences.get({ key: DEBUG_OFFSET_KEY }).catch(() => ({ value: null }));
    debugClock.offsetMs = Number(saved.value ?? 0) || 0;
    const meta = await MetaService.open(db, { clock: debugClock });
    useMetaStore.getState().attach(meta);
    const library = await loadLibrary().catch((e: unknown) => {
      console.error('Bibliothèque indisponible', e);
      return null;
    });
    const s = { db, store, creations: new CreationStore(db), meta, library };
    useServices.setState({ services: s });
    return s;
  })();
  pending.catch(() => {
    pending = null;
  });
  return pending;
}

/** Accès réactif aux services (null tant qu'ils s'ouvrent). */
export const useServices = create<{ services: Services | null }>(() => ({ services: null }));

/** Version des données de partie : incrémentée à chaque sauvegarde marquante (listes à rafraîchir). */
export const useDataVersion = create<{ version: number; bump: () => void }>((set) => ({
  version: 0,
  bump: () => {
    set((s) => ({ version: s.version + 1 }));
  },
}));
