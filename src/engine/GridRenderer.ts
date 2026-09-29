import {
  Buffer,
  BufferImageSource,
  BufferUsage,
  Container,
  Geometry,
  GlProgram,
  Mesh,
  Shader,
  UniformGroup,
} from 'pixi.js';
import { TRANSPARENT, type Grid } from '@/content/grid';
import { hash2 } from '@/content/random';
import type { ModeDefinition } from '@/modes/types';
import type { Camera } from './Camera';
import { GRID_VERTEX, animFragment, animVertex, gridFragment } from './shaders/common';

export const CellState = { Empty: 0, Animating: 1, Filled: 2 } as const;
export type CellState = (typeof CellState)[keyof typeof CellState];

export const AnimKind = { Place: 0, Shake: 1 } as const;
export type AnimKind = (typeof AnimKind)[keyof typeof AnimKind];

/** Nombre maximal de cases animées simultanément (pool réutilisé, aucune allocation). */
export const ANIM_CAPACITY = 512;
const FLOATS_PER_VERTEX = 8; // corner(2) cell(2) data(4)
const STATE_ALPHA = [0, 128, 255] as const;

function dataSource(resource: Uint8Array, width: number, height: number, linear = false): BufferImageSource {
  return new BufferImageSource({
    resource,
    width,
    height,
    format: 'rgba8unorm',
    alphaMode: 'no-premultiply-alpha',
    scaleMode: linear ? 'linear' : 'nearest',
  });
}

/**
 * Rendu GPU de la grille : un quad plein écran + un fragment shader qui lit l'état dans des textures,
 * et une couche instanciée (pool de quads) pour les cases en cours d'animation.
 * Coût proportionnel au nombre de pixels, indépendant de la taille de la grille.
 */
export class GridRenderer {
  readonly view = new Container();

  private readonly cells: Uint8Array;
  private readonly cellsSource: BufferImageSource;
  private readonly targetSource: BufferImageSource;
  private readonly paletteSource: BufferImageSource;
  private readonly uniforms: UniformGroup;
  private readonly quad: Geometry;
  private readonly animData: Float32Array;
  private readonly animBuffer: Buffer;
  private readonly animGeometry: Geometry;
  private readonly animEnds = new Float64Array(ANIM_CAPACITY).fill(-1);
  private readonly animCell = new Int32Array(ANIM_CAPACITY).fill(-1);
  private gridMesh: Mesh<Geometry, Shader>;
  private animMesh: Mesh<Geometry, Shader>;
  private animCursor = 0;
  private cellsDirty = false;
  private animDirty = false;
  private mode: ModeDefinition;
  private readonly pendingFill: { index: number; at: number }[] = [];

