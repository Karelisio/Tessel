/** Valeurs SQL échangées avec les pilotes. Les binaires sont stockés en base64 (TEXT) pour passer le pont natif. */
export type SqlValue = number | string | null;

export interface RunResult {
  changes: number;
}

/** Interface minimale commune au SQLite natif (Android) et à sql.js (tests, navigateur). */
export interface DbDriver {
  /** Exécute un script (plusieurs instructions, sans paramètres). */
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly SqlValue[]): Promise<RunResult>;
  query<T extends object>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  /** Exécute `fn` dans une transaction (annulée si `fn` lève une erreur). */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function queryOne<T extends object>(
  db: DbDriver,
  sql: string,
  params?: readonly SqlValue[],
): Promise<T | undefined> {
  const rows = await db.query<T>(sql, params);
  return rows[0];
}
