import { Capacitor } from '@capacitor/core';
import type { DbDriver } from './driver';
import { migrate } from './migrations';

const DB_NAME = 'tessel';
const IDB_STORE = 'files';

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('tessel-web', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => {
      resolve(req.result);
    };
    req.onerror = () => {
      reject(req.error ?? new Error('IndexedDB indisponible'));
    };
  });
}

async function idbGet(key: string): Promise<Uint8Array | undefined> {
  const db = await idb();
  return new Promise((resolve) => {
    const req = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(key);
    req.onsuccess = () => {
      resolve(req.result instanceof Uint8Array ? req.result : undefined);
    };
    req.onerror = () => {
      resolve(undefined);
    };
  });
}

async function idbPut(key: string, value: Uint8Array): Promise<void> {
  const db = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => {
      reject(tx.error ?? new Error('Écriture IndexedDB impossible'));
    };
  });
}

/** Navigateur (développement) : sql.js persisté dans IndexedDB, écritures regroupées. */
async function openWeb(): Promise<DbDriver> {
  const [{ default: initSqlJs }, { default: wasmUrl }, { SqlJsDriver }] = await Promise.all([
    import('sql.js'),
    import('sql.js/dist/sql-wasm.wasm?url'),
    import('./SqlJsDriver'),
  ]);
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const saved = await idbGet(DB_NAME).catch(() => undefined);
  let timer: ReturnType<typeof setTimeout> | null = null;
  return new SqlJsDriver(new SQL.Database(saved), (db) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void idbPut(DB_NAME, db.export());
    }, 400);
  });
}

let opening: Promise<DbDriver> | null = null;

/** Ouvre (une seule fois) la base de l'application et applique les migrations. */
export function openDatabase(): Promise<DbDriver> {
  opening ??= (async () => {
    let db: DbDriver;
    if (Capacitor.isNativePlatform()) {
      const { CapacitorSqliteDriver } = await import('./CapacitorSqliteDriver');
      db = await CapacitorSqliteDriver.open(DB_NAME);
    } else {
      db = await openWeb();
    }
    await migrate(db);
    return db;
  })();
  return opening;
}