  constructor(
    readonly grid: Grid,
    mode: ModeDefinition,
    private readonly digits: BufferImageSource,
  ) {
    this.mode = mode;
    const { width, height } = grid;
    this.cells = new Uint8Array(width * height * 4);
    const target = new Uint8Array(width * height * 4);
    for (let i = 0; i < grid.cells.length; i++) {
      const c = grid.cells[i] ?? TRANSPARENT;
      target[i * 4] = c;
      target[i * 4 + 1] = Math.floor(hash2(i % width, Math.floor(i / width), 7) * 255);
      target[i * 4 + 3] = 255;
    }
    const palette = new Uint8Array(64 * 4);
    grid.palette.forEach(([r, g, b], i) => {
      palette.set([r, g, b, 255], i * 4);
    });

    // filtrage linéaire sans mipmaps : même au dézoom maximal une case couvre plusieurs pixels
    this.cellsSource = dataSource(this.cells, width, height, true);
    this.targetSource = dataSource(target, width, height);
    this.paletteSource = dataSource(palette, 64, 1);
    for (let i = 0; i < grid.cells.length; i++) this.writeCell(i, CellState.Empty);

    this.uniforms = new UniformGroup({
      uTranslate: { value: new Float32Array(2), type: 'vec2<f32>' },
      uScale: { value: 1, type: 'f32' },
      uPixelRatio: { value: 1, type: 'f32' },
      uGrid: { value: new Float32Array([width, height]), type: 'vec2<f32>' },
      uTime: { value: 0, type: 'f32' },
      uSelected: { value: -1, type: 'f32' },
      uSelectTime: { value: -10, type: 'f32' },
      uLight: { value: new Float32Array([-0.35, -0.45, 0.82]), type: 'vec3<f32>' },
      uWave: { value: new Float32Array([0, 0, -100, -1]), type: 'vec4<f32>' },
      uDuration: { value: mode.placeDuration / 1000, type: 'f32' },
      uNumbers: { value: 1, type: 'f32' },
      uPaper: { value: new Float32Array(mode.paper), type: 'vec3<f32>' },
      uBackdrop: { value: new Float32Array(mode.backdrop), type: 'vec3<f32>' },
      uFinish: { value: new Float32Array([-1, mode.frame, 0, 0]), type: 'vec4<f32>' },
    });

    this.quad = new Geometry({
      attributes: { aPosition: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]) },
      indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3]),
    });

    this.animData = new Float32Array(ANIM_CAPACITY * 4 * FLOATS_PER_VERTEX);
    const corners = [0, 0, 1, 0, 1, 1, 0, 1];
    for (let q = 0; q < ANIM_CAPACITY; q++) {
      for (let v = 0; v < 4; v++) {
        const o = (q * 4 + v) * FLOATS_PER_VERTEX;
        this.animData[o] = corners[v * 2] ?? 0;
        this.animData[o + 1] = corners[v * 2 + 1] ?? 0;
        this.animData[o + 4] = -1e6; // emplacement libre
      }
    }
    const indices = new Uint32Array(ANIM_CAPACITY * 6);
    for (let q = 0; q < ANIM_CAPACITY; q++)
      indices.set(
        [0, 1, 2, 0, 2, 3].map((k) => k + q * 4),
        q * 6,
      );
    const stride = FLOATS_PER_VERTEX * 4;
    this.animBuffer = new Buffer({ data: this.animData, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    this.animGeometry = new Geometry({
      attributes: {
        aCorner: { buffer: this.animBuffer, format: 'float32x2', stride, offset: 0 },
        aCell: { buffer: this.animBuffer, format: 'float32x2', stride, offset: 8 },
        aData: { buffer: this.animBuffer, format: 'float32x4', stride, offset: 16 },
      },
      indexBuffer: indices,
    });

    this.gridMesh = new Mesh({ geometry: this.quad, shader: this.buildGridShader() });
    this.animMesh = new Mesh({ geometry: this.animGeometry, shader: this.buildAnimShader() });
    this.view.addChild(this.gridMesh, this.animMesh);
  }

  get currentMode(): ModeDefinition {
    return this.mode;
  }

  get isAnimating(): boolean {
    return this.pendingFill.length > 0;
  }

  setMode(mode: ModeDefinition): void {
    if (mode === this.mode) return;
    this.mode = mode;
    const u = this.uniforms.uniforms as Record<string, unknown>;
    u.uDuration = mode.placeDuration / 1000;
    (u.uPaper as Float32Array).set(mode.paper);
    (u.uBackdrop as Float32Array).set(mode.backdrop);
    (u.uFinish as Float32Array)[1] = mode.frame;
    this.uniforms.update();
    const oldGrid = this.gridMesh.shader;
    const oldAnim = this.animMesh.shader;
    this.gridMesh.shader = this.buildGridShader();
    this.animMesh.shader = this.buildAnimShader();
    oldGrid?.destroy();
    oldAnim?.destroy();
    for (let i = 0; i < this.grid.cells.length; i++) {
      // une case en animation est déjà posée logiquement
      const s = (this.cells[i * 4 + 3] ?? 0) >= 128 ? CellState.Filled : CellState.Empty;
      this.writeCell(i, s);
    }
    this.cellsDirty = true;
  }

  /** Taille de la zone de rendu (px CSS). */
  resize(width: number, height: number, pixelRatio: number): void {
    const pos = this.quad.getAttribute('aPosition').buffer;
    pos.data = new Float32Array([0, 0, width, 0, width, height, 0, height]);
    pos.update();
    this.uniforms.uniforms.uPixelRatio = pixelRatio;
    this.uniforms.update();
  }

  syncCamera(camera: Camera): void {
    const u = this.uniforms.uniforms as Record<string, unknown>;
    const t = u.uTranslate as Float32Array;
    t[0] = camera.tx;
    t[1] = camera.ty;
    u.uScale = camera.scale;
    this.uniforms.update();
  }

  setTime(seconds: number): void {
    this.uniforms.uniforms.uTime = seconds;
    this.uniforms.update();
  }

  setSelected(color: number, time: number): void {
    const u = this.uniforms.uniforms as Record<string, unknown>;
    u.uSelected = color;
    u.uSelectTime = time;
    this.uniforms.update();
  }

  setLight(x: number, y: number, z: number): void {
    const l = this.uniforms.uniforms.uLight as Float32Array;
    l[0] = x;
    l[1] = y;
    l[2] = z;
    this.uniforms.update();
  }

  setNumberScale(scale: number): void {
    this.uniforms.uniforms.uNumbers = scale;
    this.uniforms.update();
  }

  /** Lance l'onde de lumière sur toutes les cases d'une couleur terminée. */
  startWave(color: number, originX: number, originY: number, time: number): void {
    (this.uniforms.uniforms.uWave as Float32Array).set([originX, originY, time, color]);
    this.uniforms.update();
  }

  /** Démarre la cinématique de fin (effets GLSL pilotés par le temps) ; `time < 0` l'annule. */
  setFinale(time: number): void {
    (this.uniforms.uniforms.uFinish as Float32Array)[0] = time;
    this.uniforms.update();
  }

  /** Remet toutes les cases à vide à l'écran (la progression logique n'est pas touchée). */
  clearAll(): void {
    for (let i = 0; i < this.grid.cells.length; i++) this.writeCell(i, CellState.Empty);
    this.pendingFill.length = 0;
    this.animEnds.fill(-1);
    for (let q = 0; q < ANIM_CAPACITY; q++) {
      for (let v = 0; v < 4; v++) this.animData[(q * 4 + v) * FLOATS_PER_VERTEX + 4] = -1e6;
    }
    this.animDirty = true;
    this.cellsDirty = true;
  }

  setCell(index: number, state: CellState): void {
    this.writeCell(index, state);
    this.cellsDirty = true;
  }

  /**
   * Pose animée : la case passe « en animation » (fond sans numéro), un quad du pool joue l'animation,
   * puis la case devient « posée » à la fin.
   */
  animatePlace(index: number, time: number, reduced = false): void {
    if (reduced) {
      this.setCell(index, CellState.Filled);
      return;
    }
    this.setCell(index, CellState.Animating);
    this.startAnim(index, AnimKind.Place, time);
    this.pendingFill.push({ index, at: time + this.mode.placeDuration / 1000 });
  }

  /** Animations de pose en cours (le pool en compte ANIM_CAPACITY). */
  activeAnimations(time: number): number {
    let n = 0;
    for (let q = 0; q < ANIM_CAPACITY; q++) if ((this.animEnds[q] ?? -1) > time) n++;
    return n;
  }

  animateShake(index: number, time: number): void {
    this.startAnim(index, AnimKind.Shake, time);
  }

  /** À appeler chaque frame avant le rendu ; renvoie true si quelque chose est animé. */
  update(time: number): boolean {
    let i = 0;
    while (i < this.pendingFill.length) {
      const p = this.pendingFill[i];
      if (p && p.at <= time) {
        // une annulation entre-temps a pu remettre la case à vide
        if (this.cells[p.index * 4 + 3] === STATE_ALPHA[CellState.Animating])
          this.setCell(p.index, CellState.Filled);
        this.pendingFill.splice(i, 1);
      } else i++;
    }
    if (this.cellsDirty) {
      this.cellsSource.update();
      this.cellsDirty = false;
    }
    if (this.animDirty) {
      this.animBuffer.update();
      this.animDirty = false;
    }
    let active = this.pendingFill.length > 0;
    if (!active) {
      for (let q = 0; q < ANIM_CAPACITY; q++) {
        if ((this.animEnds[q] ?? -1) > time) {
          active = true;
          break;
        }
      }
    }
    return active;
  }

  destroy(): void {
    const shaders = [this.gridMesh.shader, this.animMesh.shader];
    this.view.destroy({ children: true });
    // les shaders d'abord : leurs groupes de liaison lâchent les textures avant leur destruction
    for (const s of shaders) s?.destroy();
    this.quad.destroy(true);
    this.animGeometry.destroy(true);
    this.cellsSource.destroy();
    this.targetSource.destroy();
    this.paletteSource.destroy();
  }

  private startAnim(index: number, kind: AnimKind, time: number): void {
    const { width } = this.grid;
    const duration = kind === AnimKind.Shake ? 0.34 : this.mode.placeDuration / 1000;
    // réutilise l'animation en cours sur la même case (tremblements répétés)
    let q = -1;
    for (let k = 0; k < ANIM_CAPACITY; k++) {
      if (this.animCell[k] === index && (this.animEnds[k] ?? -1) > time) {
        q = k;
        break;
      }
    }
    if (q < 0) {
      q = this.animCursor;
      this.animCursor = (this.animCursor + 1) % ANIM_CAPACITY;
    }
    this.animEnds[q] = time + duration;
    this.animCell[q] = index;
    const cx = index % width;
    const cy = Math.floor(index / width);
    const color = this.grid.cells[index] ?? 0;
    const seed = hash2(cx, cy, 7);
    for (let v = 0; v < 4; v++) {
      const o = (q * 4 + v) * FLOATS_PER_VERTEX;
      this.animData[o + 2] = cx;
      this.animData[o + 3] = cy;
      this.animData[o + 4] = time;
      this.animData[o + 5] = color;
      this.animData[o + 6] = kind;
      this.animData[o + 7] = seed;
    }
    this.animDirty = true;
  }

  private writeCell(index: number, state: CellState): void {
    const c = this.grid.cells[index] ?? TRANSPARENT;
    const o = index * 4;
    if (c === TRANSPARENT) {
      // une case transparente laisse voir le fond autour de l'œuvre : la silhouette se détache
      const [r, g, b] = this.mode.backdrop;
      this.cells.set([r * 255, g * 255, b * 255, 0], o);
      return;
    }
    const [r, g, b] = this.grid.palette[c] ?? [0, 0, 0];
    if (state === CellState.Filled) {
      this.cells.set([r, g, b, STATE_ALPHA[state]], o);
    } else {
      const t = this.mode.emptyTint;
      const [pr, pg, pb] = this.mode.paper;
      this.cells.set(
        [
          pr * 255 * (1 - t) + r * t,
          pg * 255 * (1 - t) + g * t,
          pb * 255 * (1 - t) + b * t,
          STATE_ALPHA[state],
        ],
        o,
      );
    }
  }

  private resources() {
    return {
      uCells: this.cellsSource,
      uTarget: this.targetSource,
      uPalette: this.paletteSource,
      uDigits: this.digits,
      gridUniforms: this.uniforms,
    };
  }

  private buildGridShader(): Shader {
    return new Shader({
      glProgram: GlProgram.from({
        vertex: GRID_VERTEX,
        fragment: gridFragment(this.mode.glsl),
        name: `tessel-grid-${this.mode.id}`,
        preferredFragmentPrecision: 'highp',
      }),
      resources: this.resources(),
    });
  }

  private buildAnimShader(): Shader {
    return new Shader({
      glProgram: GlProgram.from({
        vertex: animVertex(this.mode.glsl),
        fragment: animFragment(this.mode.glsl),
        name: `tessel-anim-${this.mode.id}`,
        preferredFragmentPrecision: 'highp',
      }),
      resources: this.resources(),
    });
  }
}
