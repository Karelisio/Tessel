import { queryOne, type DbDriver } from './driver';

export interface Migration {
  version: number;
  description: string;
  sql: string;
}

/**
 * Migrations versionnées, appliquées dans l'ordre et une seule fois (PRAGMA user_version).
 * Règle : ne jamais modifier une migration publiée, toujours en ajouter une nouvelle.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'schéma initial',
    sql: /* sql */ `
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  artwork_id TEXT NOT NULL,
  source TEXT NOT NULL,
  mode TEXT NOT NULL,
  title TEXT,
  category TEXT,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  colors INTEGER NOT NULL,
  grid TEXT NOT NULL,
  snapshot TEXT,
  snapshot_seq INTEGER NOT NULL DEFAULT 0,
  next_seq INTEGER NOT NULL DEFAULT 1,
  filled INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  time_ms INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER,
  thumbnail TEXT
);
CREATE INDEX projects_artwork ON projects(artwork_id, mode);
CREATE INDEX projects_updated ON projects(updated_at DESC);

CREATE TABLE journal (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  ops TEXT NOT NULL,
  PRIMARY KEY (project_id, seq)
);

CREATE TABLE player (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE inventory (item TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0);
CREATE TABLE unlocks (key TEXT PRIMARY KEY, unlocked_at INTEGER NOT NULL, seen INTEGER NOT NULL DEFAULT 0);
CREATE TABLE achievements (id TEXT PRIMARY KEY, progress INTEGER NOT NULL DEFAULT 0, unlocked_at INTEGER);
CREATE TABLE quests (
  id TEXT PRIMARY KEY,
  period TEXT NOT NULL,
  period_key TEXT NOT NULL,
  template TEXT NOT NULL,
  params TEXT NOT NULL,
  target INTEGER NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  claimed_at INTEGER
);
CREATE INDEX quests_period ON quests(period, period_key);
CREATE TABLE streak (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  current INTEGER NOT NULL DEFAULT 0,
  best INTEGER NOT NULL DEFAULT 0,
  last_day TEXT,
  freezes INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE stats (key TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0);
CREATE TABLE stats_daily (
  day TEXT PRIMARY KEY,
  cells INTEGER NOT NULL DEFAULT 0,
  time_ms INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE color_usage (rgb INTEGER PRIMARY KEY, cells INTEGER NOT NULL DEFAULT 0);
CREATE TABLE rewards_claimed (key TEXT PRIMARY KEY, claimed_at INTEGER NOT NULL);
CREATE TABLE gallery_walls (id TEXT PRIMARY KEY, name TEXT NOT NULL, theme TEXT NOT NULL, position INTEGER NOT NULL);
CREATE TABLE gallery_items (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  wall_id TEXT NOT NULL REFERENCES gallery_walls(id) ON DELETE CASCADE,
  x REAL NOT NULL,
  y REAL NOT NULL,
  frame TEXT NOT NULL,
  added_at INTEGER NOT NULL
);
CREATE TABLE creations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`,
  },
  {
    version: 2,
    description: 'compteurs par partie (succès secrets)',
    sql: /* sql */ `
ALTER TABLE projects ADD COLUMN undos INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN errors INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN tools INTEGER NOT NULL DEFAULT 0;
`,
  },
  {
    version: 3,
    description: 'cadre choisi par œuvre (galerie, exports)',
    sql: /* sql */ `
ALTER TABLE projects ADD COLUMN frame TEXT;
`,
  },
];

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;

export async function schemaVersion(db: DbDriver): Promise<number> {
  const row = await queryOne<{ user_version: number }>(db, 'PRAGMA user_version');
  return row?.user_version ?? 0;
}

/** Applique les migrations manquantes, chacune dans sa transaction. Renvoie la version finale. */
export async function migrate(db: DbDriver, now = Date.now()): Promise<number> {
  let current = await schemaVersion(db);
  if (current > SCHEMA_VERSION) {
    throw new Error(`Base plus récente que l'application (v${current} > v${SCHEMA_VERSION})`);
  }
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    await db.transaction(async () => {
      await db.exec(m.sql);
      if (m.version === 1) {
        await db.run('INSERT INTO player (id, xp, level, created_at) VALUES (1, 0, 1, ?)', [now]);
        await db.run('INSERT INTO streak (id) VALUES (1)');
      }
      await db.exec(`PRAGMA user_version = ${m.version}`);
    });
    current = m.version;
  }
  return current;
}
