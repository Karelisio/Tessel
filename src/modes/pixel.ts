import { FrameStyle } from '@/fx/finaleTimeline';
import type { ModeDefinition } from './types';

/** Pixel art par numéros : aplats nets sur papier, léger biseau au zoom. */
export const pixelMode: ModeDefinition = {
  id: 'pixel',
  placeDuration: 240,
  impactAt: 0,
  paper: [0.984, 0.976, 0.965],
  backdrop: [0.93, 0.915, 0.9],
  emptyTint: 0.14,
  sound: 'pixel',
  haptic: 'tick-light',
  usesLight: false,
  frame: FrameStyle.White,
  glsl: {
    pendingAsGap: false,
    gap: /* glsl */ `
vec3 gapColor(vec3 col, vec2 f) { return col; }
`,
    material: /* glsl */ `
// Grain du support, commun aux cases vides et peintes (continu d'une case à l'autre).
float paperGrain(vec2 w, int tex) {
  if (tex == 1) return (vnoise(w * 7.0) - 0.5) * 0.05 + (vnoise(w * 23.0) - 0.5) * 0.03;
  if (tex == 2) return (vnoise(vec2(w.x * 3.0, w.y * 19.0)) - 0.5) * 0.07 + (vnoise(w * 31.0) - 0.5) * 0.03;
  if (tex == 4) {
    vec2 t = w * 6.0;
    float weave = sin(t.x * 3.14159) * sin(t.y * 3.14159);
    return weave * 0.035 + (vnoise(w * 13.0) - 0.5) * 0.02;
  }
  return 0.0;
}

vec4 material(vec2 f, vec3 col, float seed, float px, float cellPx) {
  int tex = int(uTexture + 0.5);
  vec2 w = gCell + f;
  float detail = smoothstep(4.0, 12.0, cellPx);
  if (tex == 1) {
    // aquarelle : pigment qui se dépose inégalement, bords de flaque plus soutenus, grain du papier
    float pool = vnoise(w * 1.3 + seed) * 0.6 + vnoise(w * 3.1) * 0.4;
    vec3 c = mix(col, col * col * 1.05, 0.22 * pool);
    c = mix(c, uPaper, 0.1 * (1.0 - pool));
    c *= 1.0 + paperGrain(w, tex) * detail;
    return vec4(c, 1.0);
  }
  if (tex == 2) {
    // kraft : l'encre prend la teinte du papier brun et ses fibres
    vec3 c = mix(col, col * uPaper * 1.18, 0.28);
    c *= 1.0 + paperGrain(w, tex) * detail;
    return vec4(c, 1.0);
  }
  if (tex == 3) {
    // carnet : feutre, trait un peu plus foncé sur les bords de la case
    float e = min(min(f.x, f.y), min(1.0 - f.x, 1.0 - f.y));
    vec3 c = col * (1.0 - 0.045 * (1.0 - smoothstep(0.0, 0.14, e)) * detail * (1.0 - gTension));
    c *= 1.0 + (vnoise(w * 17.0) - 0.5) * 0.03 * detail;
    return vec4(c, 1.0);
  }
  if (tex == 4) {
    // toile de peintre : empâtement, trame de la toile, touche de pinceau
    float stroke = vnoise(vec2(w.x * 2.2 + seed * 3.0, w.y * 7.0));
    vec3 c = col * (0.96 + 0.08 * stroke);
    c *= 1.0 + paperGrain(w, tex) * detail * 1.3;
    return vec4(c, 1.0);
  }
  // papier lisse : le biseau s'efface à la fin de l'œuvre, l'image devient une vraie création
  float k = clamp((cellPx - 8.0) / 24.0, 0.0, 1.0) * (1.0 - gTension);
  float hi = 1.0 - smoothstep(0.0, 0.16, min(f.x, f.y));
  float lo = 1.0 - smoothstep(0.0, 0.16, min(1.0 - f.x, 1.0 - f.y));
  vec3 c = col * (1.0 + k * (0.07 * hi - 0.08 * lo));
  c += k * 0.012 * (seed - 0.5);
  return vec4(c, 1.0);
}
`,
    empty: /* glsl */ `
vec4 emptyCell(vec2 f, int idx, vec3 col, float px, float cellPx, float numberAlpha, float selected) {
  float gray = luma(col);
  vec3 soft = mix(vec3(gray), col, 0.55);
  vec3 base = mix(uPaper, soft, 0.10);
  if (selected > 0.5) {
    float glow = selectionGlow(uTime);
    base = mix(uPaper, col, clamp(0.30 * glow, 0.0, 0.62));
    float hatch = step(0.5, fract((f.x + f.y) * 2.5));
    base *= 1.0 - 0.035 * hatch * smoothstep(8.0, 16.0, cellPx);
  }
  int tex = int(uTexture + 0.5);
  base *= 1.0 + paperGrain(gCell + f, tex) * smoothstep(4.0, 12.0, cellPx);
  float edge = min(min(f.x, f.y), min(1.0 - f.x, 1.0 - f.y));
  if (tex == 3) {
    // carnet pointillé : un point aux coins des cases
    vec2 cq = min(f, 1.0 - f);
    float dotm = 1.0 - smoothstep(0.05, 0.05 + px * 1.5, length(cq));
    base *= 1.0 - dotm * 0.3 * smoothstep(4.0, 10.0, cellPx);
  } else {
    // grille fine
    float line = 1.0 - smoothstep(0.0, px * 1.2, edge);
    base *= 1.0 - line * 0.10 * smoothstep(4.0, 10.0, cellPx);
  }
  // numéro
  if (numberAlpha > 0.0 && uNumbers > 0.0) {
    float m = numberMask(f, idx + 1, px) * numberAlpha;
    vec3 ink = selected > 0.5 ? mix(col * 0.35, vec3(0.12), 0.5) : vec3(0.52, 0.49, 0.5);
    if (selected > 0.5 && luma(col) < 0.35) ink = vec3(0.97);
    base = mix(base, ink, m);
  }
  return vec4(base, 1.0);
}
`,
    finale: /* glsl */ `
vec3 finaleEffect(vec3 c, vec2 cell, vec2 f, float near) {
  return c + finalePulse(cell) * 0.14 * (vec3(1.0) - c);
}
`,
    // rebond 0.8 → ~1.05 → 1
    animVertex: /* glsl */ `
    s = 1.0 - 0.2 * exp(-5.2 * p) * cos(10.0 * p);
`,
    // éclat de couleur au début de la pose
    animFragment: /* glsl */ `
    float flash = pow(1.0 - p, 3.0);
    m.rgb = mix(m.rgb, vec3(1.0), flash * 0.45);
`,
  },
};
