import { FrameStyle } from '@/fx/finaleTimeline';
import type { ModeDefinition } from './types';

/**
 * Mosaïque : tesselles légèrement irrégulières (taille et angle propres à chacune),
 * surface de pierre mate avec micro-relief et reflet doux, joints de mortier qui se remplissent à la fin.
 */
export const mosaicMode: ModeDefinition = {
  id: 'mosaic',
  placeDuration: 360,
  impactAt: 0.45,
  paper: [0.83, 0.81, 0.77],
  backdrop: [0.88, 0.865, 0.84],
  emptyTint: 0.2,
  sound: 'tile',
  haptic: 'click',
  usesLight: true,
  frame: FrameStyle.Slate,
  glsl: {
    pendingAsGap: true,
    gap: /* glsl */ `
// Mortier : en creux (humide) pendant la pose, lissé et éclairci quand les joints se remplissent.
vec3 gapColor(vec3 col, vec2 f) {
  float fill = gTension;
  float sand = vnoise((gCell + f) * 14.0);
  vec3 wet = vec3(0.67, 0.655, 0.63) * (0.93 + 0.1 * sand);
  vec3 grout = vec3(0.88, 0.865, 0.83) * (0.96 + 0.06 * sand);
  return mix(wet, grout, fill);
}
`,
    material: /* glsl */ `
vec2 rot2(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

// Tesselle : rectangle arrondi aux côtés inégaux, légèrement tourné (propre à chaque case).
float tileSdf(vec2 f, float seed, out vec2 q, out vec2 hs) {
  vec2 p = rot2(f - 0.5, (seed - 0.5) * 0.13);
  vec4 h = fract(vec4(seed * 13.1, seed * 27.7, seed * 41.3, seed * 59.9));
  vec2 lo = -vec2(0.44 - 0.05 * h.x, 0.44 - 0.05 * h.y);
  vec2 hi = vec2(0.44 - 0.05 * h.z, 0.44 - 0.05 * h.w);
  hs = (hi - lo) * 0.5;
  q = p - (lo + hi) * 0.5;
  vec2 d = abs(q) - hs + 0.08;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - 0.08;
}

vec4 material(vec2 f, vec3 col, float seed, float px, float cellPx) {
  vec2 q;
  vec2 hs;
  float sd = tileSdf(f, seed, q, hs);
  float aa = max(px * 1.3, 0.008);
  float cover = 1.0 - smoothstep(-aa, aa, sd);
  if (cover <= 0.0) return vec4(0.0);
  // bord arrondi : normale inclinée vers l'extérieur près du bord
  vec2 d = abs(q) - hs + 0.08;
  vec2 g = d.x > d.y ? vec2(sign(q.x), 0.0) : vec2(0.0, sign(q.y));
  if (d.x > 0.0 && d.y > 0.0) g = normalize(max(d, 0.0) * sign(q));
  float bevel = smoothstep(-0.13, 0.0, sd);
  vec3 n = normalize(vec3(g * bevel * 1.3, 1.0));
  // micro-relief de la pierre
  vec2 np = (gCell + f) * 9.0 + seed * 17.0;
  float grain = vnoise(np) * 0.6 + vnoise(np * 2.7) * 0.4;
  n = normalize(n + vec3(vnoise(np + 3.1) - 0.5, vnoise(np + 7.7) - 0.5, 0.0) * 0.12);
  vec3 L = normalize(uLight);
  float diff = max(dot(n, L), 0.0);
  float spec = pow(max(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 36.0);
  // chaque tesselle a sa nuance
  vec3 base = col * (0.93 + 0.12 * fract(seed * 7.31)) * (0.94 + 0.1 * grain);
  vec3 c = base * (0.55 + 0.55 * diff) + spec * 0.22 * (0.6 + 0.4 * gTension);
  // lustrage final
  c += gTension * 0.03;
  return vec4(c, cover);
}
`,
    empty: /* glsl */ `
vec4 emptyCell(vec2 f, int idx, vec3 col, float px, float cellPx, float numberAlpha, float selected) {
  // lit de mortier frais, avec le dessin tracé au pinceau
  float sand = vnoise((gCell + f) * 11.0);
  vec3 base = uPaper * (0.95 + 0.07 * sand);
  float tint = selected > 0.5 ? clamp(0.32 * selectionGlow(uTime), 0.0, 0.62) : 0.16;
  base = mix(base, col, tint);
  float edge = min(min(f.x, f.y), min(1.0 - f.x, 1.0 - f.y));
  base *= 1.0 - (1.0 - smoothstep(0.0, px * 1.2, edge)) * 0.07 * smoothstep(4.0, 10.0, cellPx);
  if (numberAlpha > 0.0 && uNumbers > 0.0) {
    float m = numberMask(f, idx + 1, px) * numberAlpha;
    vec3 ink = selected > 0.5 ? mix(col * 0.3, vec3(0.1), 0.5) : vec3(0.4, 0.38, 0.36);
    if (selected > 0.5 && luma(col) < 0.35) ink = vec3(0.97);
    base = mix(base, ink, m);
  }
  return vec4(base, 1.0);
}
`,
    finale: /* glsl */ `
vec3 finaleEffect(vec3 c, vec2 cell, vec2 f, float near) {
  return c + finalePulse(cell) * 0.08 * (vec3(1.0) - c);
}
`,
    // la tesselle tombe en pivotant puis se stabilise (« clac »)
    animVertex: /* glsl */ `
    float seedA = aData.w - 0.5;
    if (p < 0.45) {
      float t = p / 0.45;
      off.y = -0.28 * (1.0 - t * t);
      s = 1.1 - 0.1 * t * t;
      rot = seedA * 0.5 * (1.0 - t);
    } else {
      float t = (p - 0.45) / 0.55;
      rot = -seedA * 0.08 * sin(t * 3.14159 * 2.0) * (1.0 - t);
      off.y = -0.015 * sin(t * 3.14159) * (1.0 - t);
    }
`,
    animFragment: /* glsl */ `
    // ombre sous la tesselle en l'air, plus claire à l'impact
    float lifted = 1.0 - smoothstep(0.3, 0.45, p);
    m.rgb *= 1.0 - 0.06 * lifted;
    m.rgb += smoothstep(0.42, 0.47, p) * (1.0 - smoothstep(0.47, 0.7, p)) * 0.08;
`,
  },
};
