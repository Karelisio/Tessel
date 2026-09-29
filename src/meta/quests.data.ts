import type { QuestTemplate } from './quests';

/**
 * Modèles de quêtes, toujours douces. Objectifs par tranche de niveau (1–9, 10–24, 25–49, 50+),
 * calibrés pour un joueur qui colorie une vingtaine de minutes par jour. Textes : quests.text.ts.
 */
export const QUEST_TEMPLATES: readonly QuestTemplate[] = [
  // quotidien — facile
  { id: 'd-cells', slot: 'easy', metric: 'cells', targets: [150, 300, 500, 700], weight: 2 },
  { id: 'd-colors', slot: 'easy', metric: 'colors', targets: [3, 5, 6, 8] },
  { id: 'd-playtime', slot: 'easy', metric: 'playtime.minutes', targets: [5, 8, 10, 12] },
  { id: 'd-cells-mode', slot: 'easy', metric: 'cells.mode.{mode}', targets: [100, 200, 350, 500] },

  // quotidien — moyen
  { id: 'd-artwork', slot: 'medium', metric: 'artworks', targets: [1, 1, 1, 1], weight: 2 },
  {
    id: 'd-artwork-mode',
    slot: 'medium',
    metric: 'artworks.mode.{mode}',
    targets: [1, 1, 1, 1],
    requires: { level: 2 },
  },
  { id: 'd-daily', slot: 'medium', metric: 'artworks.daily', targets: [1, 1, 1, 1] },
  { id: 'd-cells-big', slot: 'medium', metric: 'cells', targets: [400, 800, 1200, 1600] },
  { id: 'd-colors-big', slot: 'medium', metric: 'colors', targets: [6, 10, 12, 15] },

  // quotidien — variété
  {
    id: 'd-artwork-category',
    slot: 'variety',
    metric: 'artworks.category.{category}',
    targets: [1, 1, 1, 1],
    weight: 2,
  },
  {
    id: 'd-cells-mode-variety',
    slot: 'variety',
    metric: 'cells.mode.{mode}',
    targets: [150, 300, 450, 600],
    requires: { level: 6 },
  },
  {
    id: 'd-timelapse',
    slot: 'variety',
    metric: 'timelapses',
    targets: [1, 1, 1, 1],
    requires: { stat: ['artworks', 1] },
  },
  {
    id: 'd-artwork-photo',
    slot: 'variety',
    metric: 'artworks.photo',
    targets: [1, 1, 1, 1],
    requires: { stat: ['photos', 1] },
  },
  { id: 'd-tool', slot: 'variety', metric: 'tools', targets: [1, 1, 2, 2] },

  // hebdomadaire — volume
  { id: 'w-cells', slot: 'volume', metric: 'cells', targets: [2000, 4000, 6000, 8000] },
  {
    id: 'w-cells-mode',
    slot: 'volume',
    metric: 'cells.mode.{mode}',
    targets: [1000, 2000, 3000, 4000],
    weight: 2,
  },
  { id: 'w-playtime', slot: 'volume', metric: 'playtime.minutes', targets: [40, 60, 80, 100] },
  { id: 'w-colors', slot: 'volume', metric: 'colors', targets: [25, 40, 55, 70] },

  // hebdomadaire — œuvres terminées
  { id: 'w-artworks', slot: 'completion', metric: 'artworks', targets: [3, 4, 5, 6] },
  {
    id: 'w-artworks-mode',
    slot: 'completion',
    metric: 'artworks.mode.{mode}',
    targets: [2, 2, 3, 3],
    requires: { level: 2 },
  },
  {
    id: 'w-artworks-category',
    slot: 'completion',
    metric: 'artworks.category.{category}',
    targets: [2, 2, 3, 3],
  },
  { id: 'w-daily', slot: 'completion', metric: 'artworks.daily', targets: [3, 4, 5, 5] },

  // hebdomadaire — défi doux
  {
    id: 'w-large',
    slot: 'challenge',
    metric: 'artworks.size.large',
    targets: [1, 1, 1, 2],
    requires: { level: 5 },
  },
  {
    id: 'w-photo',
    slot: 'challenge',
    metric: 'artworks.photo',
    targets: [1, 1, 2, 2],
    requires: { stat: ['photos', 1] },
  },
  { id: 'w-days', slot: 'challenge', metric: 'days', targets: [4, 5, 5, 6], weight: 2 },
  { id: 'w-quests', slot: 'challenge', metric: 'quests.daily', targets: [6, 8, 10, 12] },
  {
    id: 'w-creation',
    slot: 'challenge',
    metric: 'artworks.creation',
    targets: [1, 1, 1, 1],
    requires: { stat: ['creations', 1] },
  },
  {
    id: 'w-timelapse',
    slot: 'challenge',
    metric: 'timelapses',
    targets: [3, 3, 4, 5],
    requires: { stat: ['artworks', 3] },
  },
];
