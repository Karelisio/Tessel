/** Éclats de lumière des diamants : petites étoiles à quatre branches semées au hasard (motifs SVG). */

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function tile(size: number, count: number, seed: number, reach: number): string {
  const rand = rng(seed);
  let body = '';
  for (let i = 0; i < count; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = reach * (0.45 + rand() * 0.55);
    const a = (0.55 + rand() * 0.45).toFixed(2);
    const k = (r * 0.16).toFixed(2);
    const f = (n: number) => n.toFixed(1);
    // étoile concave : quatre pointes reliées par des courbes qui plongent vers le centre
    body += `<path d="M${f(x)} ${f(y - r)}Q${f(x + Number(k))} ${f(y - Number(k))} ${f(x + r)} ${f(y)}Q${f(x + Number(k))} ${f(y + Number(k))} ${f(x)} ${f(y + r)}Q${f(x - Number(k))} ${f(y + Number(k))} ${f(x - r)} ${f(y)}Q${f(x - Number(k))} ${f(y - Number(k))} ${f(x)} ${f(y - r)}Z" fill="#fff" fill-opacity="${a}"/>`;
    body += `<circle cx="${f(x)}" cy="${f(y)}" r="${(r * 0.16).toFixed(2)}" fill="#fff"/>`;
  }
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${String(size)}" height="${String(size)}" viewBox="0 0 ${String(size)} ${String(size)}">${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(doc)}")`;
}

export const GLITTER_FINE = tile(74, 6, 4, 4.2);
export const GLITTER_BOLD = tile(122, 5, 9, 7.5);
