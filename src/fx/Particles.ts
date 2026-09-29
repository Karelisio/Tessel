import { Container, Particle, ParticleContainer, Rectangle, Texture, TextureSource } from 'pixi.js';

export type SpriteKind = 'glow' | 'star' | 'chip' | 'dust';
const KINDS: readonly SpriteKind[] = ['glow', 'star', 'chip', 'dust'];
const SIZE = 64;

/** Atlas unique (les particules d'un conteneur partagent une source de texture). */
export function buildAtlasCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE * KINDS.length;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponible');
  const c = SIZE / 2;
  // glow : halo radial doux
  let g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
  // star : étincelle fine à 4 branches + branches diagonales courtes + cœur lumineux
  const spikes = (cx: number, cy: number, len: number, w: number, rot: number, alpha: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, -len);
    ctx.lineTo(w, -w);
    ctx.lineTo(len, 0);
    ctx.lineTo(w, w);
    ctx.lineTo(0, len);
    ctx.lineTo(-w, w);
    ctx.lineTo(-len, 0);
    ctx.lineTo(-w, -w);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  spikes(SIZE + c, c, c - 1, 1.8, 0, 1);
  spikes(SIZE + c, c, c * 0.42, 1.2, Math.PI / 4, 0.7);
  g = ctx.createRadialGradient(SIZE + c, c, 0, SIZE + c, c, c * 0.32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(SIZE, 0, SIZE, SIZE);
  // chip : petit carré arrondi (éclats, confettis)
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(SIZE * 2 + 12, 12, SIZE - 24, SIZE - 24, 8);
  ctx.fill();
  // dust : point doux
  g = ctx.createRadialGradient(SIZE * 3 + c, c, 0, SIZE * 3 + c, c, c * 0.6);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(SIZE * 3, 0, SIZE, SIZE);

  return canvas;
}

function buildAtlas(): Record<SpriteKind, Texture> {
  const canvas = buildAtlasCanvas();
  const source = TextureSource.from(canvas);
  const out = {} as Record<SpriteKind, Texture>;
  KINDS.forEach((k, i) => {
    out[k] = new Texture({ source, frame: new Rectangle(i * SIZE, 0, SIZE, SIZE) });
  });
  return out;
}

interface Slot {
  p: Particle;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  life: number;
  age: number;
  s0: number;
  s1: number;
  a0: number;
  spin: number;
  /** Profil d'alpha : 0 fondu sortant, 1 apparition puis fondu (étoile). */
  shape: number;
}

export interface EmitOptions {
  kind: SpriteKind;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  gravity?: number;
  drag?: number;
  life: number;
  size: number;
  endSize?: number;
  alpha?: number;
  tint?: number;
  rotation?: number;
  spin?: number;
  shape?: 0 | 1;
}

/** Pool de particules à capacité fixe pour un conteneur ; aucune allocation après la création. */
class Pool {
  readonly container: ParticleContainer;
  private readonly free: Slot[] = [];
  private readonly active: Slot[] = [];
  private changed = false;

  constructor(
    capacity: number,
    private readonly textures: Record<SpriteKind, Texture>,
    blendMode: 'normal' | 'add',
  ) {
    this.container = new ParticleContainer({
      dynamicProperties: { position: true, rotation: true, vertex: true, color: true, uvs: true },
      texture: textures.glow,
    });
    this.container.blendMode = blendMode;
    for (let i = 0; i < capacity; i++) {
      const p = new Particle({ texture: textures.glow, anchorX: 0.5, anchorY: 0.5 });
      this.free.push({
        p,
        vx: 0,
        vy: 0,
        gravity: 0,
        drag: 0,
        life: 1,
        age: 0,
        s0: 1,
        s1: 1,
        a0: 1,
        spin: 0,
        shape: 0,
      });
    }
  }

  setCapacity(capacity: number): void {
    // réduit simplement le nombre d'emplacements utilisables (qualité)
    while (this.free.length + this.active.length > capacity && this.free.length > 0) this.free.pop();
  }

  get count(): number {
    return this.active.length;
  }

