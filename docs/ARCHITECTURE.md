# Tessel — Architecture

Jeu Android de coloriage relaxant (pixel art par numéros, diamond painting, point de croix, mosaïque).
100 % hors ligne, sans achat intégré ni publicité. Distribution : APK signé via GitHub Releases + mise à jour in-app.

## Stack

Vite + React 18 + TypeScript strict · Zustand · PixiJS v8 (WebGL2, shaders custom) · Framer Motion ·
Capacitor 8 (Android, minSdk 24, targetSdk 36, JDK 21) · SQLite (@capacitor-community/sqlite) · Web Workers (Comlink) ·
Web Audio (moteur maison), Tone.js hors ligne pour composer · Vitest · semantic-release.

## Arborescence

```
src/
  engine/   renderer Pixi unique (1 contexte WebGL), caméra, gestes, grille GPU, LOD, hit-test, horloge injectable
  modes/    pixel · diamond · crossstitch · mosaic : matériau GLSL, anim de pose, finale, son, haptique
  fx/       pools de particules, tweens/ressorts, timeline, cinématiques clés, traînée
  convert/  worker : réglages, OKLab, median cut + k-means, dithering, fusion, nettoyage, fond
  content/  format de grille, catalogue, générateurs, œuvre du jour, collections, événements
  create/   éditeur pixel art, calques, symétrie, .tessel, QR
  meta/     XP/niveaux, déblocages, quêtes, séries, succès, stats
  gallery/  murs, cadres, rendu final, exports (PNG HD, MP4/GIF, fond d'écran)
  db/       drivers (SQLite natif / sql.js), migrations, journal de progression, export/import .zip
  audio/    bus Web Audio, banques SFX, limiteur de voix, playlist, ambiances, haptique
  update/   GitHub Releases, semver, téléchargement/installation
  native/   interface TS du plugin natif TesselNative
  theme/    tokens couleurs (Doux, Material You, Clair, Sombre, contraste élevé) + motion/
  ui/ store/ i18n/ config/ debug/
scripts/    import domaine public, SVG→grilles, génération procédurale, rendu musique/SFX, icônes
assets/     icône/splash (sources), art/ (grilles, SVG, CREDITS.md), audio/ (music/ + tracks.json, CREDITS.md)
android/    projet Capacitor + plugin Kotlin TesselNative
```

