/**
 * Morceaux GLSL (ES 3.00) partagés par la grille et la couche d'animation.
 * Les textures de données sont lues par texelFetch (aucun filtrage) ; seule la lecture « lointaine »
 * de uCells est filtrée linéairement pour le niveau de détail dézoomé.
 */

export const DIGIT_SLOTS = 10;

export const UNIFORMS_GLSL = /* glsl */ `
uniform sampler2D uCells;    // rgb = couleur vue de loin, a = état (0 vide, .5 en animation, 1 posée)
uniform sampler2D uTarget;   // r = index de palette (255 = transparent), g = graine aléatoire
uniform sampler2D uPalette;  // 64×1
uniform sampler2D uDigits;   // atlas SDF des chiffres 0–9 (canal a)
uniform vec2 uTranslate;     // px CSS : position écran de l'origine de la grille
uniform float uScale;        // px CSS par case
uniform float uPixelRatio;
uniform vec2 uGrid;          // largeur, hauteur en cases
uniform float uTime;         // secondes
uniform float uSelected;     // index de la couleur active (-1 : aucune)
uniform float uSelectTime;
uniform vec3 uLight;         // direction de la lumière (espace écran, y vers le bas)
uniform vec4 uWave;          // onde : origine (x, y), départ, index couleur
uniform float uDuration;     // durée de l'animation de pose (s)
uniform float uNumbers;      // échelle des numéros (0 = masqués)
uniform vec3 uPaper;
uniform vec3 uBackdrop;
`;

export const HELPERS_GLSL = /* glsl */ `
vec3 paletteColor(int i) { return texelFetch(uPalette, ivec2(i, 0), 0).rgb; }

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// Masque d'un chiffre (0–9) ; uv dans [0,1]² de la case de l'atlas.
float digitMask(vec2 uv, int d, float aa) {
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
  vec2 a = vec2((float(d) + uv.x) / ${DIGIT_SLOTS}.0, uv.y);
  float s = textureLod(uDigits, a, 0.0).a;
  return smoothstep(0.75 - aa, 0.75 + aa, s);
}

// Numéro n (1–99) centré dans la case ; px = taille d'un pixel écran en unités de case.
float numberMask(vec2 f, int n, float px) {
  float size = 0.78 * uNumbers;
  if (n >= 10) size *= 0.86;
  // 1 px écran = px/size unités d'atlas ; le SDF varie de 1/10 par px d'atlas (64 px, rayon 10)
  float aa = clamp(px / size * 64.0 / 10.0 * 0.5, 0.02, 0.45);
  if (n < 10) return digitMask((f - 0.5) / size + 0.5, n, aa);
  float adv = 0.25 * size;
  float m1 = digitMask((f - vec2(0.5 - adv, 0.5)) / size + 0.5, n / 10, aa);
  float m2 = digitMask((f - vec2(0.5 + adv, 0.5)) / size + 0.5, n - (n / 10) * 10, aa);
  return max(m1, m2);
}

// Intensité de la surbrillance de la couleur active (avec pulsation au changement).
float selectionGlow(float t) {
  float since = t - uSelectTime;
  return 1.0 + 0.9 * exp(-since * 2.2) * (0.5 + 0.5 * sin(since * 11.0));
}

// Onde de lumière qui parcourt une couleur terminée.
float waveBand(vec2 cellCenter, int idx) {
  if (idx != int(uWave.w + 0.5) || uWave.w < 0.0) return 0.0;
  float since = uTime - uWave.z;
  if (since < 0.0 || since > 2.5) return 0.0;
  float speed = max(uGrid.x, uGrid.y) / 1.1;
  float d = distance(cellCenter, uWave.xy);
  float front = since * speed;
  float band = exp(-pow((d - front) / 3.0, 2.0));
  return band * (1.0 - smoothstep(1.6, 2.5, since));
}
`;

export const GRID_VERTEX = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vPos;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vPos = aPosition;
}
`;

/** Interface GLSL qu'un mode doit fournir (voir src/modes). */
export interface ModeGlsl {
  /** vec4 material(vec2 f, vec3 col, float seed, float px, float cellPx) → rgb + couverture. */
  material: string;
  /** vec4 emptyCell(vec2 f, int idx, vec3 col, float px, float cellPx, float numberAlpha, float selected). */
  empty: string;
  /** vec3 gapColor(vec3 col, vec2 f) : fond visible entre les éléments posés. */
  gap: string;
  /** Corps GLSL du vertex d'animation : lit p (0–1), écrit s (échelle), off (décalage en cases), rot. */
  animVertex: string;
  /** Corps GLSL du fragment d'animation : lit p, f, col ; modifie m (vec4). */
  animFragment: string;
}

export function gridFragment(mode: ModeGlsl): string {
  return /* glsl */ `#version 300 es
