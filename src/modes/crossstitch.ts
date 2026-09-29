import { FrameStyle } from '@/fx/finaleTimeline';
import type { ModeDefinition } from './types';

/**
 * Point de croix : toile Aida procédurale (blocs tissés, trous aux coins),
 * deux fils de coton mouliné torsadés qui se croisent, avec relief et ombre portée.
 */
export const crossStitchMode: ModeDefinition = {
  id: 'crossstitch',
  placeDuration: 520,
  impactAt: 0,
  paper: [0.957, 0.937, 0.898],
  backdrop: [0.9, 0.88, 0.85],
  emptyTint: 0.16,
  sound: 'thread',
  haptic: 'double-tick',
  usesLight: false,
  frame: FrameStyle.Oak,
  glsl: {
    pendingAsGap: true,
    gap: /* glsl */ `
// Toile Aida : blocs tissés 2×2, trous aux intersections ; se tend à la fin (gTension).
vec3 fabric(vec2 f) {
  vec2 g = f * 2.0;
  vec2 gi = floor(g);
  vec2 gf = fract(g);
  bool over = mod(gi.x + gi.y, 2.0) > 0.5;
  float weave = over ? sin(gf.y * 3.14159) : sin(gf.x * 3.14159);
  vec3 c = uPaper * (0.93 + 0.07 * weave * (1.0 - 0.5 * gTension));
  vec2 dc = min(f, 1.0 - f);
  float hole = 1.0 - smoothstep(0.06, 0.11, length(dc) / (1.0 - 0.45 * gTension));
  c *= 1.0 - hole * 0.42;
  c *= 1.0 + (hash12(floor((gCell + f) * 6.0)) - 0.5) * 0.025;
  return c;
}

vec3 gapColor(vec3 col, vec2 f) {
  // ombre douce des fils sur la toile, le long des deux diagonales
  float s = min(abs(f.x - f.y), abs(f.x + f.y - 1.0)) * 0.7071;
  float inside = step(0.1, min(min(f.x, f.y), min(1.0 - f.x, 1.0 - f.y)));
  float shadow = (1.0 - smoothstep(0.09, 0.2, s)) * inside;
  return fabric(f) * (1.0 - 0.16 * shadow);
}
`,
    material: /* glsl */ `
// Distance à un segment épais ; renvoie la position le long (0–1) et en travers (-1–1).
float capsule(vec2 p, vec2 a, vec2 b, float r, out float along, out float across) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
  vec2 d = pa - ba * h;
  along = h;
  vec2 nrm = normalize(vec2(-ba.y, ba.x));
  across = dot(d, nrm) / r;
  return length(d) - r;
}

// Un fil de coton mouliné qui va de a à b (prog = portion déjà tracée).
vec4 thread(vec2 f, vec2 a, vec2 b, vec3 col, float px, float seed, float prog) {
  if (prog <= 0.0) return vec4(0.0);
  vec2 e = mix(a, b, prog);
  float along;
  float across;
  float r = 0.135;
  float d = capsule(f, a, e, r, along, across);
  float aa = max(px * 1.2, 0.01);
  float cov = 1.0 - smoothstep(-aa, aa, d);
  if (cov <= 0.0) return vec4(0.0);
  float s = along * length(e - a);
  // brins torsadés : bandes obliques qui s'enroulent autour du fil
  float strands = 0.5 + 0.5 * sin(s * 22.0 + across * 2.6 + seed * 6.0);
  float cyl = sqrt(max(0.0, 1.0 - across * across));
  vec3 c = col * (0.58 + 0.42 * cyl) * (0.88 + 0.16 * strands);
  c += pow(cyl, 8.0) * 0.12 * strands;
  // léger resserrement du fil à ses extrémités (il plonge dans la toile)
  float ends = smoothstep(0.0, 0.06, along) * smoothstep(0.0, 0.06, 1.0 - along);
  c *= 0.8 + 0.2 * ends;
  return vec4(c, cov);
}

vec4 stitch(vec2 f, vec3 col, float seed, float px, float p1, float p2) {
  float m = 0.13;
  vec4 under = thread(f, vec2(m, 1.0 - m), vec2(1.0 - m, m), col * 0.9, px, seed, p1);
  vec4 over = thread(f, vec2(m, m), vec2(1.0 - m, 1.0 - m), col, px, seed + 0.37, p2);
  // ombre du fil du dessus sur celui du dessous
  float s = abs(f.x - f.y) * 0.7071;
  float shade = (1.0 - smoothstep(0.12, 0.2, s)) * step(0.001, p2);
  vec3 rgb = under.rgb * (1.0 - 0.28 * shade);
  float a = under.a;
  rgb = mix(rgb, over.rgb, over.a);
  a = max(a, over.a);
  return vec4(rgb, a);
}

vec4 material(vec2 f, vec3 col, float seed, float px, float cellPx) {
  return stitch(f, col, seed, px, 1.0, 1.0);
}
`,
    empty: /* glsl */ `
vec4 emptyCell(vec2 f, int idx, vec3 col, float px, float cellPx, float numberAlpha, float selected) {
  vec3 base = fabric(f);
  // motif imprimé (toile « pré-imprimée »), très léger
  float tint = selected > 0.5 ? clamp(0.3 * selectionGlow(uTime), 0.0, 0.6) : 0.12;
  vec2 q = abs(f - 0.5);
  float inside = 1.0 - smoothstep(0.36, 0.36 + px * 1.5, max(q.x, q.y));
  base = mix(base, mix(base, col, tint), inside);
  if (numberAlpha > 0.0 && uNumbers > 0.0) {
    float m = numberMask(f, idx + 1, px) * numberAlpha;
    vec3 ink = selected > 0.5 ? mix(col * 0.3, vec3(0.12), 0.5) : mix(vec3(0.46), col * 0.45, 0.3);
    if (selected > 0.5 && luma(col) < 0.35) ink = vec3(0.97);
    base = mix(base, ink, m);
  }
  return vec4(base, 1.0);
}
`,
    finale: /* glsl */ `
vec3 finaleEffect(vec3 c, vec2 cell, vec2 f, float near) {
  // la toile se tend : couleurs plus franches, léger lustre au passage de l'onde
  float k = finaleWave(cell);
  c = mix(c, c * 1.04 + 0.01, k);
  return c + finalePulse(cell) * 0.1 * (vec3(1.0) - c);
}
`,
    animVertex: /* glsl */ `
    // le fil se tend légèrement à la fin du second passage
    s = 1.0 + 0.03 * sin(clamp((p - 0.85) / 0.15, 0.0, 1.0) * 3.14159);
`,
    // premier fil puis second fil, tracés comme brodés en direct
    animFragment: /* glsl */ `
    float p1 = smoothstep(0.0, 0.42, p);
    float p2 = smoothstep(0.46, 0.88, p);
    m = stitch(f, col, vSeed, px, p1, p2);
`,
  },
};