Le moteur vit hors de React (classes TS + bus d'événements). React reçoit au plus un commit d'état par frame.

## Moteur de rendu

- Grille = 1 quad + 1 fragment shader, état en textures de données :
  `target` (R8, index couleur, 255 = transparent), `state` (R8 : 0 vide, 1 en animation, 2 posée),
  `palette` (64×1), `glyphs` (SDF des chiffres, TinySDF), `flat` (RGBA W×H mipmappée pour le dézoom).
  1 draw call, coût O(pixels écran), zéro objet par case.
- LOD selon la taille d'une case à l'écran : < 6 px texture `flat` ; 6–18 px matériau simplifié ;
  > 18 px matériau complet + numéros + motifs daltoniens + surbrillance. Fondus entre niveaux, AA par `fwidth`.
- Chunks : régions sales pour les mises à jour de textures, exports HD par tuiles.
- Cases en animation : couche instanciée (pool de 512) exécutant le même GLSL de matériau ;
  en fin d'anim `state → 2`, l'instance retourne au pool.
- Effets globaux par uniforms : onde de couleur terminée, balayage final, cascade diamant, toile tendue, joints.
- Rendu à la demande, `highp` obligatoire, particules via ParticleContainer v8, traînée en ruban.
- Gestes : 2 doigts = caméra ; 1 doigt glissé = peindre si départ sur une case de la couleur active, sinon déplacer ;
  appui long = peinture forcée ; double tap = zoom ; inertie et bords élastiques.
- FeedbackBus : visuel + son + haptique dans la même frame.

## Modes

| Mode           | Vide                     | Posée                                             | Pose                                        | Finale                        |
| -------------- | ------------------------ | ------------------------------------------------- | ------------------------------------------- | ----------------------------- |
| Pixel          | papier teinté + numéro   | aplat, micro-biseau                               | 0.8→1.05→1 + éclat                          | grille s'efface, grain papier |
| Diamant        | toile adhésive + symbole | drill à facettes, spéculaire piloté par gyroscope | chute + rebond, étoile, reflet              | cascade de scintillements     |
| Point de croix | toile Aida procédurale   | 2 fils torsadés, ombre                            | fils tracés l'un après l'autre              | toile tendue, tambour         |
| Mosaïque       | lit de mortier           | tesselle irrégulière pierre/verre                 | pose + rotation qui se stabilise, poussière | joints remplis, lustrage      |

## Charte de motion (`src/theme/motion`)

- Durées : 120 / 180 / 240 / 320 / 450 ms.
- Courbes : standard (0.2,0,0,1), décélération (0.05,0.7,0.1,1), accélération (0.3,0,0.8,0.15), settle (léger dépassement).
- Ressorts (stiffness/damping) : doux 170/26, vif 420/32, rebond 320/14, sheet 260/30, caméra 200/28 — mêmes valeurs en Framer et Pixi.
- Stagger : cartes 30 ms (plafond 300 ms), vagues grille 6 ms/unité (plafond 600 ms).
- Tout est interruptible ; « Réduire les animations » = fondus 120 ms, son/haptique conservés.
- Qualité basse/moyenne/haute : particules 25/60/100 %, reflets, résolution de rendu — jamais la fluidité.

## Progression

- XP : 1/case × taille (×1 à ×1,6) ; ×1,5 sur les 3 premières œuvres d'un nouveau mode ; fin d'œuvre +15 % des cases +50.
- Coût du niveau n→n+1 : `800 + 330·n`, calibré par `scripts/sim/progression.ts` (joueur régulier ~20 min/jour,
  ~4 000 XP/jour) : niv 4 au 1er jour, 10 à J3, 50 vers J80, 75 vers J210, 100 vers J400 (test de non-régression).
- Déblocages : Pixel, import photo, création dès le début ; Diamant niv 2, Point de croix niv 6, Mosaïque niv 10 ;
  catégories/cadres/textures/palettes/murs/ambiances/musiques jusqu'au niv 80 (≥ 1 récompense par niveau, testé) ;
  au-delà : outils + cosmétique tous les 5 niveaux. Thèmes et accessibilité jamais verrouillés.
- Outils (départ 3 loupes, 2 pots, 1 baguette) : niveaux, quêtes, coffres, séries, collections.
- Quêtes : 3/jour + 3/semaine, seed date + état joueur, 1 remplacement gratuit par jour.
- Série : jour validé à 30 cases ; jokers auto (1 au départ, +1 tous les 7 jours, max 3) ; paliers 3/7/14/30/60/100/200/365.
- 150 succès (110 à paliers, 25 découvertes, 15 secrets). ~20 collections + 6 événements annuels.
- Module `src/meta` : logique pure testée (niveaux, déblocages, série, quêtes, succès, coffres, secrets)
  + `MetaService` (état en mémoire, notifications, écriture groupée en base via `MetaStore`).

## Contenu & conversion

- Grilles figées : bibliothèque précalculée au build ; grilles photo/procédurales/partagées figées en base au 1er lancement.
- Difficultés : Facile ≤ 50² / 8–12 c. · Moyen ~100² / 16–24 · Difficile ~150² / 24–36 · Expert 200–300² / 36–64.
- Conversion : OKLab, median cut → k-means pondéré, fusion ΔE, Floyd-Steinberg serpentin, nettoyage des îlots, fond par remplissage depuis les bords.

## Sauvegarde

SQLite (`PRAGMA user_version` + migrations). Journal de poses append-only (lot toutes les 2 s ou 64 cases) = sauvegarde
incrémentale + timelapse + undo ; snapshot bitset compressé en arrière-plan. Export/import `.zip` (JSON versionné + fichiers).

## Distribution

APK unique signé (même keystore), publié par semantic-release sur push `main` ; mise à jour in-app via GitHub Releases
(téléchargement natif avec reprise + SHA-256, installation FileProvider + ACTION_VIEW).
