import { TRANSPARENT, type Grid } from '@/content/grid';
import { Bitset } from '@/content/progress';
import type { ModeId } from '@/modes/types';
import {
  Op,
  decodeBitset,
  decodeGrid,
  decodeOps,
  encodeBitset,
  encodeGrid,
  encodeOps,
  fromBase64,
  toBase64,
  type JournalOp,
} from './codecs';
import { queryOne, type DbDriver } from './driver';

export type ProjectSource = 'library' | 'daily' | 'photo' | 'creation' | 'shared' | 'generator';

export interface ProjectMeta {
  id: string;
  artworkId: string;
  source: ProjectSource;
  mode: ModeId;
  title: string | null;
  category: string | null;
  width: number;
  height: number;
  colors: number;
  filled: number;
  total: number;
  timeMs: number;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  thumbnail: string | null;
  /** Compteurs de la partie en cours (succès secrets). */
  undos: number;
  errors: number;
  tools: number;
}

export type ProjectCounter = 'undos' | 'errors' | 'tools';

export interface LoadedProject {
  meta: ProjectMeta;
  grid: Grid;
  filled: Bitset;
  /** Ordre des poses encore valides (sert au timelapse). */
  history: number[];
}

interface ProjectRow {
  id: string;
  artwork_id: string;
  source: string;
  mode: string;
  title: string | null;
  category: string | null;
  width: number;
  height: number;
  colors: number;
  filled: number;
  total: number;
  time_ms: number;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
  thumbnail: string | null;
  undos: number;
  errors: number;
  tools: number;
}

const META_COLUMNS =
  'id, artwork_id, source, mode, title, category, width, height, colors, filled, total, time_ms, created_at, updated_at, completed_at, thumbnail, undos, errors, tools';

function toMeta(r: ProjectRow): ProjectMeta {
  return {
    id: r.id,
    artworkId: r.artwork_id,
    source: r.source as ProjectSource,
    mode: r.mode as ModeId,
    title: r.title,
    category: r.category,
    width: r.width,
    height: r.height,
    colors: r.colors,
    filled: r.filled,
    total: r.total,
    timeMs: r.time_ms,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at,
    thumbnail: r.thumbnail,
    undos: r.undos,
    errors: r.errors,
    tools: r.tools,
  };
}

/** Rejoue un journal de poses : état des cases et ordre des poses restantes. */
export function replay(
  size: number,
  batches: readonly JournalOp[][],
  base?: Bitset,
): { filled: Bitset; history: number[] } {
  const filled = base ? new Bitset(size, base.bytes.slice()) : new Bitset(size);
  const history: number[] = [];
  for (const ops of batches) {
    for (const { op, index } of ops) {
      if (index < 0 || index >= size) continue;
      if (op === Op.Place) {
        if (!filled.get(index)) {
          filled.set(index);
          history.push(index);
        }
      } else if (filled.get(index)) {
        filled.clear(index);
        // une annulation porte presque toujours sur la dernière pose
        const at = history.lastIndexOf(index);
        if (at >= 0) history.splice(at, 1);
      }
    }
  }
  return { filled, history };
}

/**
 * Persistance des parties : grille figée à la création, journal de poses en ajout seul
 * (sauvegarde incrémentale, jamais de réécriture complète), photo compacte de l'état en arrière-plan.
 */
