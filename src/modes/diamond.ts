import type { ModeDefinition } from './types';

/**
 * Diamond painting : diamants carrés taillés (table + 8 facettes), normales analytiques,
 * éclairage piloté par l'inclinaison du téléphone, reflets d'environnement et scintillements.
 */
export const diamondMode: ModeDefinition = {
  id: 'diamond',
  placeDuration: 440,
  /** Instant de l'impact (fraction de la durée) : son, haptique et étoile y sont synchronisés. */
  impactAt: 0.26,
  paper: [0.965, 0.958, 0.95],
  backdrop: [0.9, 0.885, 0.87],
  emptyTint: 0.2,
  sound: 'diamond',
  haptic: 'tick',
  usesLight: true,
  glsl: {
    gap: /* glsl */ `
vec3 gapColor(vec3 col, vec2 f) {
  return mix(uPaper * 0.55, col * 0.45, 0.5);
}
`,
    material: /* glsl */ `
float envLight(vec3 r, vec3 l) {
  // studio doux : une fenêtre qui suit la lumière + une contre-lumière
  float w1 = smoothstep(0.55, 0.0, length(r.xy - l.xy * 0.95));
  float w2 = smoothstep(0.35, 0.0, length(r.xy + l.xy * 0.7 + vec2(0.25, -0.1)));
  return w1 + 0.45 * w2;
}

vec4 material(vec2 f, vec3 col, float seed, float px, float cellPx) {
  vec2 p = f * 2.0 - 1.0;
  float aa = max(px * 2.0, 0.004);
  // carré arrondi (écart entre diamants)
  float halfSize = 0.935;
  float radius = 0.14;
  vec2 q = abs(p) - vec2(halfSize - radius);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  float cover = 1.0 - smoothstep(-aa, aa, d);
  if (cover <= 0.0) return vec4(0.0);

  // facettes : table centrale + 8 facettes de biseau
  vec2 ap = abs(p);
  float m = max(ap.x, ap.y);
  float table = 0.44;
  vec3 n = vec3(0.0, 0.0, 1.0);
  vec2 sg = sign(p + 1e-5);
  if (m >= table) {
    float k = 0.95;
    if (ap.x > ap.y) n = normalize(vec3(sg.x * k, sg.y * k * 0.36, 1.0));
    else n = normalize(vec3(sg.x * k * 0.36, sg.y * k, 1.0));
  }
  // arêtes entre facettes
  float eTable = abs(m - table);
  float eDiag = m > table ? abs(ap.x - ap.y) * 0.7071 : 1.0;
  float eAxis = m > table ? min(ap.x, ap.y) : 1.0;
  float edge = 1.0 - smoothstep(0.0, aa * 1.5, min(eTable, min(eDiag, eAxis)));
  float detail = smoothstep(5.0, 14.0, cellPx);

  vec3 L = normalize(uLight);
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 H = normalize(L + V);
  float diff = max(dot(n, L), 0.0);
  float spec = pow(max(dot(n, H), 0.0), 90.0);
  vec3 R = reflect(-V, n);
  float env = envLight(R, L);

  // corps du diamant : réfraction simulée (bords plus lumineux, centre plus profond)
  vec3 body = col * (0.36 + 0.78 * diff);
  float depth = smoothstep(0.0, 0.9, m);
  body *= mix(0.84, 1.16, depth);
  // chaque facette capte une zone différente de l'environnement : alternance clair/sombre
  float facetId = dot(sg, vec2(1.0, 2.0)) + (ap.x > ap.y ? 0.5 : 0.0);
  body *= m >= table ? 0.92 + 0.16 * fract(sin(facetId * 12.9898 + seed * 3.0) * 43758.5) : 1.0;
  vec3 c = body;
  c += env * mix(col, vec3(1.0), 0.6) * 0.5 * detail;
  c += spec * 1.15;
  c += edge * detail * 0.14 * (0.5 + diff);

  // scintillement ponctuel sur certaines pierres
  float tw = sin(uTime * (0.7 + seed * 1.9) + seed * 43.0);
  float twinkle = pow(max(tw, 0.0), 40.0) * step(0.62, seed) * (1.0 - smoothstep(0.0, 0.5, length(p - vec2(-0.25, -0.3))));
  c += twinkle * 0.8 * detail;

  // biseau du contour (lisibilité quand les diamants sont petits)
  c *= 1.0 - (1.0 - detail) * 0.12 * smoothstep(0.6, 1.0, m);
  return vec4(c, cover);
}
`,
    empty: /* glsl */ `
vec4 emptyCell(vec2 f, int idx, vec3 col, float px, float cellPx, float numberAlpha, float selected) {
  vec3 base = uPaper;
  // pastille imprimée sur la toile adhésive
  vec2 p = f * 2.0 - 1.0;
  vec2 q = abs(p) - vec2(0.62);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.18;
  float aa = max(px * 2.0, 0.004);
  float inside = 1.0 - smoothstep(-aa, aa, d);
  float tint = selected > 0.5 ? clamp(0.34 * selectionGlow(uTime), 0.0, 0.66) : 0.2;
  base = mix(base, mix(uPaper, col, tint), inside);
  // grain de la toile
  float grain = hash12(floor((vec2(0.0) + f) * 8.0) + float(idx)) - 0.5;
  base *= 1.0 + grain * 0.02 * smoothstep(10.0, 24.0, cellPx);
  // lignes de repère très légères
  float edge = min(min(f.x, f.y), min(1.0 - f.x, 1.0 - f.y));
  base *= 1.0 - (1.0 - smoothstep(0.0, px * 1.2, edge)) * 0.06 * smoothstep(4.0, 10.0, cellPx);
  if (numberAlpha > 0.0 && uNumbers > 0.0) {
    float m = numberMask(f, idx + 1, px) * numberAlpha;
    vec3 ink = selected > 0.5 ? mix(col * 0.3, vec3(0.1), 0.5) : mix(vec3(0.45), col * 0.45, 0.35);
    if (selected > 0.5 && luma(col) < 0.35) ink = vec3(0.97);
    base = mix(base, ink, m);
  }
  return vec4(base, 1.0);
}
`,
    // chute de quelques pixels puis petit rebond
    animVertex: /* glsl */ `
    if (p < 0.26) {
      float t = p / 0.26;
      off.y = -0.45 * (1.0 - t * t);
      s = 1.12 - 0.12 * t * t;
    } else if (p < 0.5) {
      float t = (p - 0.26) / 0.24;
      off.y = -0.06 * sin(3.14159 * t);
      s = 1.0 + 0.012 * sin(3.14159 * t);
    }
`,
    // éclat à l'impact + reflet qui balaie la facette
    animFragment: /* glsl */ `
    float impact = smoothstep(0.2, 0.27, p) * (1.0 - smoothstep(0.27, 0.5, p));
    m.rgb += impact * 0.22;
    float sweepPos = (p - 0.3) * 1.9 - 0.25;
    float along = (f.x + f.y) * 0.5;
    float band = exp(-pow((along - sweepPos) * 8.0, 2.0)) * step(0.3, p);
    m.rgb += band * 0.55;
`,
  },
};
