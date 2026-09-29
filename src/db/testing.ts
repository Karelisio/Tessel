import { createRequire } from 'node:module';
import initSqlJs from 'sql.js';
import { SqlJsDriver } from './SqlJsDriver';

const require = createRequire(import.meta.url);

/** Base SQLite en mémoire pour les tests (sql.js sous Node). */
export async function createTestDb(): Promise<SqlJsDriver> {
  const SQL = await initSqlJs({ locateFile: (f) => require.resolve(`sql.js/dist/${f}`) });
  return new SqlJsDriver(new SQL.Database());
}
