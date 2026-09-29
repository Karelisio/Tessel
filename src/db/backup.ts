import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { DbDriver, SqlValue } from './driver';
import { SCHEMA_VERSION, schemaVersion } from './migrations';

/** Tables sauvegardées, dans un ordre compatible avec les clés étrangères (parents d'abord). */
export const BACKUP_TABLES = [
  'player',
  'inventory',
  'unlocks',
  'achievements',
  'quests',
  'streak',
  'stats',
  'stats_daily',
  'color_usage',
  'rewards_claimed',
  'creations',
  'projects',
  'journal',
  'gallery_walls',
  'gallery_items',
] as const;

export const BACKUP_FORMAT = 1;

export interface BackupManifest {
  app: 'tessel';
  format: number;
  schema: number;
  appVersion: string;
  exportedAt: number;
  counts: Record<string, number>;
}

type Row = Record<string, SqlValue>;

/** Export complet de la progression : archive .zip (manifest + une table JSON par fichier). */
export async function exportBackup(db: DbDriver, appVersion: string, now = Date.now()): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  const counts: Record<string, number> = {};
  for (const table of BACKUP_TABLES) {
    const rows = await db.query<Row>(`SELECT * FROM ${table}`);
    counts[table] = rows.length;
    files[`data/${table}.json`] = strToU8(JSON.stringify(rows));
  }
  const manifest: BackupManifest = {
    app: 'tessel',
    format: BACKUP_FORMAT,
    schema: await schemaVersion(db),
    appVersion,
    exportedAt: now,
    counts,
  };
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  return zipSync(files, { level: 6 });
}

export class BackupError extends Error {}

/** Lit et valide le manifeste d'une archive sans rien modifier. */
export function readBackupManifest(bytes: Uint8Array): BackupManifest {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (f) => f.name === 'manifest.json' });
  } catch {
    throw new BackupError('Fichier de sauvegarde illisible');
  }
  const raw = files['manifest.json'];
  if (!raw) throw new BackupError('Ce fichier n’est pas une sauvegarde Tessel');
  const manifest = JSON.parse(strFromU8(raw)) as Partial<BackupManifest>;
  if (
    manifest.app !== 'tessel' ||
    typeof manifest.format !== 'number' ||
    typeof manifest.schema !== 'number'
  ) {
    throw new BackupError('Ce fichier n’est pas une sauvegarde Tessel');
  }
  if (manifest.format > BACKUP_FORMAT || manifest.schema > SCHEMA_VERSION) {
    throw new BackupError(
      'Sauvegarde créée par une version plus récente de Tessel : mettez l’application à jour',
    );
  }
  return manifest as BackupManifest;
}

/**
 * Remplace toute la progression par celle de l'archive, dans une seule transaction.
 * Les colonnes inconnues sont ignorées et les colonnes absentes prennent leur valeur par défaut :
 * une sauvegarde d'une version plus ancienne s'importe dans le schéma actuel.
 */
export async function importBackup(db: DbDriver, bytes: Uint8Array): Promise<BackupManifest> {
  const manifest = readBackupManifest(bytes);
  const files = unzipSync(bytes);
  await db.transaction(async () => {
    for (const table of [...BACKUP_TABLES].reverse()) await db.run(`DELETE FROM ${table}`);
    for (const table of BACKUP_TABLES) {
      const raw = files[`data/${table}.json`];
      if (!raw) continue;
      const rows = JSON.parse(strFromU8(raw)) as Row[];
      if (rows.length === 0) continue;
      const known = new Set(
        (await db.query<{ name: string }>(`PRAGMA table_info(${table})`)).map((c) => c.name),
      );
      for (const row of rows) {
        const cols = Object.keys(row).filter((c) => known.has(c));
        if (cols.length === 0) continue;
        await db.run(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          cols.map((c) => row[c] ?? null),
        );
      }
    }
  });
  return manifest;
}
