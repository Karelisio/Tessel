# Illustrations SVG de Tessel

Les illustrations sont converties en grilles de 48 (facile), 96 (moyen), 144 (difficile) et 224 (expert)
cases de côté. Elles doivent rester lisibles à 48×48 : penser « pixel art de loin », formes franches.

## Fichiers

- `assets/art/svg/<catégorie>/<nom>.svg` — nom en kebab-case ASCII (`chat-endormi`).
- `assets/art/svg/<catégorie>/meta.json` — titres : `{ "<nom>": { "fr": "…", "en": "…" } }`.
- Catégories : animaux, fleurs, paysages, motifs, nourriture, chefs-doeuvre, mandalas, mer, oiseaux,
  espace, jardin, architecture, nuit, japon, insectes, saisons ; événements : `events/<événement>`.

## Règles techniques

- `viewBox="0 0 480 480"` (carré), ou `0 0 480 600` (portrait) / `0 0 600 480` (paysage). Pas de width/height.
- Éléments autorisés : `rect`, `circle`, `ellipse`, `path`, `polygon`, `polyline`, `line`, `g` (avec `transform`).
- Interdit : dégradés, motifs, filtres, masques, opacité, texte, images, `<style>`, couleurs nommées.
- Couleurs uniquement en attributs `fill="#rrggbb"` / `stroke="#rrggbb"` (les éléments sans fill explicite
  héritent du noir : toujours préciser `fill`, `fill="none"` pour les traits).
- 8 à 16 couleurs distinctes (20 au maximum), nettement différentes entre voisines.
- Un fond couvre toute la zone (ciel, mur, table, aplat) ; le sujet est grand, centré, ≥ 60 % du cadre.
- Tailles minimales : tout élément qui doit rester visible mesure ≥ 24 unités dans sa plus petite dimension
  (≈ 2,5 cases en facile) ; traits ≥ 10 unités ; yeux ≥ 24 unités de diamètre.

## Style

Illustration « à plat » douce et chaleureuse : formes arrondies, fonds pastel, un ou deux accents saturés,
compositions simples et apaisantes, sujets mignons sans être mièvres. Pas de texte, de logo, de marque,
de personnage connu, rien d'effrayant ni de violent (Halloween reste mignon).

## Vérification

```
npx tsx --tsconfig tsconfig.app.json scripts/art/preview-svg.ts aperçu.png assets/art/svg/animaux/*.svg
```

La planche montre l'original puis les grilles facile, moyen et difficile. En facile, le sujet doit se
reconnaître et les détails importants (yeux, cœur des fleurs) ne doivent pas disparaître.
Références : `animaux/renard.svg`, `fleurs/coquelicots.svg`.