export class ProgressStore {
  constructor(
    private readonly db: DbDriver,
    private readonly now: () => number = () => Date.now(),
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  async create(input: {
    artworkId: string;
    source: ProjectSource;
    mode: ModeId;
    grid: Grid;
    title?: string;
    category?: string;
  }): Promise<ProjectMeta> {
    const { grid } = input;
    const id = this.newId();
    const t = this.now();
    let total = 0;
    for (const c of grid.cells) if (c !== TRANSPARENT) total++;
    await this.db.run(
      `INSERT INTO projects (id, artwork_id, source, mode, title, category, width, height, colors, grid, total, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.artworkId,
        input.source,
        input.mode,
        input.title ?? null,
        input.category ?? null,
        grid.width,
        grid.height,
        grid.palette.length,
        toBase64(encodeGrid(grid)),
        total,
        t,
        t,
      ],
    );
    const meta = await this.get(id);
    if (!meta) throw new Error('Projet introuvable après création');
    return meta;
  }

  async get(id: string): Promise<ProjectMeta | undefined> {
    const r = await queryOne<ProjectRow>(this.db, `SELECT ${META_COLUMNS} FROM projects WHERE id = ?`, [id]);
    return r ? toMeta(r) : undefined;
  }

  /** Partie en cours (non terminée) la plus récente pour une œuvre dans un mode. */
  async findActive(artworkId: string, mode: ModeId): Promise<ProjectMeta | undefined> {
    const r = await queryOne<ProjectRow>(
      this.db,
      `SELECT ${META_COLUMNS} FROM projects WHERE artwork_id = ? AND mode = ? AND completed_at IS NULL
       ORDER BY updated_at DESC LIMIT 1`,
      [artworkId, mode],
    );
    return r ? toMeta(r) : undefined;
  }

  /** Partie la plus récente (terminée ou non) pour une œuvre dans un mode. */
  async findLatest(artworkId: string, mode: ModeId): Promise<ProjectMeta | undefined> {
    const r = await queryOne<ProjectRow>(
      this.db,
      `SELECT ${META_COLUMNS} FROM projects WHERE artwork_id = ? AND mode = ? ORDER BY updated_at DESC LIMIT 1`,
      [artworkId, mode],
    );
    return r ? toMeta(r) : undefined;
  }

  async list(opts: { completed?: boolean; limit?: number } = {}): Promise<ProjectMeta[]> {
    const where =
      opts.completed === undefined
        ? ''
        : opts.completed
          ? 'WHERE completed_at IS NOT NULL'
          : 'WHERE completed_at IS NULL';
    const rows = await this.db.query<ProjectRow>(
      `SELECT ${META_COLUMNS} FROM projects ${where} ORDER BY updated_at DESC LIMIT ?`,
      [opts.limit ?? 1000],
    );
    return rows.map(toMeta);
  }

  /** Ajoute un lot d'opérations au journal (une petite transaction). */
  async append(id: string, ops: readonly JournalOp[], filledDelta: number, timeMs: number): Promise<void> {
    if (ops.length === 0 && timeMs === 0) return;
    await this.db.transaction(async () => {
      const row = await queryOne<{ next_seq: number }>(
        this.db,
        'SELECT next_seq FROM projects WHERE id = ?',
        [id],
      );
      if (!row) throw new Error(`Projet inconnu : ${id}`);
      if (ops.length > 0) {
        await this.db.run('INSERT INTO journal (project_id, seq, ops) VALUES (?, ?, ?)', [
          id,
          row.next_seq,
          encodeOps(ops),
        ]);
      }
      await this.db.run(
        `UPDATE projects SET next_seq = next_seq + ?, filled = filled + ?, time_ms = time_ms + ?, updated_at = ? WHERE id = ?`,
        [ops.length > 0 ? 1 : 0, filledDelta, Math.round(timeMs), this.now(), id],
      );
    });
  }

  /** Photo compacte de l'état (miniatures, listes) ; le journal reste la source de vérité. */
  async compact(id: string, filled: Bitset): Promise<void> {
    await this.db.run('UPDATE projects SET snapshot = ?, snapshot_seq = next_seq - 1 WHERE id = ?', [
      encodeBitset(filled),
      id,
    ]);
  }

  async complete(id: string): Promise<void> {
    await this.db.run('UPDATE projects SET completed_at = ?, updated_at = ? WHERE id = ?', [
      this.now(),
      this.now(),
      id,
    ]);
  }

  /** Recommence une partie : journal vidé, progression remise à zéro. */
  async reset(id: string): Promise<void> {
    await this.db.transaction(async () => {
      await this.db.run('DELETE FROM journal WHERE project_id = ?', [id]);
      await this.db.run(
        `UPDATE projects SET snapshot = NULL, snapshot_seq = 0, next_seq = 1, filled = 0, time_ms = 0,
         undos = 0, errors = 0, tools = 0, completed_at = NULL, updated_at = ? WHERE id = ?`,
        [this.now(), id],
      );
    });
  }

  /** Incrémente un compteur de la partie (annulations, erreurs, outils). */
  async bump(id: string, counter: ProjectCounter, by = 1): Promise<void> {
    await this.db.run(`UPDATE projects SET ${counter} = ${counter} + ? WHERE id = ?`, [by, id]);
  }

  /** Modes dans lesquels cette œuvre a déjà été terminée. */
  async completedModes(artworkId: string): Promise<ModeId[]> {
    const rows = await this.db.query<{ mode: ModeId }>(
      'SELECT DISTINCT mode FROM projects WHERE artwork_id = ? AND completed_at IS NOT NULL',
      [artworkId],
    );
    return rows.map((r) => r.mode);
  }

  async setThumbnail(id: string, thumbnail: string): Promise<void> {
    await this.db.run('UPDATE projects SET thumbnail = ? WHERE id = ?', [thumbnail, id]);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM projects WHERE id = ?', [id]);
  }

  async load(id: string): Promise<LoadedProject> {
    const row = await queryOne<ProjectRow & { grid: string; snapshot: string | null }>(
      this.db,
      `SELECT ${META_COLUMNS}, grid, snapshot FROM projects WHERE id = ?`,
      [id],
    );
    if (!row) throw new Error(`Projet inconnu : ${id}`);
    const grid = decodeGrid(fromBase64(row.grid));
    const size = grid.cells.length;
    const journal = await this.db.query<{ ops: string }>(
      'SELECT ops FROM journal WHERE project_id = ? ORDER BY seq',
      [id],
    );
    const base = journal.length === 0 && row.snapshot ? decodeBitset(row.snapshot, size) : undefined;
    const { filled, history } = replay(
      size,
      journal.map((j) => decodeOps(j.ops)),
      base,
    );
    // le compteur est dérivé du journal : on corrige toute dérive éventuelle
    let count = 0;
    for (let i = 0; i < size; i++) if (filled.get(i) && grid.cells[i] !== TRANSPARENT) count++;
    const meta = toMeta(row);
    if (count !== meta.filled) {
      await this.db.run('UPDATE projects SET filled = ? WHERE id = ?', [count, id]);
      meta.filled = count;
    }
    return { meta, grid, filled, history };
  }
}
