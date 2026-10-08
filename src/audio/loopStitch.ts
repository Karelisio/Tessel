/** Fondu du raccord (échantillons à 48 kHz) : 20 ms. */
export const STITCH = 960;

type LoopBuffer = Pick<AudioBuffer, 'length' | 'numberOfChannels' | 'getChannelData'>;

/**
 * Raccorde une boucle décodée sur elle-même. Opus décode séparément la fin et le début de la boucle :
 * leurs infimes erreurs ne se rejoignent pas et la jonction fait une petite marche, audible sur une
 * piste douce. Le fichier contient, après la fin, le début de la boucle décodé d'un seul tenant avec
 * elle (voisinage de l'encodage) : le début passe en fondu de cette suite à sa propre version.
 * Sans cette suite (décodeur qui coupe à la longueur exacte), rien ne change.
 */
export function stitchLoop(buffer: LoopBuffer, offset: number, samples: number, fade = STITCH): void {
  const n = Math.min(fade, buffer.length - offset - samples, samples);
  if (!(n >= 16)) return;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < n; i++) {
      const next = d[offset + samples + i] ?? 0;
      const own = d[offset + i] ?? 0;
      // deux versions du même son : un fondu linéaire garde le niveau
      d[offset + i] = next + (own - next) * ((i + 0.5) / n);
    }
  }
}
