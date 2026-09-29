import { describe, expect, it } from 'vitest';
import { MIGRATIONS, SCHEMA_VERSION, migrate, schemaVersion } from './migrations';
import { createTestDb } from './testing';

describe('migrations', () => {
  it('crée le schéma et les lignes uniques du joueur', async () => {
    const db = await createTestDb();
    expect(await schemaVersion(db)).toBe(0);
    expect(await migrate(db, 1234)).toBe(SCHEMA_VERSION);
    const player = await db.query<{ level: number; created_at: number }>(
      'SELECT level, created_at FROM player',
    );
    expect(player).toEqual([{ level: 1, created_at: 1234 }]);
    const streak = await db.query<{ freezes: number }>('SELECT freezes FROM streak');
    expect(streak).toEqual([{ freezes: 1 }]);
  });

  it('est idempotente', async () => {
    const db = await createTestDb();
    await migrate(db);
    await migrate(db);
    expect(await db.query('SELECT * FROM player')).toHaveLength(1);
  });

  it('versions strictement croissantes', () => {
    MIGRATIONS.forEach((m, i) => {
      expect(m.version).toBe(i + 1);
    });
  });

  it('refuse une base plus récente que l’application', async () => {
    const db = await createTestDb();
    await db.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
    await expect(migrate(db)).rejects.toThrow(/plus récente/);
  });

  it('annule une migration en échec sans laisser de schéma partiel', async () => {
    const db = await createTestDb();
    await expect(
      db.transaction(async () => {
        await db.exec('CREATE TABLE t (x INTEGER)');
        throw new Error('boum');
      }),
    ).rejects.toThrow('boum');
    expect(await db.query("SELECT name FROM sqlite_master WHERE name = 't'")).toHaveLength(0);
  });

  it('supprime le journal en cascade avec le projet', async () => {
    const db = await createTestDb();
    await migrate(db);
    await db.run(
      `INSERT INTO projects (id, artwork_id, source, mode, width, height, colors, grid, total, created_at, updated_at)
       VALUES ('p', 'a', 'library', 'pixel', 1, 1, 1, '', 1, 0, 0)`,
    );
    await db.run("INSERT INTO journal (project_id, seq, ops) VALUES ('p', 1, '')");
    await db.run("DELETE FROM projects WHERE id = 'p'");
    expect(await db.query('SELECT * FROM journal')).toHaveLength(0);
  });
});
