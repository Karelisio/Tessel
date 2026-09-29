import type { Database, SqlValue as SqlJsValue } from 'sql.js';
import type { DbDriver, RunResult, SqlValue } from './driver';

/**
 * Pilote sql.js (SQLite compilé en WebAssembly) : tests Vitest et développement dans le navigateur.
 * `onChange` permet de persister la base (IndexedDB) après chaque écriture.
 */
export class SqlJsDriver implements DbDriver {
  private depth = 0;

  constructor(
    readonly db: Database,
    private readonly onChange?: (db: Database) => void,
  ) {
    db.exec('PRAGMA foreign_keys = ON;');
  }

  exec(sql: string): Promise<void> {
    this.db.exec(sql);
    this.changed();
    return Promise.resolve();
  }

  run(sql: string, params: readonly SqlValue[] = []): Promise<RunResult> {
    this.db.run(sql, params as SqlJsValue[]);
    this.changed();
    return Promise.resolve({ changes: this.db.getRowsModified() });
  }

  query<T extends object>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params as SqlJsValue[]);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return Promise.resolve(rows);
    } finally {
      stmt.free();
    }
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    // les transactions imbriquées utilisent des points de sauvegarde
    const name = `sp${this.depth}`;
    this.db.exec(this.depth === 0 ? 'BEGIN' : `SAVEPOINT ${name}`);
    this.depth++;
    try {
      const result = await fn();
      this.depth--;
      this.db.exec(this.depth === 0 ? 'COMMIT' : `RELEASE ${name}`);
      this.changed();
      return result;
    } catch (e) {
      this.depth--;
      this.db.exec(this.depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${name}; RELEASE ${name}`);
      throw e;
    }
  }

  close(): Promise<void> {
    this.db.close();
    return Promise.resolve();
  }

  private changed(): void {
    if (this.depth === 0) this.onChange?.(this.db);
  }
}
