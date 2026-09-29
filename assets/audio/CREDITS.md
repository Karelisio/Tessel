# Crédits audio

Tous les sons de Tessel sont originaux, créés pour le jeu, et placés dans le domaine public (CC0 1.0).

- **Musique** (`music/*.ogg`, 8 pistes) : composée en code avec [Tone.js](https://tonejs.github.io/)
  (`scripts/audio/compose.ts`), rendue hors ligne dans Chromium, normalisée à -16 LUFS (UIT-R BS.1770),
  encodée en Opus. Tone.js est sous licence MIT ; il ne sert qu'au pré-rendu et n'est pas embarqué dans l'application.
- **Ambiances** (`ambience/*.ogg` : pluie, feu de cheminée, café, forêt, vagues) : synthèse Web Audio
  (`scripts/audio/ambiences.ts`), boucles sans couture, normalisées à -22 LUFS.
- **Effets sonores** (un son par mode, variantes et hauteurs) : synthétisés à l'exécution
  (`src/audio/synth.ts`), aucun fichier externe.
