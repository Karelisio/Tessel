import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import type { DbDriver, RunResult, SqlValue } from './driver';

/** Pilote SQLite natif (Android) via @capacitor-community/sqlite. */
export class CapacitorSqliteDriver implements DbDriver {
  private depth = 0;

  private constructor(
    private readonly sqlite: SQLiteConnection,
    private readonly conn: SQLiteDBConnection,
    private readonly name: string,
  ) {}

  static async open(name: string): Promise<CapacitorSqliteDriver> {
    const sqlite = new SQLiteConnection(CapacitorSQLite);
    await sqlite.checkConnectionsConsistency().catch(() => undefined);
    const exists = (await sqlite.isConnection(name, false)).result === true;
    const conn = exists
      ? await sqlite.retrieveConnection(name, false)
      : await sqlite.createConnection(name, false, 'no-encryption', 1, false);
    await conn.open();
    await conn.execute('PRAGMA foreign_keys = ON;', false);
    return new CapacitorSqliteDriver(sqlite, conn, name);
  }

  async exec(sql: string): Promise<void> {
    await this.conn.execute(sql, false);
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<RunResult> {
    const r = await this.conn.run(sql, [...params], false);
    return { changes: r.changes?.changes ?? 0 };
  }

  async query<T extends object>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    const r = await this.conn.query(sql, [...params]);
    return (r.values ?? []) as T[];
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    // les transactions imbriquées s'exécutent dans la transaction englobante
    if (this.depth > 0) {
      this.depth++;
      try {
        return await fn();
      } finally {
        this.depth--;
      }
    }
    this.depth = 1;
    await this.conn.beginTransaction();
    try {
      const result = await fn();
      await this.conn.commitTransaction();
      return result;
    } catch (e) {
      await this.conn.rollbackTransaction().catch(() => undefined);
      throw e;
    } finally {
      this.depth = 0;
    }
  }

  async close(): Promise<void> {
    await this.conn.close();
    await this.sqlite.closeConnection(this.name, false);
  }
}
