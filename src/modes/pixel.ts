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
  glsl: {
    gap: /* glsl */ `
vec3 gapColor(vec3 col, vec2 f) { return col; }
`,
    material: /* glsl */ `
vec4 material(vec2 f, vec3 col, float seed, float px, float cellPx) {
  float k = clamp((cellPx - 8.0) / 24.0, 0.0, 1.0);
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
  // grille fine
  float edge = min(min(f.x, f.y), min(1.0 - f.x, 1.0 - f.y));
  float line = 1.0 - smoothstep(0.0, px * 1.2, edge);
  base *= 1.0 - line * 0.10 * smoothstep(4.0, 10.0, cellPx);
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
