# Interface de Tessel — guide pour les écrans

Application Capacitor (Android), React 18 + TypeScript strict, Zustand, Framer Motion. Français par défaut,
anglais disponible : **tout texte visible** s'écrit `tr(t('Texte français', 'English text'))`
(`import { tr } from '@/i18n/locale'; import { t } from '@/i18n/text';`). Apostrophe typographique ’ en français,
tutoiement, ton doux et chaleureux.

## Structure

- `src/ui/App.tsx` : jeu plein écran (`PlayScreen`) + coque à onglets (`src/ui/shell/Shell.tsx`) + toasts.
- 5 onglets : Bibliothèque (`screens/LibraryScreen.tsx`), Du jour (`DailyScreen.tsx`), Galerie et Créer
  (provisoires), Profil (`ProfileScreen.tsx`). Sous-pages empilées : `achievements`, `collections`, `stats`,
  `settings`, `quests` (`screens/<Nom>Screen.tsx`, export **default**, chargées paresseusement).
- Navigation (`src/store/nav.ts`, `useNav`) : `setTab(tab)`, `push(page)`, `pop()`,
  `open(ref, { mode?, origin: originOf(élémentTouché) })` ouvre une œuvre dans le jeu avec une transition partagée
  depuis la vignette (`originOf` dans `ui/library/origin.ts`), `openImport()` ouvre l'import photo.
- Œuvres : `libraryRef(entry, difficulty, index)`, `dailyRef(day)`, `refForProject(project, index)` dans
  `src/content/refs.ts` produisent l'`ArtworkRef` à passer à `useNav().open`.

## Données

- `src/app/queries.ts` : `useLibrary()`, `useProjects({ completed?, limit? })`, `useCompletedArtworks()`,
  `useProjectPreview(id)`, `useDailyHistory()`, `useFavoriteColors()`, `useQuery(load, deps)` (se recharge après
  chaque partie). `getServices()` (`src/app/services.ts`) donne `{ store, meta, library }`.
- Méta-progression : `useMetaStore((s) => s.snap)` (niveau, outils, coffres, série, quêtes, jour, modes et
  catégories débloqués…) et `useMetaStore((s) => s.service)` = `MetaService` (`src/meta/MetaService.ts` :
  `stat(metric)`, `achievementUnlockedAt(id)`, `openChest(size)`, `rerollQuest(id)`, `markSeen(keys)`, `unseen()`…).
  Après une action sur le service, appeler `useMetaStore.getState().refresh()`.
- Contenu : `src/content/categories.ts`, `library/types.ts` (difficultés `DIFFICULTY_SPEC`), `daily.ts`
  (`dailyArtwork(day)`), `events.ts` (`activeEvents(day)`, `daysLeft`, `nextEvent`), `collections.ts`.
- Succès : `src/meta/achievements.data.ts` (définitions), `achievements.text.ts` (titres/descriptions/indices),
  `achievements.ts` (`achievementRewards`). Quêtes : `ui/meta/labels.ts` (`questLabel`, `rewardLabel`,
  `achievementTitle`, `achievementDescription`, noms des outils et coffres).
- Réglages : `src/store/settings.ts` (`useSettings`, `set(patch)`), appliqués automatiquement.
- Vignettes : `ui/library/Thumb.tsx` (œuvre de la bibliothèque), `ui/library/ProjectThumb.tsx` (partie, avec
  avancement).

## Composants (`src/ui/kit`)

`Screen` (grand titre repliable, défilement, place de la barre d'onglets ; `onBack` pour les sous-pages),
`Card` (apparition en cascade via `index`), `Button` (`filled`/`tonal`/`text`), `IconButton`, `Chip`,
`SectionHeader`, `ListRow`, `ProgressRing`, `Skeleton` (jamais d'écran vide pendant un chargement), `Badge`,
`EmptyState`, `Sheet` (feuille du bas à ressort), `Switch`, `Slider`, `Segmented`. Icônes : `ui/kit/icons.tsx`,
`ui/meta/icons.tsx`.

## Style et mouvement

- Couleurs **uniquement** via les jetons CSS (`src/theme/themes.css`) : `--bg`, `--surface`, `--surface-2`,
  `--surface-3`, `--on-surface`, `--on-surface-muted`, `--primary`, `--on-primary`, `--primary-container`,
  `--on-primary-container`, `--secondary-container`, `--on-secondary-container`, `--tertiary`, `--outline`,
  `--outline-strong`, `--shadow-soft`, `--shadow-lift`, `--radius-l`, `--radius-m`. Quatre thèmes (Doux, Clair,
  Sombre, Material You) + contraste élevé : jamais de couleur d'interface en dur (les œuvres gardent les leurs).
- Mouvement : `src/theme/motion/tokens.ts` (`spring.gentle|snappy|bouncy|sheet`, `duration`, `staggerDelay`).
  Tout est interruptible ; « Réduire les animations » est géré globalement par `MotionConfig`.
- Micro-interactions sur tout ce qui se touche (`whileTap` léger), cartes en cascade, squelettes pendant les
  chargements. Mise en page mobile (360–430 px de large), zones tactiles ≥ 44 px, `aria-label` sur les boutons
  icônes.
- CSS dans un fichier par écran (`screens/<dossier>/<nom>.css`), classes préfixées par l'écran.

## Vérifier

`npm run typecheck`, `npx eslint src`, `npx prettier --check src`, et visuellement :
`npx tsx --tsconfig tsconfig.app.json scripts/dev/shell-check.ts <dossier> <onglet|sous-page> [0,800,1600]`
(captures dans les 4 thèmes, aux défilements donnés ; `window.__nav` pilote la navigation ;
serveur de dev sur http://localhost:5173). Données de test dans la console du navigateur : `window.__meta`
(`debugGrant([{ kind: 'xp', amount: 50000 }])`…).

## Galerie et exports (`src/render/`)

- `loadArtwork(projectId)` → `Artwork` (grille, cases posées, ordre de pose, cadre, titre).
- `artworkThumb(projectId, { size?, frame? })` → URL d'une image **encadrée et détourée** (fond transparent,
  ombre douce), rendue avec les shaders du jeu et mise en cache : à poser sur le mur de la galerie.
- `renderArtwork(artwork, { size, framed?, frame?, transparent? })` → canvas ; `canvasBlob(canvas)` → PNG.
- `renderWallpaper(artwork, { ...screenPixels(), frame? })` → canvas au format de l'écran.
- `exportTimelapse(artwork, { format: 'mp4' | 'gif', onProgress, signal })` → Blob (annulable avec un
  `AbortController`) ; `canExportMp4()` dit si l'appareil sait encoder la vidéo.
- `shareFile(blob, fileName(title, ext), texte)`, `saveToDevice(blob, name)` (Images/Films › Tessel),
  `setWallpaper(blob, 'home' | 'lock' | 'both')`.
- Cadres : `FRAMES` (`src/content/frames.ts`), noms dans le catalogue (`catalogItem(key).name`), cadres
  débloqués : `meta.unlocked('frame')`. Changer le cadre d'une œuvre : `store.setFrame(id, key)` puis
  `useDataVersion.getState().bump()`.
- Revoir la création : `useNav.getState().open(refForProject(project, index), { timelapse: true, origin })`.
