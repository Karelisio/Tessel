import type { DbDriver } from '@/db/driver';
import { parseDoc, serializeDoc, type CreationDoc } from './document';

export interface CreationMeta {
  id: string;
  title: string;
  width: number;
  height: number;
  createdAt: number;
  updatedAt: number;
}

interface Row {
  id: string;
  title: string;
  width: number;
  height: number;
  data: string;
  created_at: number;
  updated_at: number;
}

const meta = (r: Row): CreationMeta => ({
  id: r.id,
  title: r.title,
  width: r.width,
  height: r.height,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** Créations de l'éditeur (brouillons enregistrés), dans la table `creations`. */
export class CreationStore {
  constructor(
    private readonly db: DbDriver,
    private readonly now: () => number = () => Date.now(),
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  /** Plus récentes d'abord. */
  async list(): Promise<CreationMeta[]> {
    const rows = await this.db.query<Row>(
      'SELECT id, title, width, height, data, created_at, updated_at FROM creations ORDER BY updated_at DESC',
    );
    return rows.map(meta);
  }

  async get(id: string): Promise<{ meta: CreationMeta; doc: CreationDoc } | undefined> {
    const rows = await this.db.query<Row>('SELECT * FROM creations WHERE id = ?', [id]);
    const r = rows[0];
    return r ? { meta: meta(r), doc: parseDoc(r.data) } : undefined;
  }

  /** Enregistre (crée si `id` est null) ; renvoie l'identifiant. */
  async save(id: string | null, title: string, doc: CreationDoc): Promise<string> {
    const t = this.now();
    const data = serializeDoc(doc);
    const name = title.trim().slice(0, 60) || 'Sans titre';
    if (id) {
      await this.db.run(
        'UPDATE creations SET title = ?, width = ?, height = ?, data = ?, updated_at = ? WHERE id = ?',
        [name, doc.width, doc.height, data, t, id],
      );
      return id;
    }
    const nid = this.newId();
    await this.db.run(
      'INSERT INTO creations (id, title, width, height, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nid, name, doc.width, doc.height, data, t, t],
    );
    return nid;
  }

  async rename(id: string, title: string): Promise<void> {
    await this.db.run('UPDATE creations SET title = ?, updated_at = ? WHERE id = ?', [
      title.trim().slice(0, 60) || 'Sans titre',
      this.now(),
      id,
    ]);
  }

  async remove(id: string): Promise<void> {
    await this.db.run('DELETE FROM creations WHERE id = ?', [id]);
  }

  async duplicate(id: string, title: string): Promise<string | undefined> {
    const c = await this.get(id);
    return c ? this.save(null, title, c.doc) : undefined;
  }
}
