import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { sunsetLake } from '@/content/generators/sunsetLake';
import { BackupError, exportBackup, importBackup } from './backup';
import { Op } from './codecs';
import { SCHEMA_VERSION, migrate } from './migrations';
import { ProgressStore } from './ProgressStore';
import { createTestDb } from './testing';

async function seeded() {
  const db = await createTestDb();
  await migrate(db);
  const store = new ProgressStore(db);
  const { id } = await store.create({
    artworkId: 'sunset',
    source: 'library',
    mode: 'diamond',
    grid: sunsetLake(48, 48, 1),
  });
  await store.append(
    id,
    [
      { op: Op.Place, index: 3 },
      { op: Op.Place, index: 4 },
    ],
    2,
    900,
  );
  await db.run('UPDATE player SET xp = 1234, level = 5');
  await db.run("INSERT INTO inventory (item, count) VALUES ('wand', 2)");
  return { db, store, id };
}

describe('sauvegarde complète', () => {
  it('exporte puis réimporte toute la progression à l’identique', async () => {
    const src = await seeded();
    const zip = await exportBackup(src.db, '1.2.3', 42);

    const dst = await createTestDb();
    await migrate(dst);
    const manifest = await importBackup(dst, zip);
    expect(manifest).toMatchObject({
      app: 'tessel',
      schema: SCHEMA_VERSION,
      appVersion: '1.2.3',
      exportedAt: 42,
    });
    expect(await dst.query('SELECT xp, level FROM player')).toEqual([{ xp: 1234, level: 5 }]);
    expect(await dst.query('SELECT item, count FROM inventory')).toEqual([{ item: 'wand', count: 2 }]);
    const loaded = await new ProgressStore(dst).load(src.id);
    expect(loaded.history).toEqual([3, 4]);
    expect(loaded.meta.mode).toBe('diamond');
  });

  it('remplace la progression existante au lieu de la fusionner', async () => {
    const src = await seeded();
    const zip = await exportBackup(src.db, '1.0.0');
    const dst = await seeded();
    await dst.db.run("INSERT INTO inventory (item, count) VALUES ('loupe', 9)");
    await importBackup(dst.db, zip);
    expect(await dst.db.query('SELECT item FROM inventory ORDER BY item')).toEqual([{ item: 'wand' }]);
    expect(await dst.db.query('SELECT id FROM projects')).toHaveLength(1);
  });

  it('refuse un fichier qui n’est pas une sauvegarde, sans rien modifier', async () => {
    const dst = await seeded();
    await expect(importBackup(dst.db, new Uint8Array([1, 2, 3]))).rejects.toBeInstanceOf(BackupError);
    const foreign = zipSync({ 'manifest.json': strToU8('{"app":"autre"}') });
    await expect(importBackup(dst.db, foreign)).rejects.toThrow(/pas une sauvegarde/);
    expect(await dst.db.query('SELECT id FROM projects')).toHaveLength(1);
  });

  it('refuse une sauvegarde d’une version plus récente', async () => {
    const dst = await seeded();
    const future = zipSync({
      'manifest.json': strToU8(JSON.stringify({ app: 'tessel', format: 1, schema: SCHEMA_VERSION + 1 })),
    });
    await expect(importBackup(dst.db, future)).rejects.toThrow(/plus récente/);
  });

  it('ignore les colonnes inconnues (sauvegarde d’une autre version)', async () => {
    const dst = await seeded();
    const zip = zipSync({
      'manifest.json': strToU8(JSON.stringify({ app: 'tessel', format: 1, schema: 1 })),
      'data/inventory.json': strToU8(JSON.stringify([{ item: 'pot', count: 3, obsolete: 'x' }])),
    });
    await importBackup(dst.db, zip);
    expect(await dst.db.query('SELECT item, count FROM inventory')).toEqual([{ item: 'pot', count: 3 }]);
  });
});
