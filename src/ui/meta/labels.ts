import { locale, tr } from '@/i18n/locale';
import { t, type I18nText } from '@/i18n/text';
import { ACHIEVEMENT_TEXT } from '@/meta/achievements.text';
import { catalogItem, unlockKind, type UnlockKind } from '@/meta/catalog';
import { formatNumber, questTitle } from '@/meta/format';
import type { Quest } from '@/meta/quests';
import { QUEST_TEXT } from '@/meta/quests.text';
import type { ChestSize, Reward, ToolId } from '@/meta/rewards';

export const TOOL_NAMES: Readonly<Record<ToolId, I18nText>> = {
  loupe: t('Loupe', 'Magnifier'),
  bucket: t('Pot de peinture', 'Paint bucket'),
  wand: t('Baguette', 'Magic wand'),
};

export const TOOL_HINTS: Readonly<Record<ToolId, I18nText>> = {
  loupe: t('Trouve une case restante', 'Finds a remaining cell'),
  bucket: t('Touche une zone pour la remplir', 'Tap an area to fill it'),
  wand: t('Termine la couleur choisie', 'Completes the selected color'),
};

export const CHEST_NAMES: Readonly<Record<ChestSize, I18nText>> = {
  small: t('Petit coffre', 'Small chest'),
  medium: t('Coffre', 'Chest'),
  large: t('Grand coffre', 'Large chest'),
};

export const UNLOCK_KINDS: Readonly<Record<UnlockKind, I18nText>> = {
  mode: t('Nouveau mode', 'New mode'),
  category: t('Nouvelle catégorie', 'New category'),
  frame: t('Nouveau cadre', 'New frame'),
  texture: t('Nouvelle matière', 'New material'),
  palette: t('Nouvelle palette', 'New palette'),
  wall: t('Nouveau mur de galerie', 'New gallery wall'),
  ambience: t('Nouvelle ambiance', 'New ambience'),
  music: t('Nouvelle musique', 'New music'),
  badge: t('Nouveau badge', 'New badge'),
};

const TOOL_WORDS: Readonly<Record<ToolId, readonly [I18nText, I18nText]>> = {
  loupe: [t('loupe', 'magnifier'), t('loupes', 'magnifiers')],
  bucket: [t('pot de peinture', 'paint bucket'), t('pots de peinture', 'paint buckets')],
  wand: [t('baguette', 'magic wand'), t('baguettes', 'magic wands')],
};

const plural = (n: number, [one, many]: readonly [I18nText, I18nText]) => tr(n > 1 ? many : one);

export function rewardLabel(r: Reward): string {
  switch (r.kind) {
    case 'xp':
      return `+${formatNumber(r.amount, locale())} XP`;
    case 'tool':
      return `+${r.count} ${plural(r.count, TOOL_WORDS[r.tool])}`;
    case 'freeze':
      return `+${r.count} ${plural(r.count, [t('joker', 'streak freeze'), t('jokers', 'streak freezes')])}`;
    case 'chest':
      return `+ ${tr(CHEST_NAMES[r.size]).toLowerCase()}${r.count > 1 ? ` ×${r.count}` : ''}`;
    case 'unlock': {
      const item = catalogItem(r.key);
      const sep = locale() === 'fr' ? ' : ' : ': ';
      return `${tr(UNLOCK_KINDS[unlockKind(r.key)])}${sep}${item ? tr(item.name) : r.key}`;
    }
  }
}

export function questLabel(q: Quest): string {
  const text = QUEST_TEXT[q.template];
  return text ? questTitle(text, q, locale()) : q.template;
}

export function achievementTitle(id: string): string {
  const text = ACHIEVEMENT_TEXT[id];
  return text ? tr(text.title) : id;
}

export function achievementDescription(id: string, target: number): string {
  const text = ACHIEVEMENT_TEXT[id];
  return text ? tr(text.description).replace('{n}', formatNumber(target, locale())) : '';
}