precision highp float;
in vec2 vPos;
out vec4 finalColor;
${UNIFORMS_GLSL}
${HELPERS_GLSL}
${mode.gap}
${mode.material}
${mode.empty}

void main() {
  vec2 w = (vPos - uTranslate) / uScale;       // coordonnées en cases
  float px = 1.0 / (uScale * uPixelRatio);      // 1 pixel écran en unités de case
  float cellPx = uScale * uPixelRatio;
  vec3 far = texture(uCells, w / uGrid).rgb;    // lecture filtrée (niveau de détail lointain)

  // Hors de la grille : fond + ombre douce du support
  if (w.x < 0.0 || w.y < 0.0 || w.x >= uGrid.x || w.y >= uGrid.y) {
    vec2 outside = max(max(-w, w - uGrid), 0.0) * uScale;
    float d = length(outside);
    float shadow = exp(-d / 16.0) * 0.10 + exp(-d / 4.0) * 0.05;
    finalColor = vec4(uBackdrop * (1.0 - shadow), 1.0);
    return;
  }

  ivec2 c = ivec2(floor(w));
  vec2 f = fract(w);
  vec4 tgt = texelFetch(uTarget, c, 0);
  int idx = int(tgt.r * 255.0 + 0.5);
  if (idx == 255) {
    finalColor = vec4(uPaper, 1.0);
    return;
  }
  float seed = tgt.g;
  float state = texelFetch(uCells, c, 0).a;
  vec3 col = paletteColor(idx);
  float near = smoothstep(2.5, 6.0, cellPx);
  vec3 outc = far;

  if (near > 0.0) {
    vec3 detail;
    if (state > 0.75) {
      vec4 m = material(f, col, seed, px, cellPx);
      detail = mix(gapColor(col, f), m.rgb, m.a);
      detail += waveBand(vec2(c) + 0.5, idx) * (vec3(1.0) - detail) * 0.55;
    } else {
      float selected = float(idx == int(uSelected + 0.5) && uSelected >= 0.0);
      float numberAlpha = state > 0.25 ? 0.0 : smoothstep(11.0, 17.0, cellPx);
      vec4 e = emptyCell(f, idx, col, px, cellPx, numberAlpha, selected);
      detail = e.rgb;
    }
    outc = mix(far, detail, near);
  }
  finalColor = vec4(outc, 1.0);
}
`;
}

export function animVertex(mode: ModeGlsl): string {
  return /* glsl */ `#version 300 es
precision highp float;
in vec2 aCorner;
in vec2 aCell;
in vec4 aData; // départ (s), index couleur, type (0 pose, 1 tremblement), graine
out vec2 vF;
out float vP;
out float vIdx;
out float vKind;
out float vSeed;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
${UNIFORMS_GLSL}

void main() {
  float dur = aData.z > 0.5 ? 0.34 : uDuration;
  float p = (uTime - aData.x) / dur;
  vF = aCorner;
  vP = p;
  vIdx = aData.y;
  vKind = aData.z;
  vSeed = aData.w;
  if (p < 0.0 || p >= 1.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float s = 1.0;
  vec2 off = vec2(0.0);
  float rot = 0.0;
  if (aData.z > 0.5) {
    off.x = 0.13 * sin(p * 3.14159 * 6.0) * (1.0 - p);
  } else {
${mode.animVertex}
  }
  vec2 q = (aCorner - 0.5) * s;
  q = mat2(cos(rot), sin(rot), -sin(rot), cos(rot)) * q;
  vec2 screen = uTranslate + (aCell + 0.5 + q + off) * uScale;
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(screen, 1.0)).xy, 0.0, 1.0);
}
`;
}

export function animFragment(mode: ModeGlsl): string {
  return /* glsl */ `#version 300 es
precision highp float;
in vec2 vF;
in float vP;
in float vIdx;
in float vKind;
in float vSeed;
out vec4 finalColor;
${UNIFORMS_GLSL}
${HELPERS_GLSL}
${mode.gap}
${mode.material}
${mode.empty}

void main() {
  int idx = int(vIdx + 0.5);
  vec3 col = paletteColor(idx);
  vec2 f = vF;
  float px = max(fwidth(f.x), 1e-4);
  float cellPx = 1.0 / px;
  float p = clamp(vP, 0.0, 1.0);
  vec4 m;
  if (vKind > 0.5) {
    float selected = float(idx == int(uSelected + 0.5) && uSelected >= 0.0);
    m = emptyCell(f, idx, col, px, cellPx, smoothstep(11.0, 17.0, cellPx), selected);
    m.rgb *= 0.96;
  } else {
    m = material(f, col, vSeed, px, cellPx);
${mode.animFragment}
  }
  finalColor = vec4(m.rgb * m.a, m.a);
}
`;
}
