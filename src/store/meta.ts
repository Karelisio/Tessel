import { create } from 'zustand';
import type { LevelInfo } from '@/meta/levels';
import type { ModeId } from '@/modes/types';
import type { MetaNotice, MetaService } from '@/meta/MetaService';
import type { Quest } from '@/meta/quests';
import type { ChestSize, Reward, ToolId } from '@/meta/rewards';
import type { StreakStatus } from '@/meta/streak';
import { daysBetween, nextWeekStart } from '@/meta/time';

export interface MetaSnapshot {
  level: LevelInfo;
  /** Modes débloqués. */
  modes: ModeId[];
  /** Catégories débloquées. */
  categories: string[];
  tools: Record<ToolId, number>;
  chests: Record<ChestSize, number>;
  freezes: number;
  streak: { current: number; best: number; status: StreakStatus; todayCells: number };
  quests: Quest[];
  canReroll: boolean;
  achievements: number;
  unseen: number;
  /** Jour courant de la méta-progression. */
  day: string;
  /** Jours restants avant les nouvelles quêtes de la semaine. */
  weekDaysLeft: number;
}

export interface Toast {
  id: number;
  notice: MetaNotice;
}

/** Montée(s) de niveau à célébrer (regroupées) : du niveau `from` au niveau `level`. */
export interface Celebration {
  from: number;
  level: number;
  rewards: Reward[];
}

interface MetaState {
  service: MetaService | null;
  snap: MetaSnapshot | null;
  toasts: Toast[];
  celebration: Celebration | null;
  endCelebration: () => void;
  attach: (service: MetaService) => () => void;
  refresh: () => void;
  dismiss: (id: number) => void;
  /** Debug : rejoue un toast ou une célébration. */
  push: (notice: MetaNotice) => void;
  celebrate: (c: Celebration) => void;
}

function snapshot(m: MetaService): MetaSnapshot {
  return {
    level: m.levelInfo,
    modes: m.unlockedModes,
    categories: m.unlockedCategories,
    tools: { loupe: m.tools('loupe'), bucket: m.tools('bucket'), wand: m.tools('wand') },
    chests: { small: m.chests('small'), medium: m.chests('medium'), large: m.chests('large') },
    freezes: m.freezes,
    streak: m.streak,
    quests: m.quests().map((q) => ({ ...q })),
    canReroll: m.canReroll,
    achievements: m.achievementCount,
    unseen: m.unseen().length,
    day: m.day,
    weekDaysLeft: daysBetween(m.day, nextWeekStart(m.day)),
  };
}

let nextToast = 1;
/** Au-delà, les plus anciens toasts cèdent la place. */
const MAX_TOASTS = 4;

/** Reflet de la méta-progression pour l'interface (mis à jour au plus ~7 fois par seconde). */
export const useMetaStore = create<MetaState>((set, get) => ({
  service: null,
  snap: null,
  toasts: [],
  celebration: null,
  endCelebration: () => {
    // la célébration a remplacé les toasts de niveau : ils ne réapparaissent pas ensuite
    set((s) => ({ celebration: null, toasts: s.toasts.filter((x) => x.notice.type !== 'levelUp') }));
  },
  attach: (service) => {
    set({ service, snap: snapshot(service) });
    const offChange = service.subscribe(() => {
      set({ snap: snapshot(service) });
    });
    const offNotice = service.onNotice((notice) => {
      // une journée validée sans rien de particulier n'a pas besoin d'un toast
      if (notice.type === 'streak' && notice.update.milestone === null && notice.update.freezesUsed === 0)
        if (!notice.update.broken && notice.update.state.current !== 1) return;
      if (notice.type === 'levelUp') {
        const c = get().celebration;
        set({
          celebration: {
            from: c ? c.from : notice.level - 1,
            level: notice.level,
            rewards: [...(c?.rewards ?? []), ...notice.rewards],
          },
        });
      }
      set((s) => ({ toasts: [...s.toasts, { id: nextToast++, notice }].slice(-MAX_TOASTS) }));
    });
    return () => {
      offChange();
      offNotice();
      if (get().service === service) set({ service: null, snap: null });
    };
  },
  refresh: () => {
    const { service } = get();
    if (service) set({ snap: snapshot(service) });
  },
  dismiss: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
  push: (notice) => {
    set((s) => ({ toasts: [...s.toasts, { id: nextToast++, notice }].slice(-MAX_TOASTS) }));
  },
  celebrate: (celebration) => {
    set({ celebration });
  },
}));
