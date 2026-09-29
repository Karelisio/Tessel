import { t } from '@/i18n/text';
import type { QuestText } from './format';

/** Textes des modèles de quêtes (clés = identifiants de quests.data.ts). */
export const QUEST_TEXT: Readonly<Record<string, QuestText>> = {
  'd-cells': { other: t('Pose {n} cases', 'Place {n} cells') },
  'd-colors': { other: t('Termine {n} couleurs', 'Complete {n} colors') },
  'd-playtime': { other: t('Colorie pendant {n} minutes', 'Color for {n} minutes') },
  'd-cells-mode': { other: t('Pose {n} {units}', 'Place {n} {units}') },

  'd-artwork': {
    one: t('Termine une œuvre', 'Complete an artwork'),
    other: t('Termine {n} œuvres', 'Complete {n} artworks'),
  },
  'd-artwork-mode': {
    one: t('Termine une œuvre {inMode}', 'Complete an artwork {inMode}'),
    other: t('Termine {n} œuvres {inMode}', 'Complete {n} artworks {inMode}'),
  },
  'd-daily': {
    one: t('Termine l’œuvre du jour', 'Complete the daily artwork'),
    other: t('Termine {n} œuvres du jour', 'Complete {n} daily artworks'),
  },
  'd-cells-big': { other: t('Colorie {n} cases', 'Color {n} cells') },
  'd-colors-big': { other: t('Remplis {n} couleurs jusqu’au bout', 'Fill {n} colors all the way') },

  'd-artwork-category': {
    one: t('Termine une œuvre {category}', 'Complete one {category} artwork'),
    other: t('Termine {n} œuvres {category}', 'Complete {n} {category} artworks'),
  },
  'd-cells-mode-variety': {
    other: t('Change d’air : pose {n} {units}', 'Change of scenery: place {n} {units}'),
  },
  'd-timelapse': {
    one: t('Regarde le timelapse d’une œuvre', 'Watch an artwork’s timelapse'),
    other: t('Regarde {n} timelapses', 'Watch {n} timelapses'),
  },
  'd-artwork-photo': {
    one: t('Termine une œuvre créée à partir d’une photo', 'Complete an artwork made from a photo'),
    other: t('Termine {n} œuvres créées à partir de photos', 'Complete {n} artworks made from photos'),
  },
  'd-tool': {
    one: t('Utilise un outil', 'Use a tool'),
    other: t('Utilise {n} outils', 'Use {n} tools'),
  },

  'w-cells': { other: t('Pose {n} cases cette semaine', 'Place {n} cells this week') },
  'w-cells-mode': { other: t('Pose {n} {units} cette semaine', 'Place {n} {units} this week') },
  'w-playtime': { other: t('Colorie {n} minutes cette semaine', 'Color for {n} minutes this week') },
  'w-colors': { other: t('Termine {n} couleurs cette semaine', 'Complete {n} colors this week') },

  'w-artworks': {
    one: t('Termine une œuvre', 'Complete an artwork'),
    other: t('Termine {n} œuvres', 'Complete {n} artworks'),
  },
  'w-artworks-mode': {
    one: t('Termine une œuvre {inMode}', 'Complete an artwork {inMode}'),
    other: t('Termine {n} œuvres {inMode}', 'Complete {n} artworks {inMode}'),
  },
  'w-artworks-category': {
    one: t('Termine une œuvre {category}', 'Complete one {category} artwork'),
    other: t('Termine {n} œuvres {category}', 'Complete {n} {category} artworks'),
  },
  'w-daily': {
    one: t('Termine une œuvre du jour', 'Complete a daily artwork'),
    other: t('Termine {n} œuvres du jour', 'Complete {n} daily artworks'),
  },

  'w-large': {
    one: t('Termine une grande œuvre (100×100 ou plus)', 'Complete a large artwork (100×100 or more)'),
    other: t('Termine {n} grandes œuvres (100×100 ou plus)', 'Complete {n} large artworks (100×100 or more)'),
  },
  'w-photo': {
    one: t('Termine une œuvre créée à partir d’une photo', 'Complete an artwork made from a photo'),
    other: t('Termine {n} œuvres créées à partir de photos', 'Complete {n} artworks made from photos'),
  },
  'w-days': {
    other: t('Colorie {n} jours différents cette semaine', 'Color on {n} different days this week'),
  },
  'w-quests': {
    one: t('Termine une quête du jour', 'Complete a daily quest'),
    other: t('Termine {n} quêtes du jour', 'Complete {n} daily quests'),
  },
  'w-creation': {
    one: t('Termine une œuvre que tu as créée', 'Complete an artwork you created'),
    other: t('Termine {n} œuvres que tu as créées', 'Complete {n} artworks you created'),
  },
  'w-timelapse': {
    one: t('Regarde un timelapse', 'Watch a timelapse'),
    other: t('Regarde {n} timelapses', 'Watch {n} timelapses'),
  },
};