  emit(o: EmitOptions): void {
    const s = this.free.pop() ?? this.active.shift();
    if (!s) return;
    const p = s.p;
    p.texture = this.textures[o.kind];
    p.x = o.x;
    p.y = o.y;
    p.rotation = o.rotation ?? 0;
    p.tint = o.tint ?? 0xffffff;
    s.vx = o.vx ?? 0;
    s.vy = o.vy ?? 0;
    s.gravity = o.gravity ?? 0;
    s.drag = o.drag ?? 0;
    s.life = o.life;
    s.age = 0;
    s.s0 = o.size / SIZE;
    s.s1 = (o.endSize ?? o.size) / SIZE;
    s.a0 = o.alpha ?? 1;
    s.spin = o.spin ?? 0;
    s.shape = o.shape ?? 0;
    this.apply(s, 0);
    this.active.push(s);
    this.changed = true;
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const s = this.active[i];
      if (!s) continue;
      s.age += dt;
      const t = s.age / s.life;
      if (t >= 1) {
        const last = this.active.pop();
        if (last && last !== s) this.active[i] = last;
        this.free.push(s);
        this.changed = true;
        continue;
      }
      const k = Math.exp(-s.drag * dt);
      s.vx *= k;
      s.vy = s.vy * k + s.gravity * dt;
      s.p.x += s.vx * dt;
      s.p.y += s.vy * dt;
      s.p.rotation += s.spin * dt;
      this.apply(s, t);
    }
    if (this.changed) {
      const children = this.container.particleChildren;
      children.length = 0;
      for (const s of this.active) children.push(s.p);
      this.container.update();
      this.changed = false;
    }
  }

  clear(): void {
    while (this.active.length) {
      const s = this.active.pop();
      if (s) this.free.push(s);
    }
    this.changed = true;
  }

  private apply(s: Slot, t: number): void {
    const size = s.s0 + (s.s1 - s.s0) * t;
    s.p.scaleX = size;
    s.p.scaleY = size;
    const fade = s.shape === 1 ? Math.sin(Math.PI * Math.min(1, t * 1.15)) : (1 - t) * (1 - t);
    s.p.alpha = s.a0 * Math.max(0, fade);
  }
}

export type Quality = 'low' | 'medium' | 'high';
const QUALITY_SCALE: Record<Quality, number> = { low: 0.25, medium: 0.6, high: 1 };

/**
 * Effets de particules : `world*` suivent la grille (coordonnées en cases),
 * `screen` est en px CSS (traînée sous le doigt).
 */
export class ParticleFx {
  readonly world = new Container();
  readonly screen = new Container();
  private readonly worldAdd: Pool;
  private readonly worldNormal: Pool;
  private readonly screenAdd: Pool;
  private readonly screenNormal: Pool;
  private scale = 1;

  constructor(quality: Quality = 'high') {
    const tex = buildAtlas();
    this.worldAdd = new Pool(400, tex, 'add');
    this.worldNormal = new Pool(400, tex, 'normal');
    this.screenAdd = new Pool(200, tex, 'add');
    this.screenNormal = new Pool(200, tex, 'normal');
    this.world.addChild(this.worldNormal.container, this.worldAdd.container);
    this.screen.addChild(this.screenNormal.container, this.screenAdd.container);
    this.setQuality(quality);
  }

  setQuality(q: Quality): void {
    this.scale = QUALITY_SCALE[q];
  }

  /** Nombre de particules à émettre, réduit selon la qualité (jamais nul si n > 0). */
  n(count: number): number {
    return count <= 0 ? 0 : Math.max(1, Math.round(count * this.scale));
  }

  get active(): boolean {
    return this.worldAdd.count + this.worldNormal.count + this.screenAdd.count + this.screenNormal.count > 0;
  }

  syncCamera(tx: number, ty: number, scale: number): void {
    this.world.position.set(tx, ty);
    this.world.scale.set(scale);
  }

  emitWorld(o: EmitOptions, additive: boolean): void {
    (additive ? this.worldAdd : this.worldNormal).emit(o);
  }

  emitScreen(o: EmitOptions, additive = false): void {
    (additive ? this.screenAdd : this.screenNormal).emit(o);
  }

  update(dt: number): void {
    this.worldAdd.update(dt);
    this.worldNormal.update(dt);
    this.screenAdd.update(dt);
    this.screenNormal.update(dt);
  }

  clear(): void {
    this.worldAdd.clear();
    this.worldNormal.clear();
    this.screenAdd.clear();
    this.screenNormal.clear();
  }
}
